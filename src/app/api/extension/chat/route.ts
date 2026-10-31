import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
    getExtensionCorsHeaders,
    getExtensionRunMemoryStore,
    getExtensionUser,
    resolveExtensionUserPlan,
    sanitizeSnapshotForDb,
} from '@/lib/extension-auth';
import ai, { GEMINI_EXTENSION_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { formatDerekModeForPrompt, sanitizeDerekMode } from '@/lib/extension-derek-mode';
import { Type } from '@google/genai';
import { fetchGifUrl } from '@/app/api/giphy-search/route';
import { logUsageAndCost } from '@/lib/middleware/meter-logger';
import { checkUsageGuard } from '@/lib/middleware/usage-guard';
import { GuardError } from '@/lib/middleware/types';
import type { Tier } from '@/lib/ai-config';

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

async function generateWithRetry(primaryModel: string, args: any) {
    const candidateModels = Array.from(
        new Set([
            primaryModel,
            'gemini-3-flash-preview',
            'gemini-2.5-flash',
            'gemini-3.1-flash-lite-preview',
            'gemini-flash-latest',
        ])
    );

    let lastErr: any = null;
    let firstDemandErr: any = null;
    const PER_ATTEMPT_TIMEOUT_MS = 25000;

    for (const model of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const callPromise = ai.models.generateContent({
                    model,
                    ...args,
                });
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`503 UNAVAILABLE: Model ${model} is experiencing high demand and timed out after ${PER_ATTEMPT_TIMEOUT_MS / 1000}s.`)),
                        PER_ATTEMPT_TIMEOUT_MS
                    )
                );
                return await Promise.race([callPromise, timeoutPromise]);
            } catch (err: any) {
                lastErr = err;
                const msg = (err?.message || '').toString();
                const is503Unavailable =
                    err?.status === 503 ||
                    msg.includes('503') ||
                    msg.toLowerCase().includes('high demand') ||
                    msg.includes('UNAVAILABLE') ||
                    msg.toLowerCase().includes('overloaded');
                if (is503Unavailable && !firstDemandErr) {
                    firstDemandErr = err;
                }
                if (is503Unavailable && attempt === 0) {
                    console.warn(`[extension/chat] Model ${model} busy (503), trying next fallback model...`);
                    break;
                }
                console.warn(`[extension/chat] Model ${model} failed (${msg || 'error'}), trying fallback...`);
                break;
            }
        }
    }
    throw firstDemandErr || lastErr || new Error(`503 UNAVAILABLE: Model ${primaryModel} is currently experiencing high demand.`);
}

