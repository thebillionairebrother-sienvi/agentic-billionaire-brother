import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import type { BoardMeetingPayload } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: BoardMeetingPayload = await request.json();
        const serviceClient = await createServiceClient();

        // Update current cycle
        await serviceClient
            .from('weekly_cycles')
            .update({
                kpi_actual: body.kpi_actual,
                kill_list: body.kill_list,
                keep_list: body.keep_list,
                double_list: body.double_list,
                board_meeting_notes: { notes: body.notes },
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', body.cycle_id);

        // Get current cycle info for next week
        const { data: currentCycle } = await serviceClient
            .from('weekly_cycles')
            .select('week_number, execution_contract_id')
            .eq('id', body.cycle_id)
            .single();

        if (!currentCycle) {
            return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
        }

        // Create next week cycle
        const { data: nextCycle, error: cycleError } = await serviceClient
            .from('weekly_cycles')
            .insert({
                user_id: user.id,
                execution_contract_id: currentCycle.execution_contract_id,
                week_number: currentCycle.week_number + 1,
                status: 'generating',
            })
            .select('id')
            .single();

        if (cycleError || !nextCycle) {
            throw cycleError || new Error('Failed to create next cycle');
        }

        // Get decision for thread ID
        const { data: contract } = await serviceClient
            .from('execution_contracts')
            .select('decision_id')
            .eq('id', currentCycle.execution_contract_id)
            .single();

        if (!contract) {
            return NextResponse.json({ error: 'Execution contract not found' }, { status: 404 });
        }

        // Kick off next week's action steps generation
        const { data: job, error: jobError } = await serviceClient
            .from('generation_jobs')
            .insert({
                user_id: user.id,
                job_type: 'ship_pack',
                reference_id: nextCycle.id,
                status: 'queued',
            })
            .select('id')
            .single();

        if (jobError || !job) {
            throw jobError || new Error('Failed to create generation job');
        }

        const workerUrl = new URL('/api/workers/ship-pack-generator', request.url);
        fetch(workerUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: job.id,
                cycleId: nextCycle.id,
                userId: user.id,
                decisionId: contract.decision_id,
            }),
        }).catch(console.error);

        return NextResponse.json({
            nextCycleId: nextCycle.id,
            nextWeek: currentCycle.week_number + 1,
        });
    } catch (error) {
        console.error('Board meeting error:', error);
        return NextResponse.json({ error: 'Failed to submit board meeting' }, { status: 500 });
    }
}
