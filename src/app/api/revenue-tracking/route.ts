import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH — Update revenue tracking fields on business_profiles
export async function PATCH(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { current_monthly_revenue, revenue_platform, baseline_monthly_revenue } = body;

    // Build update object — only include provided fields
    const updates: Record<string, unknown> = { revenue_updated_at: new Date().toISOString() };
    if (current_monthly_revenue !== undefined) updates.current_monthly_revenue = current_monthly_revenue;
    if (revenue_platform !== undefined) updates.revenue_platform = revenue_platform;
    if (baseline_monthly_revenue !== undefined) updates.baseline_monthly_revenue = baseline_monthly_revenue;

    const { error } = await supabase
        .from('business_profiles')
        .update(updates)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

// GET — Fetch current revenue data
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
        .from('business_profiles')
        .select('baseline_monthly_revenue, current_monthly_revenue, revenue_platform, revenue_updated_at, current_revenue_range')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ revenue: data || null });
}
