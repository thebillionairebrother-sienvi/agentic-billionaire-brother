import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
    getExtensionCorsHeaders,
    getExtensionRunMemoryStore,
    getExtensionUser,
    resolveExtensionUserPlan,
} from '@/lib/extension-auth';
import { GEMINI_EXTENSION_MODEL } from '@/lib/gemini';
import { generateExtensionContentWithRetry } from '@/lib/extension-gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { logUsageAndCost } from '@/lib/middleware/meter-logger';
import { checkUsageGuard } from '@/lib/middleware/usage-guard';
import { GuardError } from '@/lib/middleware/types';
import type { Tier } from '@/lib/ai-config';
import { DEFAULT_DEREK_MODE, formatDerekModeForPrompt, sanitizeDerekMode, type DerekMode } from '@/lib/extension-derek-mode';
import {
    BATTLE_ACTION,
    BATTLE_RESPONSE_SCHEMA,
    BATTLE_SCOPE,
    BATTLE_TASK_INSTRUCTION,
    buildBattleUserPrompt,
    sanitizeBattleResult,
    sanitizeBattleSnapshot,
    type BattleSnapshot,
} from '@/lib/extension-battle';

type RunStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** Writes the run to memory (always) and audit_logs (best effort; the memory store covers DB timeouts). */
async function saveBattleRun(
    serviceClient: any,
    runId: string,
    userId: string,
    you: BattleSnapshot,
    competitor: BattleSnapshot,
    derekMode: DerekMode,
    status: RunStatus,
    result: any,
    errorMessage: string | null,
) {
    const memStore = getExtensionRunMemoryStore();
    const existing = memStore.get(runId);
    memStore.set(runId, {
        id: runId,
        userId,
        created_at: existing?.created_at || new Date().toISOString(),
        status,
        snapshot: you,
        competitorSnapshot: competitor,
        auditScope: BATTLE_SCOPE,
        derekMode,
        result,
        error_message: errorMessage,
        messages: existing?.messages || [],
    });

    await serviceClient
        .from('audit_logs')
        .update({
            metadata: {
                status,
                snapshot: you,
                competitorSnapshot: competitor,
                auditScope: BATTLE_SCOPE,
                derekMode,
                result,
                error_message: errorMessage,
            },
        })
        .eq('id', runId)
        .then(() => {}, (dbErr: any) => console.warn('[extension/battle] Non-fatal DB update warning:', dbErr?.message));
}

async function runBattleAnalysis(
    runId: string,
    you: BattleSnapshot,
    competitor: BattleSnapshot,
    userId: string,
    userTier: string,
    derekMode: DerekMode = DEFAULT_DEREK_MODE,
) {
    const serviceClient = await createServiceClient();
    try {
        await saveBattleRun(serviceClient, runId, userId, you, competitor, derekMode, 'processing', null, null);
        console.log(`[extension/battle] Job ${runId} (Mode: ${derekMode}) started: ${you.url} vs ${competitor.url}`);

        const systemInstruction = DEREK_FULL_PROMPT + '\n\n' + BATTLE_TASK_INSTRUCTION + formatDerekModeForPrompt(derekMode);

        const startTime = Date.now();
        const response = await generateExtensionContentWithRetry(GEMINI_EXTENSION_MODEL, {
            contents: [{ role: 'user', parts: [{ text: buildBattleUserPrompt(you, competitor) }] }],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: BATTLE_RESPONSE_SCHEMA,
            },
        }, 'extension/battle');
        const latencyMs = Date.now() - startTime;

        const result = sanitizeBattleResult(JSON.parse((response.text || '').trim()));
        await saveBattleRun(serviceClient, runId, userId, you, competitor, derekMode, 'completed', result, null);

        const effectiveTier: Tier = userTier === 'team' ? 'team' : 'brother';
        logUsageAndCost(serviceClient, {
            userId,
            tier: effectiveTier,
            endpoint: '/api/extension/battle',
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            latencyMs,
            isDegradeMode: false,
            model: GEMINI_EXTENSION_MODEL,
        }).catch(() => {});

        console.log(`[extension/battle] Job ${runId} completed successfully.`);
    } catch (err: any) {
        console.error(`[extension/battle] Job ${runId} failed:`, err);
        await saveBattleRun(serviceClient, runId, userId, you, competitor, derekMode, 'failed', null, err?.message || 'Unknown battle error');
    }
}

export async function POST(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);

    try {
        const user = await getExtensionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        const serviceClient = await createServiceClient();
        const { tier, hasRequiredPlan } = await resolveExtensionUserPlan(serviceClient, user);
        if (!hasRequiredPlan) {
            return NextResponse.json(
                { error: 'An active Brother or Team plan subscription is required to run competitor battles with the extension.' },
                { status: 403, headers: corsHeaders }
            );
        }

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
            console.warn('[extension/battle] Usage guard check skipped due to transient DB issue:', guardErr?.message);
        }

        const body = await request.json().catch(() => ({}));
        const you = sanitizeBattleSnapshot(body?.snapshot);
        const competitor = sanitizeBattleSnapshot(body?.competitorSnapshot);
        const derekMode = sanitizeDerekMode(body?.derekMode);

        if (!you || !competitor) {
            return NextResponse.json(
                { error: 'Both your page and a competitor page snapshot are required.' },
                { status: 400, headers: corsHeaders }
            );
        }
        if (you.url === competitor.url) {
            return NextResponse.json(
                { error: 'Pick a different competitor tab: both tabs are the same page.' },
                { status: 400, headers: corsHeaders }
            );
        }

        let runId: string = crypto.randomUUID();
        try {
            const { data: auditLog, error: dbError } = await serviceClient
                .from('audit_logs')
                .insert({
                    user_id: user.id,
                    action: BATTLE_ACTION,
                    entity_type: 'run',
                    metadata: {
                        status: 'queued',
                        snapshot: you,
                        competitorSnapshot: competitor,
                        auditScope: BATTLE_SCOPE,
                        derekMode,
                        result: null,
                        error_message: null,
                    },
                })
                .select('id')
                .single();
            if (!dbError && auditLog?.id) runId = auditLog.id;
            else if (dbError) console.warn('[extension/battle] DB insert warning, falling back to in-memory runId:', dbError.message);
        } catch (insertErr: any) {
            console.warn('[extension/battle] DB insert timeout, falling back to in-memory runId:', insertErr?.message);
        }

        getExtensionRunMemoryStore().set(runId, {
            id: runId,
            userId: user.id,
            created_at: new Date().toISOString(),
            status: 'queued',
            snapshot: you,
            competitorSnapshot: competitor,
            auditScope: BATTLE_SCOPE,
            derekMode,
            result: null,
            error_message: null,
            messages: [],
        });

        // Background job; the extension polls /api/extension/runs/:id
        runBattleAnalysis(runId, you, competitor, user.id, tier, derekMode).catch(err => {
            console.error(`[extension/battle] Background process error for job ${runId}:`, err);
        });

        return NextResponse.json({ runId }, { status: 200, headers: corsHeaders });
    } catch (error: any) {
        console.error('[extension/battle] Request Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}
