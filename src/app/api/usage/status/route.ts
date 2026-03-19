import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TIER_CONFIG, THRESHOLDS, getTodayDate, getCurrentMonthStart, getCurrentWeekStart, getNextResetDate } from '@/lib/ai-config';
import type { Tier } from '@/lib/ai-config';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Determine tier (default to brother)
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('user_id', user.id)
            .single();

        const tier: Tier = (sub?.tier as Tier) || 'brother';
        const config = TIER_CONFIG[tier];

        // Parallel fetch usage
        const [{ data: daily }, { data: monthly }, { data: weekly }] = await Promise.all([
            supabase
                .from('usage_daily_user')
                .select('prompt_count, regen_count, estimated_cost')
                .eq('user_id', user.id)
                .eq('date', getTodayDate())
                .single(),
            supabase
                .from('usage_monthly_workspace')
                .select('estimated_cost, total_prompts')
                .eq('user_id', user.id)
                .eq('month_start', getCurrentMonthStart())
                .single(),
            supabase
                .from('usage_weekly_user')
                .select('regen_count')
                .eq('user_id', user.id)
                .eq('week_start', getCurrentWeekStart())
                .single(),
        ]);

        const promptsUsed = daily?.prompt_count || 0;
        const promptCap = config.daily_prompt_cap;
        const promptPct = Math.round((promptsUsed / promptCap) * 100);

        const monthlyCost = Number(monthly?.estimated_cost || 0);
        const monthlyCap = config.monthly_dollar_cap;
        const costPct = Math.round((monthlyCost / monthlyCap) * 100);

        const regensUsed = weekly?.regen_count || 0;
        const regenCap = config.weekly_regen_cap;

        // Degrade mode: 80%+ on cost OR prompts
        const isDegradeMode =
            monthlyCost >= monthlyCap * THRESHOLDS.degrade_pct ||
            promptsUsed >= promptCap * THRESHOLDS.degrade_pct;

        // Hard stop: 100%
        const isHardStop = monthlyCost >= monthlyCap || promptsUsed >= promptCap;

        return NextResponse.json({
            tier,
            promptsUsed,
            promptCap,
            promptPct,
            costPct,
            regensUsed,
            regenCap,
            isDegradeMode,
            isHardStop,
            resetDate: getNextResetDate(),
        });
    } catch (err) {
        console.error('Usage status error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
