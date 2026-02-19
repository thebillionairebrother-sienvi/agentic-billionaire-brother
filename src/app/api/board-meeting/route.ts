import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { BoardMeetingPayload } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
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

        // Create next week cycle
        const { data: nextCycle } = await serviceClient
            .from('weekly_cycles')
            .insert({
                user_id: user.id,
                execution_contract_id: currentCycle!.execution_contract_id,
                week_number: currentCycle!.week_number + 1,
                status: 'generating',
            })
            .select('id')
            .single();

        // Get decision for thread ID
        const { data: contract } = await serviceClient
            .from('execution_contracts')
            .select('decision_id')
            .eq('id', currentCycle!.execution_contract_id)
            .single();

        // Kick off next week's ship pack generation
        const { data: job } = await serviceClient
            .from('generation_jobs')
            .insert({
                user_id: user.id,
                job_type: 'ship_pack',
                reference_id: nextCycle!.id,
                status: 'queued',
            })
            .select('id')
            .single();

        const workerUrl = new URL('/api/workers/ship-pack-generator', request.url);
        fetch(workerUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: job!.id,
                cycleId: nextCycle!.id,
                userId: user.id,
                decisionId: contract!.decision_id,
            }),
        }).catch(console.error);

        return NextResponse.json({
            nextCycleId: nextCycle!.id,
            nextWeek: currentCycle!.week_number + 1,
        });
    } catch (error) {
        console.error('Board meeting error:', error);
        return NextResponse.json({ error: 'Failed to submit board meeting' }, { status: 500 });
    }
}