export async function POST(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);

    try {
        const user = await getExtensionUser(request);
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        // Verify Brother or Team Plan subscription (with timeout resilience)
        const serviceClient = await createServiceClient();
        const { tier, hasRequiredPlan } = await resolveExtensionUserPlan(serviceClient, user);

        if (!hasRequiredPlan) {
            return NextResponse.json(
                { error: 'An active Brother or Team plan subscription is required to chat with Derek.' },
                { status: 403, headers: corsHeaders }
            );
        }

        // Check usage caps / guardrails (non-blocking on transient DB timeout)
        const effectiveTier: Tier = tier === 'team' ? 'team' : tier === 'brother' ? 'brother' : 'free';
        try {
            await checkUsageGuard(serviceClient, user.id, effectiveTier, { email: user.email });
        } catch (guardErr: any) {
            if (guardErr instanceof GuardError) {
                return NextResponse.json(
                    { error: guardErr.message },
                    { status: guardErr.statusCode || 429, headers: corsHeaders }
                );
            }
            console.warn('[extension/chat] Usage guard check skipped due to transient DB issue:', guardErr?.message);
        }

        const body = await request.json();
        const { runId, message, chatHistory = [], auditResult: clientResult, snapshot: clientSnapshot } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const memStore = getExtensionRunMemoryStore();
        const cachedRun = runId ? memStore.get(runId) : undefined;

        // Fetch lightweight fields from audit_logs if runId provided and not already in memory
        let dbRow: Record<string, any> | null = null;
        if (runId && !cachedRun) {
            const { data } = await serviceClient
                .from('audit_logs')
                .select(
                    'id, status:metadata->>status, auditScope:metadata->>auditScope, derekMode:metadata->>derekMode, result:metadata->result, messages:metadata->messages, url:metadata->snapshot->>url, title:metadata->snapshot->>title, metaDescription:metadata->snapshot->>metaDescription, h1:metadata->snapshot->h1, h2:metadata->snapshot->h2, heroCopy:metadata->snapshot->>heroCopy, ctaText:metadata->snapshot->ctaText'
                )
                .eq('id', runId)
                .eq('user_id', user.id)
                .maybeSingle();
            dbRow = data as Record<string, any> | null;
        }

        const snapshot = clientSnapshot || cachedRun?.snapshot || (dbRow ? {
            url: dbRow.url,
            title: dbRow.title,
            metaDescription: dbRow.metaDescription,
            h1: dbRow.h1,
            h2: dbRow.h2,
            heroCopy: dbRow.heroCopy,
            ctaText: dbRow.ctaText,
        } : {});
        const auditResult = clientResult || cachedRun?.result || dbRow?.result || {};
        const priorMessages: any[] = cachedRun?.messages || dbRow?.messages || [];
        // The audit's own mode stays on the run; the chat uses the panel's current mode, else the run's.
        const runDerekMode = cachedRun?.derekMode ?? (dbRow?.derekMode ? sanitizeDerekMode(dbRow.derekMode) : undefined);
        const derekMode = sanitizeDerekMode(body.derekMode ?? runDerekMode);

        const systemInstruction = DEREK_FULL_PROMPT + `\n\n` +
            `You are talking to the user via the Billionaire Brother Chrome Extension. ` +
            `You recently performed an in-depth audit of their webpage.\n\n` +
            `PAGE AUDIT CONTEXT:\n` +
            `URL: ${snapshot?.url || 'N/A'}\n` +
            `Title: ${snapshot?.title || 'N/A'}\n` +
            `Current H1 Headings on Page: ${JSON.stringify(snapshot?.h1 || [])}\n` +
            `Current H2 Headings on Page: ${JSON.stringify((snapshot?.h2 || []).slice(0, 8))}\n` +
            `Current Hero Copy / Value Proposition on Page: ${snapshot?.heroCopy || snapshot?.metaDescription || 'N/A'}\n` +
            `Current CTA Buttons on Page: ${JSON.stringify((snapshot?.ctaText || []).slice(0, 8))}\n` +
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
            `- Use "### " for major section headers (e.g. "### REAL YET HARD TRUTHS", "### HERO COPY REWRITE", "### ACTIONABLE STEPS").\n` +
            `- Never output a single continuous wall of text. Use blank lines between paragraphs and sections.\n` +
            `- For multi-step advice, put each step on its own separate line starting with "1. ", "2. ", "3. " with a blank line before the list.\n` +
            `- Bold the title of each step (e.g. "1. **Rebuild the Hero Grid:** ...").\n` +
            `- CRITICAL FOR LIVE IN-PLACE COPY SWAPPER ("⚡ Test on Page"): Whenever you suggest or rewrite a headline (H1), subheadline / value proposition, or CTA button text, you MUST place EACH copy option inside its own UNINDENTED multi-line fenced code block with the language tag \`headline\`, \`subhead\`, or \`cta\` on its own line:\n` +
            `\`\`\`headline\nStop Guessing Which Routine Works. See Your Exact Next Correction in 60 Seconds.\n\`\`\`\n` +
            `\`\`\`subhead\nTrack your daily routine, pinpoint the exact bottleneck holding back your progress, and get one clear corrective action every morning.\n\`\`\`\n` +
            `\`\`\`cta\nStart My Free Routine Review\n\`\`\`\n` +
            `- Never indent \`\`\` code fences inside bullet points, and never wrap copy rewrites in single backticks — always use standalone \`\`\`headline, \`\`\`subhead, or \`\`\`cta fenced blocks so the Chrome Extension's live DOM swapper renders the "⚡ Test on Page" button.\n\n` +
            `Respond in JSON format: { "reaction": "2-4 word blunt reaction", "response": "Your full response" }` +
            formatDerekModeForPrompt(derekMode);

        // Format Gemini history
        const contents: any[] = (chatHistory || [])
            .slice(-15)
            .map((msg: any) => ({
                role: msg.role === 'derek' || msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));

        const userParts: any[] = [{ text: message }];

        // Multimodal support if client explicitly included a screenshot
        if (clientSnapshot?.screenshot && typeof clientSnapshot.screenshot === 'string') {
            const base64Data = clientSnapshot.screenshot.replace(/^data:image\/\w+;base64,/, '');
            const mimeType = clientSnapshot.screenshot.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
            userParts.push({
                inlineData: {
                    mimeType,
                    data: base64Data,
                }
            });
        }

        contents.push({
            role: 'user',
            parts: userParts,
        });

        const startTime = Date.now();
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

        const latencyMs = Date.now() - startTime;
        const rawText = response.text || '';
        const parsed = parseDerekResponse(rawText);

        // Fetch optional GIF for Derek's reaction (non-blocking timeout); Boardroom mode stays GIF-free
        const gifUrl = parsed.reaction && derekMode !== 'boardroom' ? await fetchGifUrl(parsed.reaction).catch(() => null) : null;

        // Persist message history in memory and audit_logs (without base64 screenshot bloat)
        if (runId) {
            const updatedMessages = [
                ...priorMessages,
                { role: 'user', content: message, createdAt: new Date().toISOString() },
                { role: 'derek', content: parsed.response, reaction: parsed.reaction, gifUrl, createdAt: new Date().toISOString() },
            ];

            const cleanSnapshot = sanitizeSnapshotForDb(snapshot);
            if (cachedRun) {
                cachedRun.messages = updatedMessages;
            } else {
                memStore.set(runId, {
                    id: runId,
                    userId: user.id,
                    created_at: new Date().toISOString(),
                    status: 'completed',
                    snapshot: cleanSnapshot,
                    auditScope: dbRow?.auditScope || 'page',
                    derekMode: runDerekMode,
                    result: auditResult,
                    error_message: null,
                    messages: updatedMessages,
                });
            }

            serviceClient
                .from('audit_logs')
                .update({
                    metadata: {
                        status: 'completed',
                        snapshot: cleanSnapshot,
                        auditScope: cachedRun?.auditScope || dbRow?.auditScope || 'page',
                        derekMode: runDerekMode,
                        result: auditResult,
                        error_message: null,
                        messages: updatedMessages,
                    },
                })
                .eq('id', runId)
                .then(() => {}, () => {});
        }

        // Meter extension chat usage & cost against user account (non-blocking)
        logUsageAndCost(serviceClient, {
            userId: user.id,
            tier: effectiveTier,
            endpoint: '/api/extension/chat',
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            latencyMs,
            isDegradeMode: false,
            model: GEMINI_EXTENSION_MODEL,
        }).catch(() => {});

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
    const corsHeaders = getExtensionCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

