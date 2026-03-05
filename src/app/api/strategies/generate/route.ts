import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';

// Allow up to 60s for strategy generation on Vercel
export const maxDuration = 60;

/**
 * Extracts a JSON object from text that may contain conversational wrapping.
 */
function extractJSON(text: string): Record<string, unknown> {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    if (cleaned.startsWith('{')) {
        return JSON.parse(cleaned);
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error(`No JSON object found in response. Response starts with: "${cleaned.substring(0, 80)}..."`);
    }

    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const businessProfileId = body.business_profile_id;

        // Dedupe check — no generation within 5 min window
        const { data: recentJob } = await supabase
            .from('generation_jobs')
            .select('id, created_at')
            .eq('user_id', user.id)
            .eq('job_type', 'strategies')
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (recentJob) {
            return NextResponse.json({
                jobId: recentJob.id,
                message: 'Strategy generation already in progress',
            });
        }

        const serviceClient = await createServiceClient();

        // Create decision row
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

        // Create generation job
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

        // ─── Run strategy generation INLINE (no fire-and-forget) ───

        // Fetch business + founder profiles
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
            throw new Error('Business profile not found');
        }

        const userContext = JSON.stringify({
            business: {
                name: businessProfile.business_name,
                state: businessProfile.business_state,
                industry: businessProfile.industry,
                revenue: businessProfile.current_revenue_range,
                strengths: businessProfile.strengths,
                weaknesses: businessProfile.weaknesses,
                risk_tolerance: businessProfile.risk_tolerance,
                hours_per_week: businessProfile.hours_per_week,
                monthly_budget: businessProfile.monthly_budget_range,
                no_go_constraints: businessProfile.no_go_constraints,
                target_audience: businessProfile.target_audience,
                existing_assets: businessProfile.existing_assets,
                additional_context: businessProfile.additional_context,
            },
            founder: {
                team_size: founderProfile?.team_size || 'solo',
                va_count: founderProfile?.va_count || 0,
                calendar_blocks: founderProfile?.calendar_blocks_available || 4,
                timezone: founderProfile?.timezone,
            },
        }, null, 2);

        const strategyPrompt = `
You are a JSON-only API. Do NOT include any conversational text, greetings, or explanations outside the JSON.

TASK: Generate 3 ranked strategy archetypes for this founder's business.

FOUNDER & BUSINESS CONTEXT:
${userContext}

INSTRUCTIONS:
1. Generate exactly 3 strategy archetypes, ranked from best fit (#1) to least fit (#3).
2. Each strategy must include a Decision Score (0-100) computed as:
   - Market Fit (25%): Demand signals, audience clarity, competition density
   - Resource Alignment (20%): Hours, budget, skills match
   - Speed to Revenue (20%): How fast to first dollar
   - Founder Fit (15%): Matches strengths, avoids constraints
   - Risk Profile (10%): Downside vs. stated tolerance
   - Scalability (10%): Growth ceiling after traction
3. Each strategy must include ALL of: archetype name, thesis, channel_focus, offer_shape, first_7_day_plan, phases, risks, mitigations, kpis, decision_score, confidence, score_breakdown, assumptions.
4. The first_7_day_plan must have exactly 7 entries with day, task, owner, and time_mins.
5. Total weekly time across all tasks must not exceed the founder's stated hours_per_week.
6. Respect ALL no_go_constraints — never recommend something the founder explicitly rejected.
7. Include a mandatory disclaimer: "Decision Score is a model-based estimate, not a guarantee."
8. Each strategy MUST include a "phases" array with exactly 3 phases:
   - Phase 1 "Foundation" (Weeks 1-5): Validate idea, build first offer, launch initial channel
   - Phase 2 "Growth" (Weeks 6-10): Scale what works, kill what doesn't, double down on traction
   - Phase 3 "Scale" (Weeks 11-15): Systemize, automate, explore secondary channels
   Each phase must include: phase_number, name, weeks, goal, milestones (3-5 items), focus_areas (2-3 items)

OUTPUT FORMAT: Return ONLY the raw JSON object below. No markdown, no code fences, no introduction, no explanation — just the JSON:
{
  "strategies": [
    {
      "rank": 1,
      "archetype": "string",
      "thesis": "string (2-3 sentences)",
      "channel_focus": ["string"],
      "offer_shape": "string",
      "first_7_day_plan": [
        {"day": 1, "task": "string", "owner": "founder|va1|va2", "time_mins": 60}
      ],
      "risks": ["string"],
      "mitigations": ["string"],
      "kpis": ["string"],
      "decision_score": 74,
      "confidence": "high|medium|low",
      "score_breakdown": {
        "breakdown": [
          {"category": "market_fit", "weight": 0.25, "score": 82, "weighted_score": 20.5, "rationale": "string"}
        ],
        "disclaimer": "Decision Score is a model-based estimate, not a guarantee."
      },
      "phases": [
        {
          "phase_number": 1,
          "name": "Foundation",
          "weeks": "1-5",
          "goal": "one-sentence phase goal",
          "milestones": ["milestone1", "milestone2", "milestone3"],
          "focus_areas": ["area1", "area2"]
        }
      ],
      "assumptions": [
        {"text": "string", "category": "market|resource|timing|financial", "risk_level": "low|medium|high"}
      ]
    }
  ]
}`;

        // Generate with retry
        let rawText = '';
        const MAX_ATTEMPTS = 2;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const response = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    config: {
                        systemInstruction: DEREK_FULL_PROMPT,
                        responseMimeType: 'application/json',
                    },
                    contents: [{ role: 'user', parts: [{ text: strategyPrompt }] }],
                });

                rawText = response.text || '';
                break;
            } catch (err) {
                console.error(`Strategy generation failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, err);
                if (attempt < MAX_ATTEMPTS) {
                    await new Promise((r) => setTimeout(r, 3000));
                    continue;
                }
                throw err;
            }
        }

        // Parse JSON
        const parsed = extractJSON(rawText);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strategies = (parsed as any).strategies;

        if (!Array.isArray(strategies) || strategies.length === 0) {
            throw new Error(`Invalid response: expected strategies array, got ${typeof strategies}`);
        }

        // Store strategy options
        for (const strategy of strategies) {
            const defaultPhases = [
                { phase_number: 1, name: 'Foundation', weeks: '1-5', goal: 'Validate idea, build first offer, launch initial channel.', milestones: ['Define target customer', 'Launch MVP', 'First paying customer'], focus_areas: ['Validation', 'Launch'] },
                { phase_number: 2, name: 'Growth', weeks: '6-10', goal: 'Scale what works, optimize conversion, build pipeline.', milestones: ['Double down on best channel', 'Optimize funnel', 'Hit revenue milestone'], focus_areas: ['Traction', 'Optimization'] },
                { phase_number: 3, name: 'Scale', weeks: '11-15', goal: 'Systemize, automate, expand to new channels.', milestones: ['Automate key workflow', 'Launch second channel', 'Establish brand'], focus_areas: ['Automation', 'Expansion'] },
            ];

            await serviceClient.from('strategy_options').insert({
                decision_id: decision!.id,
                rank: strategy.rank,
                archetype: strategy.archetype,
                thesis: strategy.thesis,
                channel_focus: strategy.channel_focus,
                offer_shape: strategy.offer_shape,
                first_7_day_plan: strategy.first_7_day_plan,
                risks: strategy.risks,
                mitigations: strategy.mitigations,
                kpis: strategy.kpis,
                decision_score: strategy.decision_score,
                confidence: strategy.confidence,
                score_breakdown: strategy.score_breakdown,
                phases: (Array.isArray(strategy.phases) && strategy.phases.length === 3) ? strategy.phases : defaultPhases,
                assumptions: strategy.assumptions,
                raw_ai_output: strategy,
            });
        }

        // Update decision status to ready
        await serviceClient
            .from('decisions')
            .update({ status: 'ready' })
            .eq('id', decision!.id);

        // Mark job completed
        await serviceClient
            .from('generation_jobs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', job!.id);

        return NextResponse.json({
            jobId: job!.id,
            decisionId: decision!.id,
            success: true,
        });
    } catch (error) {
        console.error('Strategy generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate strategies. Please try again.' },
            { status: 500 }
        );
    }
}
