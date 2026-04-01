import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user creation date for weekly cadence
        const { data: profile } = await supabase
            .from('users')
            .select('created_at')
            .eq('id', user.id)
            .single();

        const accountCreated = profile?.created_at
            ? new Date(profile.created_at)
            : new Date();

        // Get all completed cycles with summaries
        const { data: completedCycles } = await supabase
            .from('weekly_cycles')
            .select('id, week_number, board_meeting_notes, completed_at, created_at')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .not('board_meeting_notes', 'is', null)
            .order('week_number', { ascending: false });

        // Get the most recent completed check-in date
        const lastCheckin = completedCycles?.[0]?.completed_at
            ? new Date(completedCycles[0].completed_at)
            : null;

        // Calculate next check-in date
        // Check-ins happen every 7 days from account creation
        const now = new Date();
        const msSinceCreation = now.getTime() - accountCreated.getTime();
        const daysSinceCreation = Math.floor(msSinceCreation / (1000 * 60 * 60 * 24));
        const currentWeekNumber = Math.floor(daysSinceCreation / 7);
        const nextCheckinDay = (currentWeekNumber + 1) * 7;
        const daysUntilNextCheckin = nextCheckinDay - daysSinceCreation;

        // Check-in is available if:
        // 1. It's been at least 7 days since account creation AND
        // 2. Either no check-in has been done, or last check-in was 7+ days ago
        const hasEnoughData = daysSinceCreation >= 7;
        const lastCheckinDaysAgo = lastCheckin
            ? Math.floor((now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24))
            : Infinity;

        const checkinAvailable = hasEnoughData && lastCheckinDaysAgo >= 7;

        // Build past summaries list
        const pastSummaries = (completedCycles || []).map(c => ({
            id: c.id,
            weekNumber: c.week_number,
            summary: c.board_meeting_notes,
            completedAt: c.completed_at,
        }));

        return NextResponse.json({
            checkinAvailable,
            daysUntilCheckin: checkinAvailable ? 0 : Math.max(0, daysUntilNextCheckin),
            daysSinceCreation,
            currentWeekNumber,
            lastCheckinDate: lastCheckin?.toISOString() || null,
            pastSummaries,
        });
    } catch (error) {
        console.error('Check-in status error:', error);
        return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
    }
}
