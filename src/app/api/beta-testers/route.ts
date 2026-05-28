import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { MODEL_PRICING } from '@/lib/ai-config';

export const revalidate = 0; // Don't cache beta testers on CDN

export async function GET(request: Request) {
    try {
        const apiKey = request.headers.get('x-api-key');
        if (apiKey !== 'Iydknyk1@#$%') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await createServiceClient();

        // Fetch all users
        const { data: users, error: usersError } = await admin
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (usersError) throw usersError;

        // Fetch all business profiles
        const { data: profiles } = await admin
            .from('business_profiles')
            .select('*');

        // Fetch all execution contracts with strategy
        const { data: contracts } = await admin
            .from('execution_contracts')
            .select('*, strategy:strategy_options(*)');

        // Fetch all tasks
        const { data: tasks } = await admin
            .from('tasks')
            .select('id, user_id, status, created_at');

        // Fetch all weekly cycles
        const { data: cycles } = await admin
            .from('weekly_cycles')
            .select('id, user_id, week_number, status, created_at');

        // Fetch all decisions
        const { data: decisions } = await admin
            .from('decisions')
            .select('id, user_id, status, created_at');

        // Fetch subscriptions
        const { data: subscriptions } = await admin
            .from('subscriptions')
            .select('user_id, tier, status, promo_code, charter_pricing, started_at');

        // Enrich users with their business profiles, strategies, task progress, and AI costs
        const enrichedUsers = (users || []).map(user => {
            const profile = (profiles || []).find(p => p.user_id === user.id);
            const contract = (contracts || []).find(c => c.user_id === user.id);
            const userTasks = (tasks || []).filter(t => t.user_id === user.id);
            const userCycles = (cycles || []).filter(c => c.user_id === user.id);
            const userDecisions = (decisions || []).filter(d => d.user_id === user.id);
            const userSub = (subscriptions || []).find(s => s.user_id === user.id);

            const tasksDone = userTasks.filter(t => t.status === 'done').length;
            const tasksTotal = userTasks.length;
            
            // Sort cycles to find latest
            const sortedCycles = [...userCycles].sort((a, b) => b.week_number - a.week_number);
            const latestCycle = sortedCycles[0];

            // Heuristic cost estimation (matches admin users API logic)
            const chatEstimate = tasksTotal * 0.5;
            const strategyGens = userDecisions.length;
            const taskGens = Math.ceil(tasksTotal / 5);
            const checkinCount = userCycles.length;

            const inputTokens =
                (chatEstimate * 1500) +
                (strategyGens * 6000) +
                (taskGens * 4000) +
                (checkinCount * 3000);

            const outputTokens =
                (chatEstimate * 500) +
                (strategyGens * 4000) +
                (taskGens * 2000) +
                (checkinCount * 800);

            const inputCost = (inputTokens / 1_000_000) * MODEL_PRICING.actual.input_per_1m_tokens;
            const outputCost = (outputTokens / 1_000_000) * MODEL_PRICING.actual.output_per_1m_tokens;
            const estimatedCost = inputCost + outputCost;

            return {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                tier: userSub?.tier || user.tier || 'brother',
                subscription_active: userSub?.status === 'active',
                onboarding_complete: user.onboarding_complete,
                subscription_status: user.subscription_status,
                created_at: user.created_at,
                business_name: profile?.business_name || null,
                industry: profile?.industry || null,
                business_state: profile?.business_state || null,
                strategy_archetype: contract?.strategy?.archetype || null,
                strategy_thesis: contract?.strategy?.thesis || null,
                locked_kpi: contract?.locked_kpi || null,
                tasks_total: tasksTotal,
                tasks_done: tasksDone,
                tasks_in_progress: userTasks.filter(t => t.status === 'in_progress').length,
                current_week: latestCycle?.week_number || 0,
                total_weeks: userCycles.length,
                estimated_cost: Math.round(estimatedCost * 10000) / 10000,
            };
        });

        const totalUsers = enrichedUsers.length;
        const onboardedUsers = enrichedUsers.filter(u => u.onboarding_complete).length;
        
        return NextResponse.json({
            success: true,
            summary: {
                beta_testers_count: totalUsers,
                total_registered_users: totalUsers,
                total_onboarded_users: onboardedUsers,
                total_active_strategies: enrichedUsers.filter(u => u.strategy_archetype).length,
                total_tasks_completed: enrichedUsers.reduce((s, u) => s + u.tasks_done, 0),
                total_estimated_cost: Math.round(enrichedUsers.reduce((s, u) => s + u.estimated_cost, 0) * 10000) / 10000,
            },
            beta_testers: enrichedUsers,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Beta testers API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
