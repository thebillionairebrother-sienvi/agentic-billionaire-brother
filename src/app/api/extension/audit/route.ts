import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { Type } from '@google/genai';

function getCorsHeaders(request: Request) {
    const origin = request.headers.get('origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

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
        snapshot?.title,
        snapshot?.metaDescription,
        ...(snapshot?.h1 || []),
        ...(snapshot?.h2 || []),
        ...(snapshot?.ctaText || []),
    ].filter(Boolean).join(' ').toLowerCase();

    // Pricing blocks alone are not distinctive (SaaS plan pages have them too) —
    // require at least one product/ecommerce-specific keyword as well.
    const retailKeywords = ['shop', 'cart', 'checkout', 'shipping', 'add to cart', 'product', 'collection', 'sale', 'store'];
    return retailKeywords.some(k => haystack.includes(k));
}

export async function runAuditAnalysis(runId: string, snapshot: any, userId: string, auditScope: string = 'page') {
    const serviceClient = await createServiceClient();

    try {
        // Update status to 'processing'
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'processing',
                    snapshot,
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
            ? `\n\nSEASONAL CONTEXT: Today's date is ${today.toDateString()} (${getRetailSeasonHint(today)}). ` +
              `This page appears to sell physical/retail products. ALSO evaluate whether its copy, imagery cues, offers, and on-page SEO signals (headings, meta description, product/category naming) are aligned with the current retail season. ` +
              `Flag missed seasonal merchandising opportunities and suggest specific, concrete seasonal copy/SEO angles the page could adopt. Set seasonalRelevance.applicable to true and fill in the seasonal fields. ` +
              `If the page is not retail/ecommerce, set seasonalRelevance.applicable to false and leave the other seasonal fields empty.`
            : `\n\nThis page does not appear to be retail/ecommerce. Set seasonalRelevance.applicable to false and leave the other seasonal fields empty.`;
        const systemInstruction = DEREK_FULL_PROMPT + `\n\n` +
            `You are performing a ${isMultiPage ? 'complete website and multi-page conversion' : 'webpage quality, conversion,'} and legal technicality audit for a user's page snapshot. ` +
            `Review the HTML/DOM signals extracted from the active page ${isMultiPage ? 'and key sub-pages across the domain.' : '.'} ` +
            `Provide extremely blunt, strategic, and high-roi feedback in Derek's voice. ` +
            `Identify critical conversion leaks, cross-page funnel gaps, what they are doing right, and what they are doing wrong. ` +
            `In addition, perform a thorough LEGAL TECHNICALITIES & COMPLIANCE audit of the webpage/website. Evaluate privacy disclaimers, Terms of Service visibility, earnings disclaimers, FTC compliance, CAN-SPAM rules, cookie/GDPR compliance cues, refund policies, deceptive guarantees, or dark patterns. ` +
            seasonalInstruction +
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
            `Analyze this ${scopeTitle} snapshot, evaluate conversion performance, and perform Derek's Legal & Compliance technicality audit.`;

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: userPrompt,
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

        const rawText = response.text || '';
        const result = JSON.parse(rawText.trim());

        // Update status to 'completed' with the result
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'completed',
                    snapshot,
                    auditScope,
                    result,
                    error_message: null
                }
            })
            .eq('id', runId);

        console.log(`[extension/audit] Job ${runId} completed successfully.`);
    } catch (err: any) {
        console.error(`[extension/audit] Job ${runId} failed:`, err);
        
        // Update status to 'failed' with error message
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'failed',
                    snapshot,
                    auditScope,
                    result: null,
                    error_message: err.message || 'Unknown audit error'
                }
            })
            .eq('id', runId);
    }
}

export async function POST(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const { supabase, user } = await createMobileAwareClient(request);
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        // Verify Brother or Team Plan subscription using service client
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
                { error: 'An active Brother or Team plan subscription is required to run audits with the extension.' },
                { status: 403, headers: corsHeaders }
            );
        }

        const body = await request.json();
        const { snapshot, auditScope = 'page' } = body;

        if (!snapshot) {
            return NextResponse.json(
                { error: 'Missing snapshot parameter' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Insert new audit log record
        const { data: auditLog, error: dbError } = await serviceClient
            .from('audit_logs')
            .insert({
                user_id: user.id,
                action: 'extension_audit',
                entity_type: 'run',
                metadata: {
                    status: 'queued',
                    snapshot,
                    auditScope,
                    result: null,
                    error_message: null
                }
            })
            .select('id')
            .single();

        if (dbError || !auditLog) {
            throw dbError || new Error('Failed to create audit log entry');
        }

        const runId = auditLog.id;

        // Trigger analysis in background asynchronously (do not await)
        runAuditAnalysis(runId, snapshot, user.id, auditScope).catch(err => {
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
    const corsHeaders = getCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
