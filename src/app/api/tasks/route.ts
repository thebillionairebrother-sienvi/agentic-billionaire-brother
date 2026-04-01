import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('due_date', date)
            .order('sort_order', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ tasks: tasks || [] });
    } catch (error) {
        console.error('Fetch tasks error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tasks' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { taskId, status } = await request.json();

        if (!taskId || !status) {
            return NextResponse.json({ error: 'taskId and status required' }, { status: 400 });
        }

        const validStatuses = ['todo', 'in_progress', 'done', 'skipped'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const { data: task, error } = await supabase
            .from('tasks')
            .update({ status })
            .eq('id', taskId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ task });
    } catch (error) {
        console.error('Update task error:', error);
        return NextResponse.json(
            { error: 'Failed to update task' },
            { status: 500 }
        );
    }
}
