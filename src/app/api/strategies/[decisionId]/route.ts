import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ decisionId: string }> }
) {
    try {
        const { decisionId } = await params;
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: decision, error: decisionError } = await supabase
            .from('decisions')
            .select('*')
            .eq('id', decisionId)
            .eq('user_id', user.id)
            .single();

        if (decisionError || !decision) {
            return NextResponse.json({ error: 'Decision not found' }, { status: 404 });
        }

        const { data: strategies, error: stratError } = await supabase
            .from('strategy_options')
            .select('*')
            .eq('decision_id', decisionId)
            .order('rank', { ascending: true });

        if (stratError) throw stratError;

        return NextResponse.json({
            decision,
            strategies: strategies || [],
        });
    } catch (error) {
        console.error('Strategies fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch strategies' },
            { status: 500 }
        );
    }
}
