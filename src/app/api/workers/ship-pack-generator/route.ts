import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import ai, { GEMINI_MODEL } from '@/lib/gemini';
import { DEREK_FULL_PROMPT } from '@/lib/system-prompt';
import { ThinkingLevel } from '@google/genai';
import { TIER_CONFIG, calculateEstimatedCost, getCurrentMonthStart } from '@/lib/ai-config';
import type { Tier } from '@/lib/ai-config';

/**
 * Extracts a JSON object from text that may contain conversational wrapping.
 */
function extractJSON(text: string): Record<string, unknown> {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (cleaned.startsWith('{')) return JSON.parse(cleaned);
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error(`No JSON found in response: "${cleaned.substring(0, 80)}..."`);
    }
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
}

interface WorkerPayload {
    jobId: string;
    cycleId: string;
    userId: string;
    decisionId: string;
}

export async function POST(request: Request) {
    const { jobId, cycleId, userId, decisionId }: WorkerPayload = await request.json();
    const supabase = await createServiceClient();

    try {
        // Mark job processing
        await supabase
            .from('generation_jobs')
            .update({ status: 'processing', started_at: new Date().toISOString(), attempts: 1 })
            .eq('id', jobId);

        // Fetch context
        const { data: decision } = await supabase
            .from('decisions')
            .select('chosen_strategy_id')
            .eq('id', decisionId)
            .single();

        const { data: strategy } = await supabase
            .from('strategy_options')
            .select('*')
            .eq('id', decision!.chosen_strategy_id)
            .single();

        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('*')
            .eq('user_id', userId)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        const { data: businessProfile } = await supabase
            .from('business_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const shipPackPrompt = `
You are a JSON-only API. Do NOT include any conversational text, greetings, or explanations outside the JSON.

TASK: Generate Week 1 Action Steps

LOCKED STRATEGY: ${strategy!.archetype}
THESIS: ${strategy!.thesis}
LOCKED KPI: ${contract!.locked_kpi}
WEEKLY DELIVERABLE: ${contract!.weekly_deliverable}
CALENDAR BLOCKS: ${contract!.calendar_blocks}
HOURS/WEEK: ${businessProfile?.hours_per_week || 10}
TEAM: ${businessProfile?.team_size || 'solo'}

Generate action steps with exactly:
- 2 big deliverables (substantial assets from departments)
- 5 small tasks (quick wins, setup tasks)

Each deliverable must have a department assignment from: competitive_intel, copy_conversion, seo_demand, business_plan, content_distribution

Total estimated time must NOT exceed the founder's hours/week budget.

OUTPUT FORMAT: Return ONLY the raw JSON object below. No markdown, no code fences, no introduction, no explanation — just the JSON:
{
  "week_number": 1,
  "kpi_target": "string - specific target for this week",
  "big_deliverables": [
    {
      "title": "string",
      "department": "competitive_intel|copy_conversion|seo_demand|business_plan|content_distribution",
      "description": "string",
      "estimated_hours": 2
    }
  ],
  "small_tasks": [
    {
      "title": "string",
      "description": "string",
      "assignee": "founder|va1|va2",
      "time_mins": 30,
      "day": 1
    }
  ],
  "total_estimated_hours": 8,
  "assumptions": [
    {"text": "string", "category": "market|resource|timing", "risk_level": "low|medium|high"}
  ]
}`;

        // Lookup user tier for token cap
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        const tier = (sub?.tier || 'brother') as Tier;
        // Action steps need more tokens than normal chat — enforce a minimum of 4096
        const maxOutputTokens = Math.max(TIER_CONFIG[tier].max_output_tokens, 4096);

        const MAX_ATTEMPTS = 3;
        let rawText = '';
        let response;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                response = await ai.models.generateContent({
                    model: GEMINI_MODEL,
                    config: {
                        systemInstruction: DEREK_FULL_PROMPT,
                        responseMimeType: 'application/json',
                        maxOutputTokens,
                        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
                    },
                    contents: [{ role: 'user', parts: [{ text: shipPackPrompt }] }],
                });

                rawText = response.text || '';

                // Validate JSON parses before proceeding
                extractJSON(rawText);
                console.log(`[ship-pack] ✅ Gemini attempt ${attempt} succeeded (${rawText.length} chars)`);
                break;
            } catch (err) {
                console.error(`[ship-pack] Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err instanceof Error ? err.message : err);
                if (attempt < MAX_ATTEMPTS) {
                    await new Promise((r) => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw err;
            }
        }

        const latencyMs = Date.now() - startTime;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = extractJSON(rawText) as any;

        // Update cycle
        await supabase
            .from('weekly_cycles')
            .update({
                status: 'active',
                kpi_target: parsed.kpi_target,
            })
            .eq('id', cycleId);

        // Insert big deliverables
        for (const deliverable of parsed.big_deliverables) {
            await supabase.from('deliverables').insert({
                weekly_cycle_id: cycleId,
                user_id: userId,
                department: deliverable.department,
                title: deliverable.title,
                size: 'big',
                status: 'ready',
                content: deliverable,
            });
        }

        // Insert small tasks as deliverables + tasks
        for (const task of parsed.small_tasks) {
            await supabase.from('tasks').insert({
                weekly_cycle_id: cycleId,
                user_id: userId,
                title: task.title,
                description: task.description,
                assignee: task.assignee,
                status: 'todo',
                sort_order: task.day,
            });
        }

        // Mark job completed
        await supabase
            .from('generation_jobs')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', jobId);

        // Log usage for this user
        const inputTokens = response?.usageMetadata?.promptTokenCount ?? 0;
        const outputTokens = response?.usageMetadata?.candidatesTokenCount ?? 0;
        const cost = calculateEstimatedCost(inputTokens, outputTokens);
        await supabase.from('request_logs').insert({
            user_id: userId, model: GEMINI_MODEL,
            input_tokens: inputTokens, output_tokens: outputTokens,
            latency_ms: latencyMs, estimated_cost: cost.budgeted,
            endpoint: '/api/workers/ship-pack-generator', tier, degrade_mode: false,
        });
        await supabase.rpc('increment_monthly_usage', {
            p_user_id: userId, p_month_start: getCurrentMonthStart(),
            p_tokens: inputTokens + outputTokens, p_prompts: 1, p_cost: cost.budgeted, p_is_regen: false,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Action steps worker error:', error);
        await supabase
            .from('generation_jobs')
            .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown error' })
            .eq('id', jobId);

        return NextResponse.json({ error: 'Action steps generation failed' }, { status: 500 });
    }
}
