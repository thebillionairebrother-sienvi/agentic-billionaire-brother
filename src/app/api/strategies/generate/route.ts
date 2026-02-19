import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const businessProfileId = body.business_profile_id;

        // Dedupe check — no generation within 5 min window
        const { data: recentJob } = await supabase
            .from('generation_jobs')
            .select('id, created_at')
            .eq('user_id', user.id)
            .eq('job_type', 'strategies')
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (recentJob) {
            return NextResponse.json({
                jobId: recentJob.id,
                message: 'Strategy generation already in progress',
            });
        }

        // Create decision row
        const serviceClient = await createServiceClient();
        const { data: decision, error: decisionError } = await serviceClient
            .from('decisions')
            .insert({
                user_id: user.id,
                business_profile_id: businessProfileId,
                status: 'generating',
            })
            .select('id')
            .single();

        if (decisionError) throw decisionError;

        // Create generation job
        const { data: job, error: jobError } = await serviceClient
            .from('generation_jobs')
            .insert({
                user_id: user.id,
                job_type: 'strategies',
                reference_id: decision!.id,
                status: 'queued',
            })
            .select('id')
            .single();

        if (jobError) throw jobError;

        // Trigger async worker (fire and forget)
        const workerUrl = new URL('/api/workers/strategy-generator', request.url);
        fetch(workerUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId: job!.id,
                decisionId: decision!.id,
                userId: user.id,
            }),
        }).catch(console.error);

        return NextResponse.json(
            { jobId: job!.id, decisionId: decision!.id },
            { status: 202 }
        );
    } catch (error) {
        console.error('Strategy generation error:', error);
        return NextResponse.json(
            { error: 'Failed to start strategy generation' },
            { status: 500 }
        );
    }
}
