import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { taskId } = await params;

        const { data: task, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('user_id', user.id)
            .single();

        if (error || !task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ task });
    } catch (error) {
        console.error('Fetch task error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch task' },
            { status: 500 }
        );
    }
}
