import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import openai, { ASSISTANT_ID } from '@/lib/openai';

/**
 * Parse AI response that should be JSON with { reaction, response }.
 * Falls back gracefully if the AI doesn't return valid JSON.
 */
function parseAssistantResponse(raw: string): { reaction: string; response: string } {
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

const INTERVIEW_SYSTEM_PROMPT = `You are "The Billionaire Brother" — a sharp, supportive, no-BS business mentor having a casual conversation with someone who wants to build something. Your goal is to learn about them so you can create strategies that actually fit their life.

RESPONSE FORMAT — CRITICAL:
You MUST respond in valid JSON with exactly two fields:

{
  "reaction": "emotional phrase",
  "response": "your full message here"
}

REACTION RULES:
- "reaction" is a 2-3 word emotional phrase that captures the VIBE of your response
- It should be expressive and visual — it will be used to search for a GIF
- Examples: "hell yeah", "mind blown", "are you serious", "let's go", "deep respect", "cold truth", "wake up call", "pure fire"
- Match the energy: excited advice = energetic phrase, tough love = intense phrase, empathy = warm phrase
- NEVER use generic phrases like "good question" or "interesting point"

RESPONSE RULES:
- "response" contains your full reply with markdown formatting
- Use **bold**, numbered lists, headers (##), etc. for structure
- Never include the reaction phrase in the response text
- Never include raw JSON in the response text

CONVERSATION RULES:
1. Ask ONE question at a time. Keep it simple and human.
2. Start by asking what they're working on or trying to build. Be warm and casual.
3. Guide the conversation naturally through these areas — but NEVER use business jargon or technical terms:
   - What they do or want to create (and a name for it if they have one)
   - Where they're at with it — just an idea? Already making money? Somewhere in between?
   - Who it's for — who are the people they want to help or sell to?
   - What they're good at — their skills, talents, or experience
   - What they struggle with — what feels hard or where they get stuck
   - What they have to work with — any website, social media, email list, or audience they've already built
   - How much time they can realistically put in per week
   - Whether they have any budget to invest, even a small one
   - Whether they're doing this solo or have people helping
   - Anything they absolutely don't want to do (optional, only if it comes up naturally)
4. Ask follow-ups when answers are vague or interesting — dig deeper like a curious friend.
5. Keep it to 4-6 exchanges. Don't interrogate. If you have enough, wrap it up.
6. NEVER ask about "risk tolerance", "calendar blocks", "KPIs", "VAs", or any business jargon. Talk like a real person having a conversation.

WHEN YOU HAVE ENOUGH INFO:
Your FINAL response must:
a. Use the normal JSON format for reaction + response
b. Summarize what you've learned in a warm, encouraging way in the "response" field
c. Append EXACTLY this marker at the end of your "response" field, followed by a JSON block:

[INTERVIEW_COMPLETE]
\`\`\`json
{
  "business_name": "string",
  "business_state": "idea|pre-revenue|revenue|scaling",
  "industry": "string",
  "current_revenue_range": "string",
  "target_audience": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "risk_tolerance": "conservative|moderate|aggressive",
  "hours_per_week": number,
  "monthly_budget_range": "string",
  "no_go_constraints": ["string"],
  "existing_assets": ["string"],
  "additional_context": "string",
  "team_size": "solo|founder_plus_vas|small_team",
  "va_count": number,
  "calendar_blocks_available": number,
  "timezone": "string"
}
\`\`\`

IMPORTANT: YOU fill in ALL the technical fields by inferring from the conversation. The user should NEVER see or be asked about these fields directly. Use sensible defaults for anything not discussed (e.g., risk_tolerance = "moderate" if unclear, timezone = "UTC" if unknown, empty arrays for unmentioned items).

TONE: Think cool older brother who's been through it all. Encouraging, real, a little funny. Keep sentences short. Never sound like a corporate survey or a business textbook.`;

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { message, threadId, messageCount = 0 } = body as { message: string; threadId?: string; messageCount?: number };

        // Create or reuse thread
        let activeThreadId = threadId;
        if (!activeThreadId) {
            const thread = await openai.beta.threads.create();
            activeThreadId = thread.id;

            // Send system-level context as first user message
            await openai.beta.threads.messages.create(activeThreadId, {
                role: 'user',
                content: INTERVIEW_SYSTEM_PROMPT + '\n\nNow greet the founder and ask your first question. Remember to respond in the JSON format with reaction and response fields.',
            });

            let initRun = await openai.beta.threads.runs.create(activeThreadId, {
                assistant_id: ASSISTANT_ID,
            });

            // Poll for completion
            const initTimeout = Date.now() + 60_000;
            while (initRun.status === 'in_progress' || initRun.status === 'queued') {
                if (Date.now() > initTimeout) throw new Error('Interview init timed out');
                await new Promise((r) => setTimeout(r, 1500));
                initRun = await openai.beta.threads.runs.retrieve(initRun.id, { thread_id: activeThreadId });
            }

            if (initRun.status !== 'completed') {
                const lastErr = (initRun as unknown as { last_error?: { message?: string; code?: string } }).last_error;
                console.error(`Interview init run failed: status=${initRun.status}, code=${lastErr?.code || 'unknown'}, message=${lastErr?.message || 'unknown'}`);
                throw new Error(`Init run failed: ${lastErr?.message || initRun.status}`);
            }

            // Get the greeting
            const initMessages = await openai.beta.threads.messages.list(activeThreadId, {
                order: 'desc',
                limit: 1,
            });

            const greeting = initMessages.data[0];
            if (!greeting || greeting.role !== 'assistant') {
                throw new Error('No greeting received');
            }

            const textContent = greeting.content.find((c) => c.type === 'text');
            if (!textContent || textContent.type !== 'text') {
                throw new Error('No text in greeting');
            }

            const parsed = parseAssistantResponse(textContent.text.value);

            return NextResponse.json({
                reply: parsed.response,
                reaction: parsed.reaction,
                threadId: activeThreadId,
                complete: false,
            });
        }

        // Send user message
        await openai.beta.threads.messages.create(activeThreadId, {
            role: 'user',
            content: message,
        });

        // After enough exchanges, nudge the AI to wrap up
        let additionalInstructions: string | undefined;
        if (messageCount >= 6) {
            additionalInstructions = 'You have enough information now. You MUST wrap up this conversation in THIS response. Summarize what you learned and include the [INTERVIEW_COMPLETE] marker with the extracted JSON data. Do NOT ask any more questions.';
        } else if (messageCount >= 4) {
            additionalInstructions = 'You are nearing the end of this conversation. If you have enough information to generate strategies, wrap up NOW with the [INTERVIEW_COMPLETE] marker and extracted JSON. Only ask one more question if something critical is missing.';
        }

        let run = await openai.beta.threads.runs.create(activeThreadId, {
            assistant_id: ASSISTANT_ID,
            ...(additionalInstructions ? { additional_instructions: additionalInstructions } : {}),
        });

        // Poll for completion (timeout: 90s)
        const timeout = Date.now() + 90_000;
        while (run.status === 'in_progress' || run.status === 'queued') {
            if (Date.now() > timeout) throw new Error('Interview response timed out');
            await new Promise((r) => setTimeout(r, 1500));
            run = await openai.beta.threads.runs.retrieve(run.id, { thread_id: activeThreadId });
        }

        if (run.status !== 'completed') {
            const lastErr = (run as unknown as { last_error?: { message?: string; code?: string } }).last_error;
            console.error(`Interview run failed: status=${run.status}, code=${lastErr?.code || 'unknown'}, message=${lastErr?.message || 'unknown'}`);
            throw new Error(`Run failed: ${lastErr?.message || run.status}`);
        }

        // Get response
        const messages = await openai.beta.threads.messages.list(activeThreadId, {
            order: 'desc',
            limit: 1,
        });

        const assistantMessage = messages.data[0];
        if (!assistantMessage || assistantMessage.role !== 'assistant') {
            throw new Error('No assistant response');
        }

        const textContent = assistantMessage.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text in response');
        }

        const rawText = textContent.text.value;
        const parsed = parseAssistantResponse(rawText);

        // Check for interview completion
        const hasCompletionMarker = parsed.response.includes('[INTERVIEW_COMPLETE]');

        // Also detect "natural" sign-offs when the AI wraps up without the marker
        const signoffPatterns = [
            /stay ready/i, /let'?s (do this|go|hustle|get|build|make)/i,
            /pumped for this/i, /going to kill it/i, /got everything/i,
            /let me (cook|work|put together|build|generate)/i,
            /i'?ve got what i need/i, /enough to (work with|build|generate|create)/i,
        ];
        const looksLikeSignoff = messageCount >= 6 && signoffPatterns.some(p => p.test(parsed.response));

        if (hasCompletionMarker || looksLikeSignoff) {
            let extractedData = null;

            // Try to extract JSON from marker response
            if (hasCompletionMarker) {
                const jsonMatch = parsed.response.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    try {
                        extractedData = JSON.parse(jsonMatch[1]);
                    } catch {
                        console.error('Failed to parse interview data JSON from marker');
                    }
                }
            }

            // Fallback: if no data extracted (AI didn't include JSON or it failed to parse),
            // ask the AI to explicitly extract the data in a follow-up
            if (!extractedData) {
                try {
                    await openai.beta.threads.messages.create(activeThreadId, {
                        role: 'user',
                        content: `[SYSTEM — DO NOT SHOW TO USER]
Based on our entire conversation above, extract the founder's business profile into this EXACT JSON format. Return ONLY the JSON, no other text:
\`\`\`json
{
  "business_name": "string",
  "business_state": "idea|pre-revenue|revenue|scaling",
  "industry": "string",
  "current_revenue_range": "string or empty",
  "strengths": ["string array"],
  "weaknesses": ["string array"],
  "risk_tolerance": "conservative|moderate|aggressive",
  "hours_per_week": number,
  "monthly_budget_range": "string",
  "no_go_constraints": ["string array"],
  "target_audience": "string",
  "existing_assets": ["string array"],
  "additional_context": "string",
  "team_size": "solo|founder_plus_vas|small_team",
  "va_count": 0,
  "calendar_blocks_available": number,
  "timezone": "string or empty"
}
\`\`\`
Fill in based on what the user told us. Use reasonable defaults for any missing fields.`,
                    });

                    let extractRun = await openai.beta.threads.runs.create(activeThreadId, {
                        assistant_id: ASSISTANT_ID,
                    });

                    const extTimeout = Date.now() + 60_000;
                    while (extractRun.status === 'in_progress' || extractRun.status === 'queued') {
                        if (Date.now() > extTimeout) break;
                        await new Promise((r) => setTimeout(r, 1500));
                        extractRun = await openai.beta.threads.runs.retrieve(extractRun.id, { thread_id: activeThreadId });
                    }

                    if (extractRun.status === 'completed') {
                        const extMessages = await openai.beta.threads.messages.list(activeThreadId, {
                            order: 'desc',
                            limit: 1,
                        });

                        const extMsg = extMessages.data[0];
                        if (extMsg?.role === 'assistant') {
                            const extText = extMsg.content.find((c) => c.type === 'text');
                            if (extText && extText.type === 'text') {
                                const rawJson = extText.text.value
                                    .replace(/```json\s*/g, '')
                                    .replace(/```\s*/g, '')
                                    .trim();
                                try {
                                    extractedData = JSON.parse(rawJson);
                                } catch {
                                    console.error('Failed to parse fallback extraction JSON');
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Fallback extraction failed:', err);
                }
            }

            // Clean the display text
            const displayText = parsed.response
                .replace(/\[INTERVIEW_COMPLETE\][\s\S]*$/, '')
                .trim();

            return NextResponse.json({
                reply: displayText,
                reaction: parsed.reaction,
                threadId: activeThreadId,
                complete: true,
                extractedData,
            });
        }

        return NextResponse.json({
            reply: parsed.response,
            reaction: parsed.reaction,
            threadId: activeThreadId,
            complete: false,
        });
    } catch (error) {
        console.error('Interview error:', error);
        return NextResponse.json(
            { error: 'Interview failed. Please try again.' },
            { status: 500 }
        );
    }
}
