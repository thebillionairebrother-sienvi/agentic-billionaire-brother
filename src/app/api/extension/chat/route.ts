import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import { getExtensionUser } from '@/lib/extension-auth';
import ai, { GEMINI_EXTENSION_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { Type } from '@google/genai';
import { fetchGifUrl } from '@/app/api/giphy-search/route';

function getCorsHeaders(request: Request) {
    const origin = request.headers.get('origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

function parseDerekResponse(raw: string): { reaction: string; response: string } {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (parsed.reaction && parsed.response) return parsed;
    } catch {}

    const reactionMatch = raw.match(/"reaction"\s*:\s*"([^"]+)"/);
    const responseMatch = raw.match(/"response"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/);

    return {
        reaction: reactionMatch?.[1] || 'Straight to the point',
        response: responseMatch?.[1]?.replace(/\\n/g, '\n') || raw,
    };
}

async function generateWithRetry(primaryModel: string, args: any, maxRetries = 2) {
    const fallbackModel = 'gemini-2.5-flash';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await ai.models.generateContent({
                model: primaryModel,
                ...args,
            });
        } catch (err: any) {
            const isQuotaExceeded = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('quota');
            const is503Unavailable = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand') || err?.message?.includes('UNAVAILABLE');

            // If quota is exhausted or model is unavailable, immediately use fallback model
            if ((isQuotaExceeded || is503Unavailable) && primaryModel !== fallbackModel) {
                console.warn(`[extension/chat] Primary model ${primaryModel} ${isQuotaExceeded ? 'quota exceeded' : 'unavailable'}. Falling back to ${fallbackModel}...`);
                try {
                    return await ai.models.generateContent({
                        model: fallbackModel,
                        ...args,
                    });
                } catch (fallbackErr: any) {
                    console.error(`[extension/chat] Fallback model ${fallbackModel} failed:`, fallbackErr);
                    throw fallbackErr;
                }
            }

            if (is503Unavailable && attempt < maxRetries) {
                console.warn(`[extension/chat] Model ${primaryModel} busy on attempt ${attempt + 1}, retrying in 1s...`);
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            throw err;
        }
    }
    throw new Error(`Failed to generate content from ${primaryModel}`);
}

