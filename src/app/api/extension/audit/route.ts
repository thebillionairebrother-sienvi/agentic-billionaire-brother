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

export async function runAuditAnalysis(runId: string, snapshot: any, userId: string) {
    const serviceClient = await createServiceClient();

    try {
        // Update status to 'processing'
        await serviceClient
            .from('audit_logs')
            .update({
                metadata: {
                    status: 'processing',
                    snapshot,
                    result: null,
                    error_message: null
                }
            })
            .eq('id', runId);

        console.log(`[extension/audit] Job ${runId} started processing...`);

        // Prepare the prompt for Gemini
        const systemInstruction = DEREK_FULL_PROMPT + `\n\n` + 
            `You are performing a webpage quality and conversion audit for a user's page snapshot. ` +
            `Review the HTML/DOM signals extracted from the active page. ` +
            `Provide extremely blunt, strategic, and high-roi feedback in Derek's voice. ` +
            `Identify critical conversion leaks, what they are doing right, and what they are doing wrong. ` +
            `You must return a structured JSON response matching the required schema. Do not include markdown wraps or anything other than the JSON object.`;

        const userPrompt = `Here is the PageSnapshot payload extracted from the page:
URL: ${snapshot.url}
Title: ${snapshot.title}
Meta Description: ${snapshot.metaDescription}
H1 headings: ${JSON.stringify(snapshot.h1)}
H2 headings: ${JSON.stringify(snapshot.h2)}
H3 headings: ${JSON.stringify(snapshot.h3)}
Hero text block: "${snapshot.heroCopy}"
Call-to-Action texts: ${JSON.stringify(snapshot.ctaText)}
Pricing elements: ${JSON.stringify(snapshot.pricingBlocks)}
Testimonials/Reviews: ${JSON.stringify(snapshot.testimonials)}
FAQs: ${JSON.stringify(snapshot.faqs)}
Form labels: ${JSON.stringify(snapshot.formLabels)}
Repeated phrases: ${JSON.stringify(snapshot.repeatedPhrases)}
User selected text: "${snapshot.selectedText}"
Visible button labels: ${JSON.stringify(snapshot.visibleButtonLabels)}

Analyze this snapshot and give me the audit results.`;

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
                        bestNextMove: { type: Type.STRING }
                    },
                    required: ['whatThisPageSells', 'whoItIsFor', 'whatIsStrong', 'whatIsWeak', 'topConversionLeaks', 'bestNextMove']
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

        const body = await request.json();
        const { snapshot } = body;

        if (!snapshot) {
            return NextResponse.json(
                { error: 'Missing snapshot parameter' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Insert new audit log record
        const serviceClient = await createServiceClient();
        const { data: auditLog, error: dbError } = await serviceClient
            .from('audit_logs')
            .insert({
                user_id: user.id,
                action: 'extension_audit',
                entity_type: 'run',
                metadata: {
                    status: 'queued',
                    snapshot,
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
        runAuditAnalysis(runId, snapshot, user.id).catch(err => {
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
