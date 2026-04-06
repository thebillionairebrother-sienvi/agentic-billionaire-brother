import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch current execution contract to get strategy and locked KPI
        const { data: contract } = await supabase
            .from('execution_contracts')
            .select(`
                id, locked_kpi,
                strategy_options ( id, thesis, archetype )
            `)
            .eq('user_id', user.id)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        // 2. Fetch the current and recent weekly cycles for streaks and KPI movement
        const { data: cycles } = await supabase
            .from('weekly_cycles')
            .select('id, week_number, status, kpi_target, kpi_actual, completed_at, created_at')
            .eq('user_id', user.id)
            .order('week_number', { ascending: false })
            .limit(10); // Fetch up to 10 recent cycles to calculate streaks

        let currentCycle = null;
        let shipStreak = 0;
        let sprintCompletionPercentage = 0;
        let kpiMovement = { previous: null, current: null, target: null };

        if (cycles && cycles.length > 0) {
            currentCycle = cycles[0]; // Assuming highest week number is current
            
            // Calculate Ship Streak
            let lastWeekNum = currentCycle.week_number;
            // Iterate down to find consecutive completed weeks
            // Start from latest completed week
            let startIdx = currentCycle.status === 'completed' ? 0 : 1;
            
            if (startIdx < cycles.length && cycles[startIdx]?.status === 'completed') {
                shipStreak = 1;
                lastWeekNum = cycles[startIdx].week_number;
                for (let i = startIdx + 1; i < cycles.length; i++) {
                    if (cycles[i].status === 'completed' && cycles[i].week_number === lastWeekNum - 1) {
                        shipStreak++;
                        lastWeekNum = cycles[i].week_number;
                    } else {
                        break;
                    }
                }
            }

            kpiMovement = {
                previous: cycles[1]?.kpi_actual || null,
                current: currentCycle.kpi_actual || null,
                target: currentCycle.kpi_target || contract?.locked_kpi || null,
            };

            // Calculate Sprint Adherence Progress Bar for the active cycle
            if (currentCycle.status === 'active' || currentCycle.status === 'completed') {
                const { data: tasks } = await supabase
                    .from('tasks')
                    .select('status')
                    .eq('weekly_cycle_id', currentCycle.id);
                
                if (tasks && tasks.length > 0) {
                    const completedTasks = tasks.filter(t => t.status === 'done').length;
                    sprintCompletionPercentage = Math.round((completedTasks / tasks.length) * 100);
                } else if (currentCycle.status === 'completed') {
                    sprintCompletionPercentage = 100;
                }
            }
        }

        // 3. Fetch Revenue Event Status
        const { data: revenueEvent } = await supabase
            .from('revenue_events')
            .select('revenue_event_date')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        return NextResponse.json({
            success: true,
            data: {
                currentStrategy: contract?.strategy_options ? {
                    thesis: (contract.strategy_options as any).thesis,
                    archetype: (contract.strategy_options as any).archetype
                } : null,
                shipStreak,
                sprintCompletionPercentage,
                kpiMovement,
                revenueEventAchieved: !!(revenueEvent && revenueEvent.revenue_event_date),
            }
        });
    } catch (error) {
        console.error('User metrics error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user metrics' },
            { status: 500 }
        );
    }
}