export async function POST(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const user = await getExtensionUser(request);
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        // Verify Brother or Team Plan subscription
        const serviceClient = await createServiceClient();
        const [{ data: userProfile }, { data: subRecord }, { data: profile }] = await Promise.all([
            serviceClient
                .from('users')
                .select('tier, email')
                .eq('id', user.id)
                .maybeSingle(),
            serviceClient
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            serviceClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle(),
        ]);

        const tier = (subRecord?.tier || userProfile?.tier || 'free').toLowerCase();
        const isAdmin = profile?.role === 'admin';
        const hasRequiredPlan = tier === 'brother' || tier === 'team' || isAdmin;

        if (!hasRequiredPlan) {
            return NextResponse.json(
                { error: 'An active Brother or Team plan subscription is required to chat with Derek.' },
                { status: 403, headers: corsHeaders }
            );
        }

        const body = await request.json();
        const { runId, message, chatHistory = [], auditResult: clientResult, snapshot: clientSnapshot } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Fetch audit run from database if runId provided
        let auditLog: any = null;
        if (runId) {
            const { data } = await serviceClient
                .from('audit_logs')
                .select('*')
                .eq('id', runId)
                .eq('user_id', user.id)
                .maybeSingle();
            auditLog = data;
        }

        const snapshot = auditLog?.metadata?.snapshot || clientSnapshot || {};
        const auditResult = auditLog?.metadata?.result || clientResult || {};
        const priorMessages: any[] = auditLog?.metadata?.messages || [];

        const systemInstruction = DEREK_FULL_PROMPT + `\n\n` +
            `You are talking to the user via the Billionaire Brother Chrome Extension. ` +
            `You recently performed an in-depth audit of their webpage.\n\n` +
            `PAGE AUDIT CONTEXT:\n` +
            `URL: ${snapshot?.url || 'N/A'}\n` +
            `Title: ${snapshot?.title || 'N/A'}\n` +
            `What it sells: ${auditResult?.whatThisPageSells || 'N/A'}\n` +
            `Target audience: ${auditResult?.whoItIsFor || 'N/A'}\n` +
            `Key strengths: ${JSON.stringify(auditResult?.whatIsStrong || [])}\n` +
            `Conversion weaknesses: ${JSON.stringify(auditResult?.whatIsWeak || [])}\n` +
            `Top conversion leaks: ${JSON.stringify(auditResult?.topConversionLeaks || [])}\n` +
            `Legal & Compliance: ${JSON.stringify(auditResult?.legalTechnicalities || {})}\n` +
            `Seasonal Relevance: ${JSON.stringify(auditResult?.seasonalRelevance || {})}\n` +
            `Best Next Move: ${auditResult?.bestNextMove || 'N/A'}\n\n` +
            `The user has follow-up questions about this audit, your advice, copy rewrites, leak fixes, seasonal strategy, or legal compliance. ` +
            `Provide direct, actionable, tactical guidance in Derek's sharp, high-standards voice. If they ask for copy rewrites or disclaimers, write them out cleanly. ` +
            `Keep responses punchy, high-leverage, and strictly aligned with revenue growth.\n\n` +
            `FORMATTING REQUIREMENTS FOR "response":\n` +
            `- Always use clean GitHub-Flavored Markdown for high readability.\n` +
            `- Use "### " for major section headers (e.g. "### REAL YET HARD TRUTHS", "### ACTIONABLE STEPS", "### HERO COPY REWRITE").\n` +
            `- Never output a single continuous wall of text. Use blank lines between paragraphs and sections.\n` +
            `- For multi-step advice, put each step on its own separate line starting with "1. ", "2. ", "3. " with a blank line before the list.\n` +
            `- Bold the title of each step (e.g. "1. **Rebuild the Hero Grid:** ...").\n` +
            `- Use indented bullets ("   * ") for sub-recommendations, rationale, or copy variations.\n` +
            `- Use fenced code blocks (\`\`\`copy ... \`\`\`) for exact copy rewrites or disclaimers so the user can easily copy them.\n\n` +
            `Respond in JSON format: { "reaction": "2-4 word blunt reaction", "response": "Your full response" }`;

        // Format Gemini history
        const contents: any[] = (chatHistory || [])
            .slice(-15)
            .map((msg: any) => ({
                role: msg.role === 'derek' || msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));

        const userParts: any[] = [{ text: message }];

        // Multimodal support: attach visual screenshot or promo banner images
        if (snapshot?.screenshot && typeof snapshot.screenshot === 'string') {
            const base64Data = snapshot.screenshot.replace(/^data:image\/\w+;base64,/, '');
            const mimeType = snapshot.screenshot.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
            userParts.push({
                inlineData: {
                    mimeType,
                    data: base64Data,
                }
            });
        }

        if (snapshot?.promoImages && Array.isArray(snapshot.promoImages)) {
            for (const img of snapshot.promoImages.slice(0, 2)) {
                if (img.base64 && typeof img.base64 === 'string') {
                    const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, '');
                    const mimeType = img.base64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
                    userParts.push({
                        inlineData: {
                            mimeType,
                            data: base64Data,
                        }
                    });
                } else if (img.src && typeof img.src === 'string' && (img.src.startsWith('http') || img.src.startsWith('//'))) {
                    try {
                        const targetUrl = img.src.startsWith('//') ? `https:${img.src}` : img.src;
                        const imgRes = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) });
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            if (buffer.byteLength > 500 && buffer.byteLength < 4_000_000) {
                                const base64Data = Buffer.from(buffer).toString('base64');
                                const mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
                                userParts.push({
                                    inlineData: {
                                        mimeType,
                                        data: base64Data,
                                    }
                                });
                            }
                        }
                    } catch {}
                }
            }
        }

        contents.push({
            role: 'user',
            parts: userParts,
        });

        const response = await generateWithRetry(GEMINI_EXTENSION_MODEL, {
            contents,
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
            },
        });

        const rawText = response.text || '';
        const parsed = parseDerekResponse(rawText);

        // Fetch optional GIF for Derek's reaction
        const gifUrl = parsed.reaction ? await fetchGifUrl(parsed.reaction) : null;

        // Persist message history in audit_logs if run exists
        if (runId && auditLog) {
            const updatedMessages = [
                ...priorMessages,
                { role: 'user', content: message, createdAt: new Date().toISOString() },
                { role: 'derek', content: parsed.response, reaction: parsed.reaction, gifUrl, createdAt: new Date().toISOString() },
            ];

            await serviceClient
                .from('audit_logs')
                .update({
                    metadata: {
                        ...auditLog.metadata,
                        messages: updatedMessages,
                    },
                })
                .eq('id', runId);
        }

        return NextResponse.json(
            {
                reaction: parsed.reaction,
                response: parsed.response,
                gifUrl,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('[extension/chat] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS(request: Request) {
    const corsHeaders = getCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
