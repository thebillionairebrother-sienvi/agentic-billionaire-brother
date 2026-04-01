import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { decision_id, strategy_option_id, locked_kpi, weekly_deliverable, calendar_blocks } = body;

        // Check no existing contract for this decision
        const { data: existing } = await supabase
            .from('execution_contracts')
            .select('id')
            .eq('decision_id', decision_id)
            .single();

        if (existing) {
            return NextResponse.json({ error: 'Strategy already committed' }, { status: 409 });
        }

        const serviceClient = await createServiceClient();

        // Create execution contract
        const { data: contract, error: contractError } = await serviceClient
            .from('execution_contracts')
            .insert({
                user_id: user.id,
                decision_id,
                strategy_id: strategy_option_id,
                locked_kpi,
                weekly_deliverable,
                calendar_blocks,
            })
            .select('id')
            .single();

        if (contractError) throw contractError;

        // Update decision status
        await serviceClient
            .from('decisions')
            .update({ status: 'chosen', chosen_strategy_id: strategy_option_id, chosen_at: new Date().toISOString() })
            .eq('id', decision_id);

        // Create Week 1 cycle
        const { data: cycle, error: cycleError } = await serviceClient
            .from('weekly_cycles')
            .insert({
                user_id: user.id,
                execution_contract_id: contract!.id,
                week_number: 1,
                status: 'generating',
            })
            .select('id')
            .single();

        if (cycleError) throw cycleError;

        // Create action steps generation job
        const { data: job } = await serviceClient
            .from('generation_jobs')
            .insert({
                user_id: user.id,
                job_type: 'ship_pack',
                reference_id: cycle!.id,
                status: 'queued',
            })
            .select('id')
            .single();

        // Trigger async action steps generation
        const workerUrl = new URL('/api/workers/ship-pack-generator', request.url);
        fetch(workerUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: job!.id,
                cycleId: cycle!.id,
                userId: user.id,
                decisionId: decision_id,
            }),
        }).catch(console.error);

        // Trigger immediate task generation (fire-and-forget via cron endpoint)
        // Uses cron endpoint to avoid subscription middleware dependency
        const taskUrl = new URL('/api/cron/generate-tasks', request.url);
        fetch(taskUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`,
            },
        }).catch(console.error);

        return NextResponse.json({
            contractId: contract!.id,
            cycleId: cycle!.id,
            briefJobId: job!.id,
        });
    } catch (error) {
        console.error('Commit error:', error);
        return NextResponse.json({ error: 'Failed to commit' }, { status: 500 });
    }
}
