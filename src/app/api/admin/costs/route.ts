import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import { getCurrentMonthStart, TIER_CONFIG, THRESHOLDS, MODEL_PRICING } from '@/lib/ai-config';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || !isAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const admin = await createServiceClient();
        const monthStart = getCurrentMonthStart();

        // ── Parallel data fetch ──
        const [
            { data: monthlyUsage },
            { data: requestLogs },
            { data: alerts },
            { data: users },
            { data: subscriptions },
        ] = await Promise.all([
            admin
                .from('usage_monthly_workspace')
                .select('*')
                .eq('month_start', monthStart),
            admin
                .from('request_logs')
                .select('user_id, endpoint, tier, input_tokens, output_tokens, estimated_cost, created_at')
                .gte('created_at', monthStart)
                .order('created_at', { ascending: false }),
            admin
                .from('cost_alerts')
                .select('*')
                .gte('created_at', monthStart)
                .order('created_at', { ascending: false }),
            admin
                .from('users')
                .select('id, email, display_name, tier, charter_member'),
            admin
                .from('subscriptions')
                .select('user_id, tier, status, charter_pricing'),
        ]);

        // ── Per-user costs ──
        const userCostMap = new Map<string, number>();
        (monthlyUsage || []).forEach(row => {
            userCostMap.set(row.user_id, Number(row.estimated_cost));
        });

        const perUserCosts = (users || []).map(u => {
            const cost = userCostMap.get(u.id) || 0;
            const sub = (subscriptions || []).find(s => s.user_id === u.id);
            const tier = sub?.tier || u.tier || 'brother';
            const cap = TIER_CONFIG[tier as keyof typeof TIER_CONFIG]?.monthly_dollar_cap || 50;
            return {
                userId: u.id,
                email: u.email,
                displayName: u.display_name,
                tier,
                monthlyCost: Math.round(cost * 10000) / 10000,
                capPct: cap > 0 ? Math.round((cost / cap) * 100) : 0,
                cap,
            };
        }).sort((a, b) => b.monthlyCost - a.monthlyCost);

        // ── Per-endpoint costs ──
        const endpointMap = new Map<string, { cost: number; count: number; inputTokens: number; outputTokens: number }>();
        (requestLogs || []).forEach(log => {
            const key = log.endpoint || 'unknown';
            const prev = endpointMap.get(key) || { cost: 0, count: 0, inputTokens: 0, outputTokens: 0 };
            endpointMap.set(key, {
                cost: prev.cost + Number(log.estimated_cost),
                count: prev.count + 1,
                inputTokens: prev.inputTokens + (log.input_tokens || 0),
                outputTokens: prev.outputTokens + (log.output_tokens || 0),
            });
        });
        const perEndpoint = Array.from(endpointMap.entries())
            .map(([endpoint, data]) => ({ endpoint, ...data, cost: Math.round(data.cost * 10000) / 10000 }))
            .sort((a, b) => b.cost - a.cost);

        // ── Per-tier costs ──
        const tierTotals: Record<string, { cost: number; count: number; users: number }> = {};
        (requestLogs || []).forEach(log => {
            const tier = log.tier || 'brother';
            if (!tierTotals[tier]) tierTotals[tier] = { cost: 0, count: 0, users: 0 };
            tierTotals[tier].cost += Number(log.estimated_cost);
            tierTotals[tier].count += 1;
        });
        // Count unique users per tier
        const tierUserSets: Record<string, Set<string>> = {};
        (requestLogs || []).forEach(log => {
            const tier = log.tier || 'brother';
            if (!tierUserSets[tier]) tierUserSets[tier] = new Set();
            tierUserSets[tier].add(log.user_id);
        });
        Object.keys(tierTotals).forEach(tier => {
            tierTotals[tier].users = tierUserSets[tier]?.size || 0;
            tierTotals[tier].cost = Math.round(tierTotals[tier].cost * 10000) / 10000;
        });

        // ── Aggregate stats ──
        const totalAISpend = perUserCosts.reduce((s, u) => s + u.monthlyCost, 0);
        const activeUsers = perUserCosts.filter(u => u.monthlyCost > 0).length;
        const avgCostPerUser = activeUsers > 0 ? totalAISpend / activeUsers : 0;
        const totalUsers = (users || []).length;

        // Margin projection (assume blended $73/user/month revenue)
        const estimatedMonthlyRevenue = totalUsers * 73;
        const projectedMargin = estimatedMonthlyRevenue > 0
            ? ((estimatedMonthlyRevenue - totalAISpend) / estimatedMonthlyRevenue) * 100
            : 100;

        // ── Active alerts ──
        const activeAlerts = (alerts || []).filter(a => !a.resolved).map(a => ({
            id: a.id,
            userId: a.user_id,
            alertType: a.alert_type,
            thresholdPct: a.threshold_pct,
            currentValue: Number(a.current_value),
            capValue: Number(a.cap_value),
            createdAt: a.created_at,
            email: (users || []).find(u => u.id === a.user_id)?.email || 'unknown',
        }));

        return NextResponse.json({
            month: monthStart,
            summary: {
                totalAISpend: Math.round(totalAISpend * 10000) / 10000,
                avgCostPerUser: Math.round(avgCostPerUser * 10000) / 10000,
                activeUsers,
                totalUsers,
                projectedMargin: Math.round(projectedMargin * 10) / 10,
                estimatedMonthlyRevenue,
                alertCount: activeAlerts.length,
            },
            perUserCosts: perUserCosts.slice(0, 50), // Top 50
            perEndpoint,
            tierTotals,
            alerts: activeAlerts,
            pricing: {
                model: MODEL_PRICING.model,
                actual: MODEL_PRICING.actual,
                budget: MODEL_PRICING.budget,
            },
            thresholds: {
                warningPct: THRESHOLDS.warning_pct * 100,
                degradePct: THRESHOLDS.degrade_pct * 100,
                hardStopPct: THRESHOLDS.hard_stop_pct * 100,
                perUserAlert: THRESHOLDS.per_user_cost_alert,
                targetMargin: THRESHOLDS.target_gross_margin * 100,
            },
        });
    } catch (err) {
        console.error('Admin costs API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
