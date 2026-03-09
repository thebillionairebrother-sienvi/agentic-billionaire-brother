/**
 * AI Middleware — Usage Guard
 * Enforces daily prompt caps, weekly regen caps, and detects degrade-mode thresholds.
 * This is the core entitlement enforcement layer.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { TIER_CONFIG, THRESHOLDS, getTodayDate, getCurrentWeekStart, getCurrentMonthStart, getNextResetDate } from '@/lib/ai-config';
import type { Tier } from '@/lib/ai-config';
import { GuardError } from './types';
import type { DailyUsage, WeeklyUsage, MonthlyUsage } from './types';

interface UsageCheckResult {
    isDegradeMode: boolean;
    isHardStop: boolean;
    daily: DailyUsage;
    monthly: MonthlyUsage;
}

/**
 * Get or initialize daily usage row (returns zeroes if none exists).
 */
async function getDailyUsage(supabase: SupabaseClient, userId: string): Promise<DailyUsage> {
    const { data } = await supabase
        .from('usage_daily_user')
        .select('*')
        .eq('user_id', userId)
        .eq('date', getTodayDate())
        .single();

    return data ?? {
        prompt_count: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        regen_count: 0,
        workflow_count: 0,
        estimated_cost: 0,
    };
}

/**
 * Get or initialize weekly usage row.
 */
async function getWeeklyUsage(supabase: SupabaseClient, userId: string): Promise<WeeklyUsage> {
    const { data } = await supabase
        .from('usage_weekly_user')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', getCurrentWeekStart())
        .single();

    return data ?? { regen_count: 0 };
}

/**
 * Get or initialize monthly usage row.
 */
async function getMonthlyUsage(supabase: SupabaseClient, userId: string): Promise<MonthlyUsage> {
    const { data } = await supabase
        .from('usage_monthly_workspace')
        .select('*')
        .eq('user_id', userId)
        .eq('month_start', getCurrentMonthStart())
        .single();

    return data ?? {
        total_tokens: 0,
        total_prompts: 0,
        estimated_cost: 0,
        regen_usage: 0,
    };
}

/**
 * Main usage guard — checks all caps and determines mode.
 */
export async function checkUsageGuard(
    supabase: SupabaseClient,
    userId: string,
    tier: Tier,
    options: { isRegen?: boolean } = {}
): Promise<UsageCheckResult> {
    const config = TIER_CONFIG[tier];

    // Fetch all usage counters in parallel
    const [daily, weekly, monthly] = await Promise.all([
        getDailyUsage(supabase, userId),
        getWeeklyUsage(supabase, userId),
        getMonthlyUsage(supabase, userId),
    ]);

    // ── Hard stops (100% caps) ──

    // Monthly dollar cap hard stop
    if (monthly.estimated_cost >= config.monthly_dollar_cap) {
        throw new GuardError(
            'DOLLAR_CAP_EXCEEDED',
            `Sprint budget reached. Resets ${getNextResetDate()}.`,
            429,
            false
        );
    }

    // Daily prompt cap hard stop
    if (daily.prompt_count >= config.daily_prompt_cap) {
        throw new GuardError(
            'DAILY_CAP_EXCEEDED',
            'Daily sprint capacity reached. Come back tomorrow.',
            429,
            false
        );
    }

    // Weekly regen cap (only if this is a regen request)
    if (options.isRegen && weekly.regen_count >= config.weekly_regen_cap) {
        throw new GuardError(
            'REGEN_CAP_EXCEEDED',
            'Weekly regeneration limit reached. Try again next week.',
            429,
            false
        );
    }

    // ── Degrade mode detection (80% thresholds) ──
    const isDegradeMode =
        monthly.estimated_cost >= config.monthly_dollar_cap * THRESHOLDS.degrade_pct ||
        daily.prompt_count >= config.daily_prompt_cap * THRESHOLDS.degrade_pct;

    return {
        isDegradeMode,
        isHardStop: false,
        daily,
        monthly,
    };
}

export { getDailyUsage, getWeeklyUsage, getMonthlyUsage };
