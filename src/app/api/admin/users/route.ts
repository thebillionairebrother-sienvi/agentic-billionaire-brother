import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import { MODEL_PRICING } from '@/lib/ai-config';

export async function GET() {
    try {
        // Auth check — must be admin
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || !isAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Use service client to bypass RLS and read all users
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

        // Build per-user data
        const enrichedUsers = (users || []).map(user => {
            const profile = (profiles || []).find(p => p.user_id === user.id);
            const contract = (contracts || []).find(c => c.user_id === user.id);
            const userTasks = (tasks || []).filter(t => t.user_id === user.id);
            const userCycles = (cycles || []).filter(c => c.user_id === user.id);
            const userDecisions = (decisions || []).filter(d => d.user_id === user.id);

            const tasksDone = userTasks.filter(t => t.status === 'done').length;
            const tasksTotal = userTasks.length;
            const latestCycle = userCycles.sort((a, b) => b.week_number - a.week_number)[0];

            // Heuristic cost estimation based on user activity
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

            // Cost estimation based on configured model pricing
            const inputCost = (inputTokens / 1_000_000) * MODEL_PRICING.actual.input_per_1m_tokens;
            const outputCost = (outputTokens / 1_000_000) * MODEL_PRICING.actual.output_per_1m_tokens;
            const estimatedCost = inputCost + outputCost;

            return {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                onboarding_complete: user.onboarding_complete,
                subscription_status: user.subscription_status,
                created_at: user.created_at,
                business_name: profile?.business_name || null,
                industry: profile?.industry || null,
                business_state: profile?.business_state || null,
                strategy_archetype: contract?.strategy?.archetype || null,
                strategy_confidence: contract?.strategy?.confidence || null,
                strategy_thesis: contract?.strategy?.thesis || null,
                locked_kpi: contract?.locked_kpi || null,
                tasks_total: tasksTotal,
                tasks_done: tasksDone,
                tasks_in_progress: userTasks.filter(t => t.status === 'in_progress').length,
                current_week: latestCycle?.week_number || 0,
                total_weeks: userCycles.length,
                estimated_cost: Math.round(estimatedCost * 10000) / 10000, // 4 decimal places
            };
        });

        // Summary stats
        const totalUsers = enrichedUsers.length;
        const activeStrategies = enrichedUsers.filter(u => u.strategy_archetype).length;
        const totalTasksDone = enrichedUsers.reduce((s, u) => s + u.tasks_done, 0);
        const totalCost = enrichedUsers.reduce((s, u) => s + u.estimated_cost, 0);

        return NextResponse.json({
            users: enrichedUsers,
            stats: {
                totalUsers,
                activeStrategies,
                totalTasksDone,
                totalCost: Math.round(totalCost * 10000) / 10000,
                onboardedUsers: enrichedUsers.filter(u => u.onboarding_complete).length,
            },
        });
    } catch (err) {
        console.error('Admin users API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
