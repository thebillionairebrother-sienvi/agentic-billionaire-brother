import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all tasks for this user
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('id, status, due_date')
            .eq('user_id', user.id)
            .order('due_date', { ascending: true });

        if (error) throw error;

        const allTasks = tasks || [];
        const total = allTasks.length;
        const done = allTasks.filter(t => t.status === 'done').length;
        const skipped = allTasks.filter(t => t.status === 'skipped').length;
        const pending = total - done - skipped;

        // Group by date for calendar heatmap
        const byDate: Record<string, { total: number; done: number }> = {};
        for (const t of allTasks) {
            if (!t.due_date) continue;
            if (!byDate[t.due_date]) byDate[t.due_date] = { total: 0, done: 0 };
            byDate[t.due_date].total++;
            if (t.status === 'done') byDate[t.due_date].done++;
        }

        // Get contract start date
        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('signed_at')
            .eq('user_id', user.id)
            .order('signed_at', { ascending: true })
            .limit(1)
            .single();

        // Current streak: consecutive days with ≥1 task done (going back from today)
        const today = new Date();
        let streak = 0;
        for (let i = 0; i < 60; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayData = byDate[dateStr];
            if (dayData && dayData.done > 0) {
                streak++;
            } else if (dayData && dayData.total > 0) {
                break; // had tasks but none done — streak broken
            }
            // days with no tasks don't break streak
        }

        return NextResponse.json({
            total,
            done,
            skipped,
            pending,
            streak,
            byDate,
            startDate: contract?.signed_at?.split('T')[0] || null,
        });
    } catch (error) {
        console.error('Stats error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
