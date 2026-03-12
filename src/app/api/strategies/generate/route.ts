import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { ThinkingLevel } from '@google/genai';
import { buildAiContext, GuardError, guardErrorResponse, logUsageAndCost } from '@/lib/middleware';

// Allow up to 120s for strategy generation
export const maxDuration = 120;

/**
 * Safely extract a JSON object from text that may contain markdown fences or chat wrapping.
 */
function extractJSON(text: string): Record<string, unknown> {
    const cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // Try direct parse first
    try {
        return JSON.parse(cleaned);
    } catch {
        // Try extracting from first { to last }
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        if (first !== -1 && last > first) {
            return JSON.parse(cleaned.substring(first, last + 1));
        }
        throw new Error(`No valid JSON found. Preview: "${cleaned.substring(0, 120)}..."`);
    }
}

export async function POST(request: Request) {
    let jobId: string | null = null;
    let serviceClient: Awaited<ReturnType<typeof createServiceClient>> | null = null;

    try {
        console.log('[strategies/generate] ── Starting strategy generation ──');
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[strategies/generate] Auth failed:', authError);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('[strategies/generate] User:', user.id);

        const body = await request.json();
        const businessProfileId = body.business_profile_id;

        // ── Guardrail Gate ──
        const ctx = await buildAiContext(supabase, user);
        console.log('[strategies/generate] Guardrails OK. Tier:', ctx.tier, 'Degrade:', ctx.isDegradeMode);

        if (ctx.isDegradeMode) {
            return NextResponse.json({
                error_code: 'DEGRADE_MODE',
                user_message: "You're approaching your sprint budget. Focus on execution.",
                retry_allowed: false,
            }, { status: 429 });
        }

        // ── Dedupe: skip only if there's a RECENT ACTIVE job (not failed/completed) ──
        const { data: activeJob } = await supabase
            .from('generation_jobs')
            .select('id, created_at, status')
            .eq('user_id', user.id)
            .eq('job_type', 'strategies')
            .in('status', ['processing', 'queued'])
            .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (activeJob) {
            console.log('[strategies/generate] Dedup — active job found:', activeJob.id);
            return NextResponse.json({
                jobId: activeJob.id,
                message: 'Strategy generation already in progress',
            });
        }

        serviceClient = await createServiceClient();

        // ── Create decision row ──
        const { data: decision, error: decisionError } = await serviceClient
            .from('decisions')
            .insert({
                user_id: user.id,
                business_profile_id: businessProfileId,
                status: 'generating',
            })
            .select('id')
            .single();

        if (decisionError) throw decisionError;
        console.log('[strategies/generate] Decision created:', decision!.id);

        // ── Create generation job ──
        const { data: job, error: jobError } = await serviceClient
            .from('generation_jobs')
            .insert({
                user_id: user.id,
                job_type: 'strategies',
                reference_id: decision!.id,
                status: 'processing',
                started_at: new Date().toISOString(),
                attempts: 1,
            })
            .select('id')
            .single();

        if (jobError) throw jobError;
        jobId = job!.id;
        console.log('[strategies/generate] Job created:', jobId);

        // ── Load profiles ──
        const { data: businessProfile } = await serviceClient
            .from('business_profiles')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const { data: founderProfile } = await serviceClient
            .from('founder_profiles')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!businessProfile) {
            throw new Error('Business profile not found for user ' + user.id);
        }
        console.log('[strategies/generate] Profile loaded:', businessProfile.business_name);

        // ── Build the prompt ──
        const userContext = {
            business_name: businessProfile.business_name || 'Unnamed Business',
            business_stage: businessProfile.business_state || 'idea',
            industry: businessProfile.industry || 'General',
            current_revenue: businessProfile.current_revenue_range || 'Pre-revenue',
            strengths: businessProfile.strengths || [],
            weaknesses: businessProfile.weaknesses || [],
            risk_tolerance: businessProfile.risk_tolerance || 'moderate',
            hours_per_week: businessProfile.hours_per_week || 10,
            monthly_budget: businessProfile.monthly_budget_range || '$0',
            no_go_constraints: businessProfile.no_go_constraints || [],
            target_audience: businessProfile.target_audience || '',
            existing_assets: businessProfile.existing_assets || [],
            additional_context: businessProfile.additional_context || '',
            team_size: founderProfile?.team_size || 'solo',
            va_count: founderProfile?.va_count || 0,
        };

        const strategyPrompt = `Generate exactly 3 ranked business strategy options for this founder. Return ONLY valid JSON — no markdown, no explanation, no text before or after the JSON.

FOUNDER CONTEXT:
${JSON.stringify(userContext, null, 2)}

For each strategy, compute a Decision Score (0-100) using these weighted factors:
- Market Fit (25%): demand signals, audience clarity, competition
- Resource Alignment (20%): hours, budget, skills match
- Speed to Revenue (20%): time to first dollar
- Founder Fit (15%): matches strengths, avoids no-go constraints
- Risk Profile (10%): downside vs stated tolerance
- Scalability (10%): growth ceiling

CONSTRAINTS:
- NEVER recommend anything in the founder's no_go_constraints list
- Weekly time in the 7-day plan must not exceed ${userContext.hours_per_week} hours

Return this exact JSON structure:
{
  "strategies": [
    {
      "rank": 1,
      "archetype": "Strategy Name",
      "thesis": "2-3 sentence explanation of why this strategy fits",
      "channel_focus": ["channel1", "channel2"],
      "offer_shape": "Description of the offer/product shape",
      "first_7_day_plan": [
        {"day": 1, "task": "Specific task", "owner": "founder", "time_mins": 60},
        {"day": 2, "task": "Specific task", "owner": "founder", "time_mins": 45},
        {"day": 3, "task": "Specific task", "owner": "founder", "time_mins": 60},
        {"day": 4, "task": "Specific task", "owner": "founder", "time_mins": 30},
        {"day": 5, "task": "Specific task", "owner": "founder", "time_mins": 45},
        {"day": 6, "task": "Specific task", "owner": "founder", "time_mins": 30},
        {"day": 7, "task": "Specific task", "owner": "founder", "time_mins": 30}
      ],
      "risks": ["risk1", "risk2"],
      "mitigations": ["mitigation1", "mitigation2"],
      "kpis": ["KPI 1", "KPI 2", "KPI 3"],
      "decision_score": 78,
      "confidence": "high",
      "score_breakdown": {
        "breakdown": [
          {"category": "market_fit", "weight": 0.25, "score": 80, "weighted_score": 20.0, "rationale": "Why this score"},
          {"category": "resource_alignment", "weight": 0.20, "score": 75, "weighted_score": 15.0, "rationale": "Why this score"},
          {"category": "speed_to_revenue", "weight": 0.20, "score": 70, "weighted_score": 14.0, "rationale": "Why this score"},
          {"category": "founder_fit", "weight": 0.15, "score": 85, "weighted_score": 12.75, "rationale": "Why this score"},
          {"category": "risk_profile", "weight": 0.10, "score": 60, "weighted_score": 6.0, "rationale": "Why this score"},
          {"category": "scalability", "weight": 0.10, "score": 70, "weighted_score": 7.0, "rationale": "Why this score"}
        ],
        "disclaimer": "Decision Score is a model-based estimate, not a guarantee."
      },
      "assumptions": [
        {"text": "Assumption text", "category": "market", "risk_level": "low"}
      ]
    }
  ]
}

Generate 3 strategies ranked from best fit (rank 1) to least fit (rank 3). Each must have all fields shown above.`;

        // ── Call Gemini with retry ──
        let rawText = '';
        const MAX_ATTEMPTS = 3;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                console.log(`[strategies/generate] Gemini attempt ${attempt}/${MAX_ATTEMPTS}...`);
                const t0 = Date.now();

                const response = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    config: {
                        systemInstruction: DEREK_FULL_PROMPT,
                        responseMimeType: 'application/json',
                        maxOutputTokens: ctx.maxOutputTokens,
                        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
                    },
                    contents: [{ role: 'user', parts: [{ text: strategyPrompt }] }],
                });

                const latencyMs = Date.now() - t0;
                rawText = response.text || '';
                console.log(`[strategies/generate] Gemini responded in ${latencyMs}ms (${rawText.length} chars)`);

                // Log usage (non-fatal)
                logUsageAndCost(supabase, {
                    userId: user.id,
                    tier: ctx.tier,
                    endpoint: '/api/strategies/generate',
                    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
                    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
                    latencyMs,
                    isDegradeMode: ctx.isDegradeMode,
                }).catch((e) => console.warn('[strategies/generate] Usage log failed:', e));

                break; // success
            } catch (err) {
                console.error(`[strategies/generate] Gemini FAILED attempt ${attempt}:`, err);
                if (attempt < MAX_ATTEMPTS) {
                    await new Promise((r) => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw err;
            }
        }

        if (!rawText) {
            throw new Error('Gemini returned empty response after all retry attempts');
        }

        // ── Parse AI response ──
        console.log('[strategies/generate] Parsing JSON...');
        let parsed: Record<string, unknown>;
        try {
            parsed = extractJSON(rawText);
        } catch (parseError) {
            console.error('[strategies/generate] JSON parse failed. Raw response (first 500 chars):', rawText.substring(0, 500));
            throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strategies = (parsed as any).strategies;

        if (!Array.isArray(strategies) || strategies.length === 0) {
            console.error('[strategies/generate] No strategies array. Keys:', Object.keys(parsed), 'Raw:', rawText.substring(0, 300));
            throw new Error('AI response missing strategies array');
        }
        console.log(`[strategies/generate] ✅ Parsed ${strategies.length} strategies`);

        // ── Store strategy options ──
        for (const strategy of strategies) {
            const { error: insertError } = await serviceClient.from('strategy_options').insert({
                decision_id: decision!.id,
                rank: strategy.rank || strategies.indexOf(strategy) + 1,
                archetype: strategy.archetype || 'Unnamed Strategy',
                thesis: strategy.thesis || '',
                channel_focus: strategy.channel_focus || [],
                offer_shape: strategy.offer_shape || '',
                first_7_day_plan: strategy.first_7_day_plan || [],
                risks: strategy.risks || [],
                mitigations: strategy.mitigations || [],
                kpis: strategy.kpis || [],
                decision_score: typeof strategy.decision_score === 'number' ? Math.round(strategy.decision_score) : 50,
                confidence: ['high', 'medium', 'low'].includes(strategy.confidence) ? strategy.confidence : 'medium',
                score_breakdown: strategy.score_breakdown || null,
                assumptions: strategy.assumptions || [],
                raw_ai_output: strategy,
            });

            if (insertError) {
                console.error('[strategies/generate] Insert error for strategy:', strategy.rank, insertError);
                throw insertError;
            }
        }

        // ── Update decision → ready ──
        await serviceClient
            .from('decisions')
            .update({ status: 'ready' })
            .eq('id', decision!.id);

        // ── Mark job completed ──
        await serviceClient
            .from('generation_jobs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);

        console.log('[strategies/generate] ✅ DONE! Job:', jobId, 'Decision:', decision!.id);

        return NextResponse.json({
            jobId,
            decisionId: decision!.id,
            success: true,
        });

    } catch (error) {
        // CRITICAL: Mark job as failed so the frontend stops polling
        if (jobId && serviceClient) {
            console.error('[strategies/generate] ❌ Marking job FAILED:', jobId);
            try {
                await serviceClient
                    .from('generation_jobs')
                    .update({
                        status: 'failed',
                        error_message: error instanceof Error ? error.message : 'Unknown error',
                        completed_at: new Date().toISOString(),
                    })
                    .eq('id', jobId);
            } catch (e) {
                console.error('[strategies/generate] Could not update job status:', e);
            }
        }

        if (error instanceof GuardError) {
            return NextResponse.json(guardErrorResponse(error), { status: error.statusCode });
        }

        console.error('[strategies/generate] ❌ FATAL:', error);
        return NextResponse.json(
            { error: 'Failed to generate strategies. Please try again.' },
            { status: 500 }
        );
    }
}
