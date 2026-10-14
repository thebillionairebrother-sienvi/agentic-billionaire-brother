import { NextResponse } from 'next/server';
import { createServiceClient, isTransientSupabaseError } from '@/lib/supabase/server';
import {
    getExtensionCorsHeaders,
    getExtensionRunMemoryStore,
    getExtensionUser,
    resolveExtensionUserPlan,
    sanitizeSnapshotForDb,
} from '@/lib/extension-auth';
import ai, { GEMINI_EXTENSION_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { Type } from '@google/genai';
import { logUsageAndCost } from '@/lib/middleware/meter-logger';
import { checkUsageGuard } from '@/lib/middleware/usage-guard';
import { GuardError } from '@/lib/middleware/types';
import type { Tier } from '@/lib/ai-config';

const RETAIL_SEASON_HINTS: Record<number, string> = {
    0: 'Winter clearance / New Year, New You',
    1: "Valentine's Day into early spring",
    2: 'Early spring, spring break travel',
    3: 'Spring, Easter, spring refresh',
    4: 'Late spring, Mother\'s Day, wedding season ramp-up',
    5: 'Early summer, Father\'s Day, summer kickoff',
    6: 'Peak summer',
    7: 'Late summer, back-to-school',
    8: 'Early fall, back-to-school tail, football season',
    9: 'Fall, Halloween, harvest/pumpkin season',
    10: 'Late fall, Thanksgiving, Black Friday/Cyber Monday lead-up',
    11: 'Holiday season, Christmas/Hanukkah, year-end gifting',
};

function getRetailSeasonHint(date: Date): string {
    return RETAIL_SEASON_HINTS[date.getMonth()] || 'current retail season';
}

function looksLikeRetail(snapshot: any): boolean {
    const haystack = [
        snapshot?.url,
        snapshot?.title,
        snapshot?.metaDescription,
        ...(snapshot?.h1 || []),
        ...(snapshot?.h2 || []),
        ...(snapshot?.ctaText || []),
    ].filter(Boolean).join(' ').toLowerCase();

    // Explicitly exclude medical devices, clinical equipment, pharmaceuticals, and B2B industrial sites
    // where consumer seasonal merchandising is inappropriate
    const nonRetailKeywords = [
        'medical', 'clinical', 'hospital', 'patient', 'respiratory', 'oxygen',
        'tubing', 'therapy', 'pharmaceutical', 'surgical', 'diagnostic', 'healthcare',
        'doctor', 'physician', 'prescription', 'cannula', 'cpap', 'b2b industrial',
        'machinery', 'emergency care'
    ];
    if (nonRetailKeywords.some(k => haystack.includes(k))) {
        return false;
    }

    // Pricing blocks alone are not distinctive (SaaS plan pages have them too) —
    // require at least one product/ecommerce-specific keyword as well.
    const retailKeywords = ['shop', 'cart', 'checkout', 'shipping', 'add to cart', 'product', 'collection', 'sale', 'store'];
    return retailKeywords.some(k => haystack.includes(k));
}

async function generateWithRetry(primaryModel: string, args: any) {
    const candidateModels = Array.from(
        new Set([primaryModel, 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'])
    );
    let lastError: any = null;

    for (const model of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                return await ai.models.generateContent({
                    model,
                    ...args,
                });
            } catch (err: any) {
                lastError = err;
                const is503Unavailable =
                    err?.status === 503 ||
                    err?.message?.includes('503') ||
                    err?.message?.includes('high demand') ||
                    err?.message?.includes('UNAVAILABLE');
                if (is503Unavailable && attempt === 0) {
                    console.warn(`[extension/audit] Model ${model} busy (503), retrying in 600ms...`);
                    await new Promise(r => setTimeout(r, 600));
                    continue;
                }
                console.warn(`[extension/audit] Model ${model} failed (${err?.status || err?.message}). Trying next fallback...`);
                break;
            }
        }
    }
    throw lastError || new Error(`Failed to generate content from ${primaryModel}`);
}

export async function runAuditAnalysis(runId: string, snapshot: any, userId: string, auditScope: string = 'page', userTier: string = 'brother') {
    const serviceClient = await createServiceClient();
    const dbSnapshot = sanitizeSnapshotForDb(snapshot);
    const memStore = getExtensionRunMemoryStore();
    const existingMem = memStore.get(runId);
    if (existingMem) {
        existingMem.status = 'processing';
    }

    try {
        // Update status to 'processing' (using lightweight dbSnapshot without base64 blobs)
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'processing',
                    snapshot: dbSnapshot,
                    auditScope,
                    result: null,
                    error_message: null
                }
            })
            .eq('id', runId);

        console.log(`[extension/audit] Job ${runId} (Scope: ${auditScope}) started processing...`);

        // Prepare the prompt for Gemini
        const isMultiPage = auditScope === 'domain' || auditScope === 'subpath';
        const isRetail = looksLikeRetail(snapshot);
        const today = new Date();
        const seasonalInstruction = isRetail
            ? `\n\nSEASONAL CONTEXT & MERCHANDISING APPLICABILITY:
Today's date is ${today.toDateString()} (${getRetailSeasonHint(today)}).
First, evaluate whether seasonal merchandising legitimately applies to the products or services offered on this site:
- APPLICABLE (Consumer Retail / Lifestyle): Consumer goods whose purchase behavior naturally hinges on seasons, holidays, weather transitions, or consumer promotional calendars (e.g. fashion/apparel, gifts, seasonal decor, holiday merchandise, seasonal sports/outdoor gear, back-to-school, Q4 gifting/Black Friday, seasonal fitness).
- NOT APPLICABLE (Medical / Clinical / Healthcare / B2B): Medical devices, healthcare equipment, respiratory therapy & supplies (such as oxygen tubing or clinical solutions like OxiSure Tech Solutions), pharmaceuticals, clinical lab equipment, emergency medical supplies, B2B industrial hardware, legal/accounting services, or evergreen software. For these categories, seasonal promotions, holiday sales ribbons, or festive merchandising gimmicks are completely inappropriate, irrelevant, and actively undermine clinical authority and professional credibility.

STRICT RULES FOR seasonalRelevance:
- If the offerings are medical devices, clinical supplies, healthcare equipment, emergency products, B2B industrial goods, or evergreen necessities where seasonal promotions are inappropriate: YOU MUST set seasonalRelevance.applicable to false, and leave currentSeason, misalignment, and suggestedSeasonalMoves as empty arrays or null. Do NOT fabricate seasonal advice or friction for medical/clinical sites.
- ONLY set seasonalRelevance.applicable to true if the business legitimately sells consumer retail goods where seasonal promotions and retail calendar merchandising are standard and effective. If true, evaluate whether copy, promotional visual banners, and offers match the current retail season (${getRetailSeasonHint(today)}), identify any outdated seasonal assets, and suggest concrete high-ROI seasonal angles.`
            : `\n\nSEASONAL CONTEXT: This page is not consumer retail/ecommerce (it may be SaaS, medical/clinical, B2B, evergreen content, or specialized services). Set seasonalRelevance.applicable to false and leave other seasonal fields empty.`;

        const visionInstruction = snapshot.screenshot
            ? `\n\nVISUAL & MULTIMODAL AUDIT INSTRUCTIONS: ` +
              `A high-resolution visual screenshot of the webpage is provided with this audit. ` +
              `You must directly look at the visual imagery, layout, typography, and graphics! Pay special attention to: ` +
              `1) Promotional banners, badges, hero imagery, and text embedded inside images. For consumer retail, check if seasonal banners and promotions are fresh or outdated. For medical/clinical or B2B sites, check whether visual banners maintain appropriate professional credibility and clarity without inappropriate retail gimmicks. ` +
              `2) Visual contrast, button prominence, above-the-fold clarity, and whether text-in-images is legible or cluttered. ` +
              `3) Misalignment between visual banners and on-page text (e.g., banner announces an expired sale or conflicting pricing). ` +
              `You MUST reflect these visual findings in whatThisPageSells, whatIsStrong, whatIsWeak, topConversionLeaks, and seasonalRelevance (only if applicable).`
            : '';

        const systemInstruction = DEREK_FULL_PROMPT + `\n\n` +
            `You are performing a ${isMultiPage ? 'complete website and multi-page conversion' : 'webpage quality, conversion,'} and legal technicality audit for a user's page snapshot. ` +
            `Review the HTML/DOM signals extracted from the active page ${isMultiPage ? 'and key sub-pages across the domain.' : '.'} ` +
            `Provide extremely blunt, strategic, and high-roi feedback in Derek's voice. ` +
            `Identify critical conversion leaks, cross-page funnel gaps, what they are doing right, and what they are doing wrong. ` +
            `In addition, perform a thorough LEGAL TECHNICALITIES & COMPLIANCE audit of the webpage/website. Evaluate privacy disclaimers, Terms of Service visibility, earnings disclaimers, FTC compliance, CAN-SPAM rules, cookie/GDPR compliance cues, refund policies, deceptive guarantees, or dark patterns. ` +
            seasonalInstruction +
            visionInstruction +
            `\n\nYou must return a structured JSON response matching the required schema. Do not include markdown wraps or anything other than the JSON object.`;

        let subPagesText = '';
        if (snapshot.subPages && Array.isArray(snapshot.subPages) && snapshot.subPages.length > 0) {
            subPagesText = `\n\nCross-analyzed Sub-Pages Data (${snapshot.subPages.length} additional pages scanned on site):\n` +
                snapshot.subPages.map((sub: any, idx: number) => 
                    `Sub-page #${idx + 1}: ${sub.url}\n` +
                    `Title: ${sub.title}\n` +
                    `Hero: "${sub.heroCopy}"\n` +
                    `CTAs: ${JSON.stringify(sub.ctaText)}\n` +
                    `Pricing: ${JSON.stringify(sub.pricingBlocks)}`
                ).join('\n---\n');
        }

        const scopeTitle = auditScope === 'domain' ? 'ENTIRE WEBSITE / DOMAIN' : auditScope === 'subpath' ? 'SUB-PAGES PATH' : 'SINGLE ACTIVE PAGE';

        const userPrompt = `Audit Target Scope: ${scopeTitle}\n` +
            `Here is the PageSnapshot payload extracted from the page:\n` +
            `URL: ${snapshot.url}\n` +
            `Title: ${snapshot.title}\n` +
            `Meta Description: ${snapshot.metaDescription}\n` +
            `H1 headings: ${JSON.stringify(snapshot.h1)}\n` +
            `H2 headings: ${JSON.stringify(snapshot.h2)}\n` +
            `H3 headings: ${JSON.stringify(snapshot.h3)}\n` +
            `Hero text block: "${snapshot.heroCopy}"\n` +
            `Call-to-Action texts: ${JSON.stringify(snapshot.ctaText)}\n` +
            `Pricing elements: ${JSON.stringify(snapshot.pricingBlocks)}\n` +
            `Testimonials/Reviews: ${JSON.stringify(snapshot.testimonials)}\n` +
            `FAQs: ${JSON.stringify(snapshot.faqs)}\n` +
            `Form labels: ${JSON.stringify(snapshot.formLabels)}\n` +
            `Repeated phrases: ${JSON.stringify(snapshot.repeatedPhrases)}\n` +
            `User selected text: "${snapshot.selectedText}"\n` +
            `Visible button labels: ${JSON.stringify(snapshot.visibleButtonLabels)}` +
            `${subPagesText}\n\n` +
            `Analyze this ${scopeTitle} snapshot and attached visual screenshot, evaluate conversion performance, visual merchandising, and perform Derek's Legal & Compliance technicality audit.`;

        const parts: any[] = [{ text: userPrompt }];

        // Attach visual screenshot for Gemini 3.8 Flash multimodal inspection
        if (snapshot.screenshot && typeof snapshot.screenshot === 'string') {
            const base64Data = snapshot.screenshot.replace(/^data:image\/\w+;base64,/, '');
            const mimeType = snapshot.screenshot.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
            parts.push({
                inlineData: {
                    mimeType,
                    data: base64Data,
                }
            });
        }

        // Attach promo banner images if present (either base64 or by fetching URL directly)
        if (snapshot.promoImages && Array.isArray(snapshot.promoImages)) {
            for (const img of snapshot.promoImages.slice(0, 3)) {
                if (img.base64 && typeof img.base64 === 'string') {
                    const base64Data = img.base64.replace(/^data:image\/\w+;base64,/, '');
                    const mimeType = img.base64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
                    parts.push({
                        inlineData: {
                            mimeType,
                            data: base64Data,
                        }
                    });
                } else if (img.src && typeof img.src === 'string' && (img.src.startsWith('http') || img.src.startsWith('//'))) {
                    try {
                        const targetUrl = img.src.startsWith('//') ? `https:${img.src}` : img.src;
                        const imgRes = await fetch(targetUrl, { signal: AbortSignal.timeout(4000) });
                        if (imgRes.ok) {
                            const buffer = await imgRes.arrayBuffer();
                            if (buffer.byteLength > 500 && buffer.byteLength < 4_000_000) {
                                const base64Data = Buffer.from(buffer).toString('base64');
                                const mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
                                parts.push({
                                    inlineData: {
                                        mimeType,
                                        data: base64Data,
                                    }
                                });
                                console.log(`[extension/audit] Attached visual hero/promo banner from ${targetUrl}`);
                            }
                        }
                    } catch (e: any) {
                        console.warn(`[extension/audit] Could not fetch promo image from ${img.src}:`, e.message);
                    }
                }
            }
        }

        const startTime = Date.now();
        const response = await generateWithRetry(GEMINI_EXTENSION_MODEL, {
            contents: [{ role: 'user', parts }],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        whatThisPageSells: { type: Type.STRING },
                        whoItIsFor: { type: Type.STRING },
                        whatIsStrong: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        whatIsWeak: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        topConversionLeaks: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        bestNextMove: { type: Type.STRING },
                        legalTechnicalities: {
                            type: Type.OBJECT,
                            properties: {
                                summary: { type: Type.STRING },
                                dos: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                donts: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                complianceRisk: { type: Type.STRING }
                            },
                            required: ['summary', 'dos', 'donts', 'complianceRisk']
                        },
                        seasonalRelevance: {
                            type: Type.OBJECT,
                            properties: {
                                applicable: { type: Type.BOOLEAN },
                                currentSeason: { type: Type.STRING },
                                misalignment: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                },
                                suggestedSeasonalMoves: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING }
                                }
                            },
                            required: ['applicable']
                        }
                    },
                    required: ['whatThisPageSells', 'whoItIsFor', 'whatIsStrong', 'whatIsWeak', 'topConversionLeaks', 'bestNextMove', 'legalTechnicalities']
                }
            }
        });

        const latencyMs = Date.now() - startTime;
        const rawText = response.text || '';
        const result = JSON.parse(rawText.trim());

        const memStore = getExtensionRunMemoryStore();
        const existingRun = memStore.get(runId);
        memStore.set(runId, {
            id: runId,
            userId,
            created_at: existingRun?.created_at || new Date().toISOString(),
            status: 'completed',
            snapshot: dbSnapshot,
            auditScope,
            result,
            error_message: null,
            messages: existingRun?.messages || [],
        });

        // Update status to 'completed' with the result (never persist raw base64 screenshots)
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'completed',
                    snapshot: dbSnapshot,
                    auditScope,
                    result,
                    error_message: null
                }
            })
            .eq('id', runId)
            .then(() => {}, (dbErr: any) => console.warn('[extension/audit] Non-fatal DB update warning:', dbErr?.message));

        // Meter extension audit usage & cost against user account
        const effectiveTier: Tier = userTier === 'team' ? 'team' : 'brother';
        logUsageAndCost(serviceClient, {
            userId,
            tier: effectiveTier,
            endpoint: '/api/extension/audit',
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            latencyMs,
            isDegradeMode: false,
            model: GEMINI_EXTENSION_MODEL,
        }).catch(() => {});

        console.log(`[extension/audit] Job ${runId} completed successfully.`);
    } catch (err: any) {
        console.error(`[extension/audit] Job ${runId} failed:`, err);

        const memStore = getExtensionRunMemoryStore();
        const existingRun = memStore.get(runId);
        memStore.set(runId, {
            id: runId,
            userId,
            created_at: existingRun?.created_at || new Date().toISOString(),
            status: 'failed',
            snapshot: dbSnapshot,
            auditScope,
            result: null,
            error_message: err.message || 'Unknown audit error',
            messages: existingRun?.messages || [],
        });
        
        // Update status to 'failed' with error message
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'failed',
                    snapshot: dbSnapshot,
                    auditScope,
                    result: null,
                    error_message: err.message || 'Unknown audit error'
                }
            })
            .eq('id', runId)
            .then(() => {}, () => {});
    }
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

        // Verify Brother or Team Plan subscription using service client (with timeout resilience)
        const serviceClient = await createServiceClient();
        const { tier, hasRequiredPlan } = await resolveExtensionUserPlan(serviceClient, user);

        if (!hasRequiredPlan) {
            return NextResponse.json(
                { error: 'An active Brother or Team plan subscription is required to run audits with the extension.' },
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
            console.warn('[extension/audit] Usage guard check skipped due to transient DB issue:', guardErr?.message);
        }

        const body = await request.json();
        const { snapshot, auditScope = 'page' } = body;

        if (!snapshot) {
            return NextResponse.json(
                { error: 'Missing snapshot parameter' },
                { status: 400, headers: corsHeaders }
            );
        }

        const dbSnapshot = sanitizeSnapshotForDb(snapshot);
        const createdAt = new Date().toISOString();

        // Insert new audit log record (with stripped screenshot so JSONB stays tiny)
        let runId: string = crypto.randomUUID();
        try {
            const { data: auditLog, error: dbError } = await serviceClient
                .from('audit_logs')
                .insert({
                    user_id: user.id,
                    action: 'extension_audit',
                    entity_type: 'run',
                    metadata: {
                        status: 'queued',
                        snapshot: dbSnapshot,
                        auditScope,
                        result: null,
                        error_message: null
                    }
                })
                .select('id')
                .single();

            if (!dbError && auditLog?.id) {
                runId = auditLog.id;
            } else if (dbError) {
                console.warn('[extension/audit] DB insert warning, falling back to in-memory runId:', dbError.message);
            }
        } catch (insertErr: any) {
            console.warn('[extension/audit] DB insert timeout, falling back to in-memory runId:', insertErr?.message);
        }

        getExtensionRunMemoryStore().set(runId, {
            id: runId,
            userId: user.id,
            created_at: createdAt,
            status: 'queued',
            snapshot: dbSnapshot,
            auditScope,
            result: null,
            error_message: null,
            messages: [],
        });

        // Trigger analysis in background asynchronously (do not await)
        runAuditAnalysis(runId, snapshot, user.id, auditScope, tier).catch(err => {
            console.error(`[extension/audit] Background process error for job ${runId}:`, err);
        });

        return NextResponse.json(
            { runId },
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('[extension/audit] Request Error:', error);
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

