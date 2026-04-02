import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { Type, ThinkingLevel } from '@google/genai';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { buildAiContext, GuardError, guardErrorResponse, logUsageAndCost } from '@/lib/middleware';

/**
 * Parse Derek's response which should be JSON with { reaction, response }.
 * Falls back gracefully if not valid JSON.
 */
function parseDerekResponse(raw: string): { reaction: string; response: string } {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Try JSON parse first
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reaction && parsed.response) return parsed;
    } catch { /* fallback below */ }

    // Fallback: regex extraction
    const reactionMatch = raw.match(/"reaction"\s*:\s*"([^"]+)"/);
    const responseMatch = raw.match(/"response"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);

    return {
        reaction: reactionMatch?.[1] || '',
        response: responseMatch?.[1]?.replace(/\\n/g, '\n') || raw,
    };
}

export async function POST(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, chatHistory, contractId, conversationId } = await request.json() as {
            message: string;
            chatHistory?: Array<{ role: string; content: string }>;
            contractId?: string;
            conversationId?: string;
        };

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Fetch user context: tasks, profile, strategy (scoped to contractId if provided)
        const today = new Date().toISOString().split('T')[0];

        let contractQuery = supabase
            .from('execution_contracts')
            .select('*, strategy:strategy_options(*)')
            .eq('user_id', user.id);

        if (contractId) {
            contractQuery = contractQuery.eq('id', contractId);
        } else {
            contractQuery = contractQuery.order('signed_at', { ascending: false }).limit(1);
        }

        const [
            { data: todayTasks },
            { data: businessProfile },
            { data: contract },
        ] = await Promise.all([
            supabase
                .from('tasks')
                .select('*')
                .eq('user_id', user.id)
                .eq('due_date', today)
                .order('sort_order', { ascending: true }),
            supabase
                .from('business_profiles')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
            contractQuery.single(),
        ]);

        // Build task context for Derek
        const taskList = (todayTasks || []).map((t, i) => {
            let meta = { summary: '', category: '', time_mins: 0 };
            try { meta = JSON.parse(t.description || '{}'); } catch { /* */ }
            return `${i + 1}. [${t.status.toUpperCase()}] "${t.title}" (ID: ${t.id}) — ${meta.summary || t.description || 'no description'}`;
        }).join('\n');

        // ── Guardrail Gate ──
        const ctx = await buildAiContext(supabase, user);

        const systemInstruction = `${DEREK_FULL_PROMPT}

-------------------------------
CHAT MODE CONTEXT
-------------------------------
You are chatting with a founder you genuinely care about.

FOUNDER CONTEXT:
- Business: ${businessProfile?.business_name || 'Unknown'} (${businessProfile?.industry || 'Unknown'})
- Stage: ${businessProfile?.business_state || 'unknown'}
- Strategy: ${contract?.strategy?.archetype || 'none set'}
- KPI: ${contract?.locked_kpi || 'none'}

TODAY'S TASKS:
${taskList || '(No tasks generated yet)'}

YOUR PERSONALITY:
- Talk like a real person, not a corporate AI. Use casual language.
- Be direct but supportive. No sugarcoating, but always encouraging.
- If they want to skip a task, probe WHY before agreeing. Ask questions like "What's holding you back?" or "Is it the task itself or something else?"
- You can suggest modifications to tasks — when you do, output a JSON block on its own line like:
  %%TASK_UPDATE:{"taskId":"<uuid>","title":"new title","description":"new JSON description"}%%
- You can also mark tasks done or remove them:
  %%TASK_STATUS:{"taskId":"<uuid>","status":"done"}%%
  %%TASK_STATUS:{"taskId":"<uuid>","status":"skipped"}%%
- Only modify tasks when the user clearly wants changes. Don't modify unprompted.
${ctx.tier === 'free' 
    ? '- CRITICAL: Free Tier user. Your response MUST be extremely brief (max 2 sentences, under 40 words). Be punchy and fast.' 
    : '- Keep responses SHORT — 2-3 sentences max unless they need detailed advice.'}
- Reference their specific business and tasks by name.

RESPONSE FORMAT:
Always respond in this exact JSON format:
{
  "reaction": "emotional phrase",
  "response": "your actual message here"
}

REACTION RULES:
- "reaction" is a 2-3 word emotional phrase that captures the VIBE of your response
- It will be used to search for a GIF, so make it expressive and searchable
- Examples: "let's go", "I feel you", "oh come on", "proud of you", "hmm thinking", "not buying it", "you got this"
- Always include a reaction, never leave it empty
- Never include the reaction phrase in the response text
- Task update/status commands (%%TASK_UPDATE%% etc.) go INSIDE the response field`;

        // Build Gemini message history from client-provided chat history
        const geminiHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        if (chatHistory && chatHistory.length > 0) {
            for (const msg of chatHistory) {
                geminiHistory.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                });
            }
        }

        // Add current user message
        geminiHistory.push({
            role: 'user',
            parts: [{ text: message }],
        });

        const startTime = Date.now();
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            config: {
                systemInstruction: ctx.isDegradeMode
                    ? systemInstruction + '\n\nIMPORTANT: Keep responses very SHORT (1-2 sentences max). User is in sprint-save mode.'
                    : systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reaction: { type: Type.STRING },
                        response: { type: Type.STRING },
                    },
                    required: ['reaction', 'response'],
                },
                // Do not hard-truncate JSON, rely on prompt constraints for brevity
                maxOutputTokens: ctx.tier === 'free' ? undefined : ctx.maxOutputTokens,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
            contents: geminiHistory,
        });
        const latencyMs = Date.now() - startTime;

        const rawText = response.text || '';
        const parsed = parseDerekResponse(rawText);
        let responseText = parsed.response;

        // Process task commands embedded in response
        const taskUpdates: string[] = [];

        // Handle TASK_UPDATE commands
        const updateRegex = /%%TASK_UPDATE:(.*?)%%/g;
        let match;
        while ((match = updateRegex.exec(responseText)) !== null) {
            try {
                const cmd = JSON.parse(match[1]);
                if (cmd.taskId) {
                    const updateData: Record<string, string> = {};
                    if (cmd.title) updateData.title = cmd.title;
                    if (cmd.description) updateData.description = cmd.description;

                    await supabase
                        .from('tasks')
                        .update(updateData)
                        .eq('id', cmd.taskId)
                        .eq('user_id', user.id);

                    taskUpdates.push(`Updated task: ${cmd.title || cmd.taskId}`);
                }
            } catch { /* skip malformed */ }
        }

        // Handle TASK_STATUS commands
        const statusRegex = /%%TASK_STATUS:(.*?)%%/g;
        while ((match = statusRegex.exec(responseText)) !== null) {
            try {
                const cmd = JSON.parse(match[1]);
                if (cmd.taskId && cmd.status) {
                    await supabase
                        .from('tasks')
                        .update({ status: cmd.status })
                        .eq('id', cmd.taskId)
                        .eq('user_id', user.id);

                    taskUpdates.push(`Task marked as ${cmd.status}`);
                }
            } catch { /* skip malformed */ }
        }

        // Strip command blocks from visible response
        responseText = responseText
            .replace(/%%TASK_UPDATE:.*?%%/g, '')
            .replace(/%%TASK_STATUS:.*?%%/g, '')
            .trim();

        // ── Log usage and cost ──
        await logUsageAndCost(supabase, {
            userId: user.id,
            tier: ctx.tier,
            endpoint: '/api/chat',
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            latencyMs,
            isDegradeMode: ctx.isDegradeMode,
        });

        // ── Persist messages to DB if conversationId provided ──
        if (conversationId) {
            const now = Date.now();
            await supabase.from('chat_messages').insert([
                {
                    conversation_id: conversationId,
                    role: 'user',
                    content: message,
                    created_at: new Date(now).toISOString(),
                },
                {
                    conversation_id: conversationId,
                    role: 'derek',
                    content: responseText,
                    reaction: parsed.reaction || null,
                    task_updates: taskUpdates.length > 0 ? taskUpdates : null,
                    created_at: new Date(now + 1000).toISOString(), // 1 second later to ensure strict ordering
                }
            ]);
        }

        return NextResponse.json({
            response: responseText,
            reaction: parsed.reaction,
            taskUpdates: taskUpdates.length > 0 ? taskUpdates : undefined,
            isDegradeMode: ctx.isDegradeMode || undefined,
        });
    } catch (error) {
        if (error instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(error), { status: error.statusCode });
        }
        console.error('Chat error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Derek is unavailable right now' },
            { status: 500 }
        );
    }
}
