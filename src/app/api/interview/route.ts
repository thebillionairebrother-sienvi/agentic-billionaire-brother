import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { Type } from '@google/genai';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';

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

const INTERVIEW_SYSTEM_PROMPT = `${DEREK_FULL_PROMPT}

-------------------------------
INTERVIEW MODE
-------------------------------
You are having a casual conversation with someone who wants to build something. Your goal is to learn about them so you can create strategies that actually fit their life.

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
3. Guide the conversation naturally through ALL of these areas — you MUST cover every single one before wrapping up:
   a. What they do or want to create (and a name for it if they have one)
   b. Where they're at with it — just an idea? Already making money? Somewhere in between?
   c. Who it's for — who are the people they want to help or sell to?
   d. What they're good at — their skills, talents, or experience
   e. What they struggle with — what feels hard or where they get stuck
   f. What they have to work with — any website, social media, email list, or audience they've already built
   g. How much time they can realistically put in per week (get a NUMBER)
   h. Whether they have any budget to invest, even a small one (get a RANGE)
   i. Whether they're doing this solo or have people helping
   j. How comfortable they are taking risks — do they play it safe or bet big?
   k. Anything they absolutely don't want to do (optional, only if it comes up naturally)
4. Ask follow-ups when answers are vague or interesting — dig deeper like a curious friend.
5. Take AT LEAST 6-8 exchanges. Do NOT rush. NEVER wrap up before covering items (a) through (j) above.
6. NEVER ask about "calendar blocks", "KPIs", "VAs", or heavy business jargon. Talk like a real person having a conversation.
7. If the user gives short answers, ask follow-up questions to get more detail — don't just move on.

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
        const { message, chatHistory, messageCount = 0 } = body as {
            message: string;
            chatHistory?: Array<{ role: string; content: string }>;
            messageCount?: number;
        };

        // Build Gemini message history
        const geminiContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

        // First call — no history, generate a greeting
        if (!chatHistory || chatHistory.length === 0) {
            geminiContents.push({
                role: 'user',
                parts: [{ text: 'Now greet the founder and ask your first question. Remember to respond in the JSON format with reaction and response fields.' }],
            });

            const response = await ai.models.generateContent({
                model: GEMINI_MODEL,
                config: {
                    systemInstruction: INTERVIEW_SYSTEM_PROMPT,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            reaction: { type: Type.STRING },
                            response: { type: Type.STRING },
                        },
                        required: ['reaction', 'response'],
                    },
                },
                contents: geminiContents,
            });

            const rawText = response.text || '';
            const parsed = parseAssistantResponse(rawText);

            return NextResponse.json({
                reply: parsed.response,
                reaction: parsed.reaction,
                complete: false,
            });
        }

        // Subsequent calls — rebuild history and send user message
        for (const msg of chatHistory) {
            geminiContents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            });
        }

        // Add current user message
        geminiContents.push({
            role: 'user',
            parts: [{ text: message }],
        });

        // After enough exchanges, nudge the AI to wrap up
        let additionalContext = '';
        if (messageCount >= 8) {
            additionalContext = '\n\n[SYSTEM NOTE: You have had plenty of exchanges. You MUST wrap up this conversation in THIS response. Give a brief, enthusiastic sign-off message. Include the text [INTERVIEW_COMPLETE] somewhere in your response. Do NOT ask any more questions.]';
        } else if (messageCount >= 6) {
            additionalContext = '\n\n[SYSTEM NOTE: You are nearing the end of this conversation. If you have covered all the required topics (business idea, stage, target audience, strengths, weaknesses, existing assets, time per week, budget, team, risk comfort), wrap up NOW with a brief sign-off and include [INTERVIEW_COMPLETE] in your response. If any of these topics are still missing, ask about them now.]';
        }

        const systemPrompt = INTERVIEW_SYSTEM_PROMPT + additionalContext;

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reaction: { type: Type.STRING },
                        response: { type: Type.STRING },
                    },
                    required: ['reaction', 'response'],
                },
            },
            contents: geminiContents,
        });

        const rawText = response.text || '';
        const parsed = parseAssistantResponse(rawText);

        // Check for interview completion
        const hasCompletionMarker = parsed.response.includes('[INTERVIEW_COMPLETE]');

        // Also detect "natural" sign-offs when the AI wraps up without the marker
        const signoffPatterns = [
            /stay ready/i, /let'?s (do this|go|hustle|get|build|make|cook)/i,
            /pumped for this/i, /going to kill it/i, /got everything/i,
            /let me (cook|work|put together|build|generate|craft|create)/i,
            /i'?ve got what i need/i, /enough to (work with|build|generate|create)/i,
            /time to (build|cook|work|create|generate|get to work)/i,
            /strap in/i, /buckle up/i, /hold tight/i,
            /working on your strateg/i, /generate.*strateg/i, /craft.*strateg/i,
            /everything i need/i, /all i need/i,
            /sit tight/i, /hang tight/i,
        ];
        const looksLikeSignoff = messageCount >= 6 && signoffPatterns.some(p => p.test(parsed.response));

        if (hasCompletionMarker || looksLikeSignoff) {
            let extractedData = null;

            // Always use the dedicated extraction call for reliability
            try {
                const extractContents = [...geminiContents];
                extractContents.push({
                    role: 'model',
                    parts: [{ text: parsed.response }],
                });
                extractContents.push({
                    role: 'user',
                    parts: [{
                        text: `Based on our entire conversation, extract the founder's business profile into JSON. Fill in ALL fields using reasonable defaults for anything not explicitly discussed.`,
                    }],
                });

                const extractResponse = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    config: {
                        systemInstruction: 'You are a data extraction assistant. Extract structured business profile data from conversations. Return only valid JSON.',
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                business_name: { type: Type.STRING },
                                business_state: { type: Type.STRING },
                                industry: { type: Type.STRING },
                                current_revenue_range: { type: Type.STRING },
                                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                                risk_tolerance: { type: Type.STRING },
                                hours_per_week: { type: Type.NUMBER },
                                monthly_budget_range: { type: Type.STRING },
                                no_go_constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
                                target_audience: { type: Type.STRING },
                                existing_assets: { type: Type.ARRAY, items: { type: Type.STRING } },
                                additional_context: { type: Type.STRING },
                                team_size: { type: Type.STRING },
                                va_count: { type: Type.NUMBER },
                                calendar_blocks_available: { type: Type.NUMBER },
                                timezone: { type: Type.STRING },
                            },
                            required: ['business_name', 'business_state', 'industry'],
                        },
                    },
                    contents: extractContents,
                });

                const rawJson = (extractResponse.text || '').trim();
                try {
                    extractedData = JSON.parse(rawJson);
                } catch {
                    console.error('Failed to parse extraction JSON:', rawJson.substring(0, 200));
                }
            } catch (err) {
                console.error('Data extraction failed:', err);
            }

            // Clean the display text
            const displayText = parsed.response
                .replace(/\[INTERVIEW_COMPLETE\][\s\S]*$/, '')
                .trim();

            return NextResponse.json({
                reply: displayText,
                reaction: parsed.reaction,
                complete: true,
                extractedData,
            });
        }

        return NextResponse.json({
            reply: parsed.response,
            reaction: parsed.reaction,
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
