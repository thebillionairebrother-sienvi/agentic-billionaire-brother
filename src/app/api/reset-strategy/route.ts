import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST() {
    try {
        // Verify user is authenticated
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use service role to bypass RLS for deletions
        const admin = await createServiceClient();
        const uid = user.id;

        // Delete in FK-safe order (children first, then parents)

        // 1. Assets (references deliverables)
        await admin.from('assets').delete().eq('user_id', uid);

        // 2. Tasks (references weekly_cycles, deliverables)
        await admin.from('tasks').delete().eq('user_id', uid);

        // 3. Deliverables (references weekly_cycles)
        await admin.from('deliverables').delete().eq('user_id', uid);

        // 4. Get decision IDs (needed for assumptions + strategy options)
        const { data: decisions } = await admin
            .from('decisions')
            .select('id')
            .eq('user_id', uid);

        const decisionIds = (decisions || []).map((d: { id: string }) => d.id);

        // 5. Assumptions (references strategy_options, weekly_cycles)
        if (decisionIds.length > 0) {
            const { data: strategyOptions } = await admin
                .from('strategy_options')
                .select('id')
                .in('decision_id', decisionIds);
            const strategyIds = (strategyOptions || []).map((s: { id: string }) => s.id);
            if (strategyIds.length > 0) {
                await admin.from('assumptions').delete().in('strategy_option_id', strategyIds);
            }
        }

        // 6. Weekly cycles (references execution_contracts)
        await admin.from('weekly_cycles').delete().eq('user_id', uid);

        // 7. Execution contracts (references decisions, strategy_options)
        await admin.from('execution_contracts').delete().eq('user_id', uid);

        // 8. Strategy options (references decisions)
        if (decisionIds.length > 0) {
            await admin.from('strategy_options').delete().in('decision_id', decisionIds);
        }

        // 8. Decisions
        await admin.from('decisions').delete().eq('user_id', uid);

        // 9. Business profiles
        await admin.from('business_profiles').delete().eq('user_id', uid);

        // 10. Founder profiles
        await admin.from('founder_profiles').delete().eq('user_id', uid);

        // 11. Generation jobs
        await admin.from('generation_jobs').delete().eq('user_id', uid);

        // 12. Reset onboarding flag so user goes through interview again
        await admin
            .from('users')
            .update({ onboarding_complete: false })
            .eq('id', uid);

        // Log the reset action
        await admin.from('audit_logs').insert({
            user_id: uid,
            action: 'strategy_reset',
            entity_type: 'user',
            entity_id: uid,
            metadata: { reset_at: new Date().toISOString() },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reset strategy error:', error);
        return NextResponse.json(
            { error: 'Failed to reset strategy' },
            { status: 500 }
        );
    }
}
