/**
 * AI Middleware — Meter Logger
 * Logs every AI request's cost and increments usage counters atomically.
 * This runs AFTER the Gemini call completes, BEFORE the response is returned.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { calculateEstimatedCost, getCurrentMonthStart, TIER_CONFIG } from '@/lib/ai-config';
import type { Tier } from '@/lib/ai-config';
import { GEMINI_MODEL } from '@/lib/gemini';

export interface MeterLogEntry {
    userId: string;
    tier: Tier;
    endpoint: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    workflowRunId?: string;
    isDegradeMode: boolean;
    isRegen?: boolean;
}

export async function logUsageAndCost(
    supabase: SupabaseClient,
    entry: MeterLogEntry
): Promise<void> {
    try {
        const cost = calculateEstimatedCost(entry.inputTokens, entry.outputTokens);

        // 1. Write request log
        await supabase.from('request_logs').insert({
            user_id: entry.userId,
            model: GEMINI_MODEL,
            input_tokens: entry.inputTokens,
            output_tokens: entry.outputTokens,
            latency_ms: entry.latencyMs,
            estimated_cost: cost.budgeted,
            endpoint: entry.endpoint,
            tier: entry.tier,
            workflow_run_id: entry.workflowRunId || null,
            degrade_mode: entry.isDegradeMode,
        });

        // 2. Increment daily counters (atomic upsert via RPC)
        await supabase.rpc('increment_daily_usage', {
            p_user_id: entry.userId,
            p_prompts: 1,
            p_input_tokens: entry.inputTokens,
            p_output_tokens: entry.outputTokens,
            p_cost: cost.budgeted,
            p_is_regen: entry.isRegen ?? false,
            p_is_workflow: !!entry.workflowRunId,
        });

        // 3. Increment monthly counters (atomic upsert via RPC)
        await supabase.rpc('increment_monthly_usage', {
            p_user_id: entry.userId,
            p_month_start: getCurrentMonthStart(),
            p_tokens: entry.inputTokens + entry.outputTokens,
            p_prompts: 1,
            p_cost: cost.budgeted,
            p_is_regen: entry.isRegen ?? false,
        });

        // 4. Check if cost alert should be created
        const cap = TIER_CONFIG[entry.tier].monthly_dollar_cap;
        const { data: monthlyData } = await supabase
            .from('usage_monthly_workspace')
            .select('estimated_cost')
            .eq('user_id', entry.userId)
            .eq('month_start', getCurrentMonthStart())
            .single();

        if (monthlyData) {
            const currentCost = Number(monthlyData.estimated_cost);
            const pct = currentCost / cap;

            if (pct >= 0.60) {
                const alertType = pct >= 1.0 ? 'hard_stop' : pct >= 0.80 ? 'degrade' : 'warning';

                // Deduplicate: only create if no alert of this type exists this month
                const { data: existingAlert } = await supabase
                    .from('cost_alerts')
                    .select('id')
                    .eq('user_id', entry.userId)
                    .eq('alert_type', alertType)
                    .gte('created_at', getCurrentMonthStart())
                    .limit(1)
                    .single();

                if (!existingAlert) {
                    await supabase.from('cost_alerts').insert({
                        user_id: entry.userId,
                        alert_type: alertType,
                        threshold_pct: Math.round(pct * 100),
                        current_value: currentCost,
                        cap_value: cap,
                    });
                }
            }
        }
    } catch (err) {
        // Metering should NEVER crash the calling route — log and continue
        console.warn('[meter-logger] Usage logging failed (non-fatal):', err);
    }
}
