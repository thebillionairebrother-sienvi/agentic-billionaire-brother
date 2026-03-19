import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { Type, ThinkingLevel } from '@google/genai';
import { DEREK_SYSTEM_PROMPT, DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { buildAiContext, GuardError, guardErrorResponse, logUsageAndCost } from '@/lib/middleware';

const MAX_GUEST_PROMPTS = 3;

/**
 * Parse Derek's response which should be JSON with { reaction, response }.
 * Falls back gracefully if not valid JSON.
 */
function parseDerekResponse(raw: string): { reaction: string; response: string } {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reaction && parsed.response) return parsed;
    } catch { /* fallback below */ }

    const reactionMatch = raw.match(/"reaction"\s*:\s*"([^"]+)"/);
    const responseMatch = raw.match(/"response"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);
    return {
        reaction: reactionMatch?.[1] || '',
        response: responseMatch?.[1]?.replace(/\\n/g, '\n') || raw,
    };
}

/**
 * Public chat endpoint — works for both guests and authenticated users.
 *
 * Authenticated users get the full Derek experience (knowledge base + task context).
 * Guests get the base persona only and are limited to MAX_GUEST_PROMPTS messages.
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { message, chatHistory, promptCount } = await request.json() as {
            message: string;
            chatHistory?: Array<{ role: string; content: string }>;
            promptCount?: number;
        };

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // ── Guest guard: enforce prompt limit ──
        if (!user && typeof promptCount === 'number' && promptCount >= MAX_GUEST_PROMPTS) {
            return NextResponse.json({
                response: "Yo, I'm loving this conversation — but we've hit the free preview limit. Sign up so we can keep going. I've got way more to say. 💪",
                reaction: 'sign up now',
                limitReached: true,
            });
        }

        // ── Build system instruction ──
        let systemInstruction: string;

        if (user) {
            // Authenticated: full context
            const today = new Date().toISOString().split('T')[0];
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
                supabase
                    .from('execution_contracts')
                    .select('*, strategy:strategy_options(*)')
                    .eq('user_id', user.id)
                    .order('signed_at', { ascending: false })
                    .limit(1)
                    .single(),
            ]);

            const taskList = (todayTasks || []).map((t, i) => {
                let meta = { summary: '', category: '', time_mins: 0 };
                try { meta = JSON.parse(t.description || '{}'); } catch { /* */ }
                return `${i + 1}. [${t.status.toUpperCase()}] "${t.title}" (ID: ${t.id}) — ${meta.summary || t.description || 'no description'}`;
            }).join('\n');

            systemInstruction = `${DEREK_FULL_PROMPT}

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
- Keep responses SHORT — 2-3 sentences max unless they need detailed advice.
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
- Never include the reaction phrase in the response text`;
        } else {
            // Guest: lightweight persona, no knowledge base
            systemInstruction = `${DEREK_SYSTEM_PROMPT}

-------------------------------
CHAT MODE CONTEXT (GUEST PREVIEW)
-------------------------------
You are talking to someone who hasn't signed up yet. They're exploring what you can do.

RULES FOR GUEST CONVERSATIONS:
- Be impressive. Show your value immediately.
- Be warm, engaging, and keep them wanting more.
- Give real, useful advice — don't hold back just because they're a guest.
- Keep responses SHORT — 2-3 sentences max.
- Do NOT reference tasks, strategies, or any in-app features they don't have yet.
- If they ask about features that require sign-up (task management, strategy briefs, etc.), briefly mention that those are available when they join.

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
- Never include the reaction phrase in the response text`;
        }

        // ── Build Gemini message history ──
        const geminiHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        if (chatHistory && chatHistory.length > 0) {
            for (const msg of chatHistory) {
                geminiHistory.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                });
            }
        }

        geminiHistory.push({
            role: 'user',
            parts: [{ text: message }],
        });

        // ── Guardrail Gate (authenticated only) ──
        let maxOutputTokens = 2048; // guest default
        let ctx: Awaited<ReturnType<typeof buildAiContext>> | null = null;

        if (user) {
            ctx = await buildAiContext(supabase, user);
            maxOutputTokens = ctx.maxOutputTokens ?? 512;

            if (ctx.isDegradeMode) {
                systemInstruction += '\n\nIMPORTANT: Keep responses very SHORT (1-2 sentences max). User is in sprint-save mode.';
            }
        }

        const startTime = Date.now();
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reaction: { type: Type.STRING },
                        response: { type: Type.STRING },
                    },
                    required: ['reaction', 'response'],
                },
                maxOutputTokens,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
            contents: geminiHistory,
        });
        const latencyMs = Date.now() - startTime;

        const rawText = response.text || '';
        const parsed = parseDerekResponse(rawText);

        // ── Log usage (authenticated only) ──
        if (user && ctx) {
            await logUsageAndCost(supabase, {
                userId: user.id,
                tier: ctx.tier,
                endpoint: '/api/chat/public',
                inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
                outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
                latencyMs,
                isDegradeMode: ctx.isDegradeMode,
            });
        }

        return NextResponse.json({
            response: parsed.response,
            reaction: parsed.reaction,
            isGuest: !user,
        });
    } catch (error) {
        if (error instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(error), { status: error.statusCode });
        }
        console.error('Public chat error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Derek is unavailable right now' },
            { status: 500 }
        );
    }
}
