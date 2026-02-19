import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: job, error } = await supabase
            .from('generation_jobs')
            .select('*')
            .eq('id', jobId)
            .eq('user_id', user.id)
            .single();

        if (error || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: job.id,
            status: job.status,
            jobType: job.job_type,
            referenceId: job.reference_id,
            attempts: job.attempts,
            error: job.error_message,
            createdAt: job.created_at,
            completedAt: job.completed_at,
        });
    } catch (error) {
        console.error('Job status error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch job status' },
            { status: 500 }
        );
    }
}
