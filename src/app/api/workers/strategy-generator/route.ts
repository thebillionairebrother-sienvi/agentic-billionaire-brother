import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import openai, { ASSISTANT_ID } from '@/lib/openai';

/**
 * Extracts a JSON object from text that may contain conversational wrapping.
 * Finds the outermost { ... } block in the response.
 */
function extractJSON(text: string): Record<string, unknown> {
    // 1. Strip markdown code fences
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // 2. If it starts with '{', try parsing directly
    if (cleaned.startsWith('{')) {
        return JSON.parse(cleaned);
    }

    // 3. Find the first '{' and last '}' to extract JSON from conversational text
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error(`No JSON object found in response. Response starts with: "${cleaned.substring(0, 80)}..."`);
    }

    const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonStr);
}

interface WorkerPayload {
    jobId: string;
    decisionId: string;
    userId: string;
}

export async function POST(request: Request) {
    const { jobId, decisionId, userId }: WorkerPayload = await request.json();
    const supabase = await createServiceClient();

    try {
        // Mark job as processing
        await supabase
            .from('generation_jobs')
            .update({ status: 'processing', started_at: new Date().toISOString(), attempts: 1 })
            .eq('id', jobId);

        // Fetch business + founder profiles
        const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const { data: founderProfile } = await supabase
            .from('founder_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!businessProfile) {
            throw new Error('Business profile not found');
        }

        // Compose the prompt
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

        // Create Thread + Run
        const thread = await openai.beta.threads.create();

        await openai.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: strategyPrompt,
        });

        let run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: ASSISTANT_ID,
        });

        // Poll for completion (timeout: 120s)
        const timeout = Date.now() + 120_000;
        while (run.status === 'in_progress' || run.status === 'queued') {
            if (Date.now() > timeout) {
                throw new Error('Strategy generation timed out');
            }
            await new Promise((r) => setTimeout(r, 2000));
            run = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
        }

        if (run.status !== 'completed') {
            throw new Error(`Run failed with status: ${run.status}`);
        }

        // Get response
        const messages = await openai.beta.threads.messages.list(thread.id, {
            order: 'desc',
            limit: 1,
        });

        const assistantMessage = messages.data[0];
        if (!assistantMessage || assistantMessage.role !== 'assistant') {
            throw new Error('No assistant response found');
        }

        const textContent = assistantMessage.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text content in response');
        }

        // Parse JSON (robust extraction handles conversational wrapping)
        const rawText = textContent.text.value;
        const parsed = extractJSON(rawText);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strategies = (parsed as any).strategies;

        if (!Array.isArray(strategies) || strategies.length !== 3) {
            throw new Error('Invalid response: expected 3 strategies');
        }

        // Store strategy options
        for (const strategy of strategies) {
            await supabase.from('strategy_options').insert({
                decision_id: decisionId,
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
                phases: strategy.phases || [],
                assumptions: strategy.assumptions,
                raw_ai_output: strategy,
            });
        }

        // Update decision with thread_id and status
        await supabase
            .from('decisions')
            .update({ status: 'ready', thread_id: thread.id })
            .eq('id', decisionId);

        // Mark job completed
        await supabase
            .from('generation_jobs')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', jobId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Strategy worker error:', error);

        // Mark job as failed
        await supabase
            .from('generation_jobs')
            .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('id', jobId);

        return NextResponse.json(
            { error: 'Strategy generation failed' },
            { status: 500 }
        );
    }
}
