import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { Type, ThinkingLevel } from '@google/genai';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { buildAiContext, GuardError, guardErrorResponse, logUsageAndCost } from '@/lib/middleware';

function parseDerekResponse(raw: string): { reaction: string; response: string } {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reaction && parsed.response) return parsed;
    } catch { /* fallback */ }

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

        const { message, chatHistory } = await request.json() as {
            message?: string;
            chatHistory?: Array<{ role: string; content: string }>;
        };

        // ── Guardrail Gate ──
        const ctx = await buildAiContext(supabase, user);

        // Gather weekly context
        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('*, strategy:strategy_options(*)')
            .eq('user_id', user.id)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        const { data: currentCycle } = await supabase
            .from('weekly_cycles')
            .select('*')
            .eq('user_id', user.id)
            .order('week_number', { ascending: false })
            .limit(1)
            .single();

        // Get week's tasks
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: weekTasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .gte('due_date', weekAgo.toISOString().split('T')[0])
            .lte('due_date', today.toISOString().split('T')[0])
            .order('due_date', { ascending: true });

        const tasks = weekTasks || [];
        const doneTasks = tasks.filter(t => t.status === 'done');
        const skippedTasks = tasks.filter(t => t.status === 'skipped');
        const pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress');

        const taskSummary = tasks.map(t =>
            `- ${t.title} [${t.status}] (due: ${t.due_date})`
        ).join('\n');

        const systemInstruction = `${DEREK_FULL_PROMPT}

-------------------------------
WEEKLY CHECK-IN MODE
-------------------------------
You are conducting a WEEKLY CHECK-IN interview.

CONTEXT:
- Strategy: ${contract?.strategy?.archetype || 'Not set'}
- Thesis: ${contract?.strategy?.thesis || ''}
- Week: ${currentCycle?.week_number || 1}
- KPI Target: ${currentCycle?.kpi_target || 'Not set'}
- Tasks this week: ${tasks.length} total, ${doneTasks.length} completed, ${skippedTasks.length} skipped, ${pendingTasks.length} pending

TASK BREAKDOWN:
${taskSummary || 'No tasks recorded this week'}

YOUR ROLE:
You are interviewing the user about their week. This is a structured check-in, NOT a free-form chat.
Follow this interview flow (one topic per message, don't rush):

1. FIRST MESSAGE: Greet them warmly, mention it's Week ${currentCycle?.week_number || 1} check-in. Ask about their KPI results (${currentCycle?.kpi_target || 'their target'}). Be specific — ask for numbers.
2. After KPI: React to their KPI numbers, then ask which tasks had the MOST impact and why.
3. After impact: Ask if any tasks felt too hard, pointless, or not aligned with their strategy.
4. After feedback: Ask what they want to KILL (stop doing), KEEP (continue), or DOUBLE DOWN on next week.
5. After Kill/Keep/Double: Ask for their ONE biggest insight/lesson from this week.
6. FINAL MESSAGE: When you have enough info (5+ exchanges), end with an encouraging sign-off AND include this exact marker on its own line: %%CHECKIN_COMPLETE%%

RULES:
- Ask ONE question at a time. Don't pile up multiple questions.
- Reference their specific tasks by name when relevant.
- Be direct and conversational — not corporate.
- Keep responses 2-3 sentences max (plus your question).
- Celebrate their wins genuinely. Challenge them on skipped tasks.
- If they dodge a question, gently redirect.

RESPONSE FORMAT:
Always respond in this exact JSON format:
{
  "reaction": "emotional phrase",
  "response": "your actual message here"
}

REACTION RULES:
- "reaction" is a 2-3 word emotional phrase for GIF selection
- Examples: "let's go", "tell me more", "proud of you", "hmm interesting", "respect the grind"
- Always include a reaction, never leave it empty`;

        // Build Gemini contents from chat history
        const geminiContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        if (!chatHistory || chatHistory.length === 0) {
            // First call — generate greeting
            geminiContents.push({
                role: 'user',
                parts: [{ text: 'Now greet the user and start the weekly check-in interview. Respond in the JSON format with reaction and response fields.' }],
            });
        } else {
            // Rebuild history
            for (const msg of chatHistory) {
                geminiContents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                });
            }
            if (message) {
                geminiContents.push({
                    role: 'user',
                    parts: [{ text: message }],
                });
            }
        }

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
                maxOutputTokens: ctx.maxOutputTokens,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
            contents: geminiContents,
        });
        const latencyMs = Date.now() - startTime;

        const rawText = response.text || '';
        const parsed = parseDerekResponse(rawText);
        let responseText = parsed.response;

        // Check for completion marker
        const isComplete = responseText.includes('%%CHECKIN_COMPLETE%%');
        responseText = responseText.replace(/%%CHECKIN_COMPLETE%%/g, '').trim();

        // ── Log usage and cost ──
        await logUsageAndCost(supabase, {
            userId: user.id, tier: ctx.tier, endpoint: '/api/weekly-checkin',
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            latencyMs, isDegradeMode: ctx.isDegradeMode,
        });

        return NextResponse.json({
            response: responseText,
            reaction: parsed.reaction,
            isComplete,
        });
    } catch (error) {
        if (error instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(error), { status: error.statusCode });
        }
        console.error('Weekly check-in error:', error);
        return NextResponse.json(
            { error: 'Failed to process check-in' },
            { status: 500 }
        );
    }
}
