import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';

// POST — Submit a revenue win (user) OR approve/reject (admin)
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // ── Admin action: approve / reject ──
    if (body.action === 'approve' || body.action === 'reject') {
        if (!isAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const serviceClient = await createServiceClient();
        const updateData = body.action === 'approve'
            ? { admin_approved: true, admin_rejected: false, approved_at: new Date().toISOString(), admin_notes: body.notes || null }
            : { admin_approved: false, admin_rejected: true, admin_notes: body.notes || null };

        const { error } = await serviceClient
            .from('revenue_wins')
            .update(updateData)
            .eq('id', body.winId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    }

    // ── User action: submit a revenue win ──
    const { monthly_revenue, platform, win_headline, screenshot_path, consent_given } = body;

    if (!consent_given) {
        return NextResponse.json({ error: 'Consent is required to submit a revenue win' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('revenue_wins')
        .insert({
            user_id: user.id,
            monthly_revenue: monthly_revenue || null,
            platform: platform || null,
            win_headline: win_headline || null,
            screenshot_path: screenshot_path || null,
            consent_given: true,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, win: data });
}

// GET — Fetch wins (admin: all pending, user: own wins)
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'pending' | 'approved' | 'all'

    // Admin view — fetch all wins with user info
    if (isAdmin(user.email) && filter) {
        const serviceClient = await createServiceClient();

        let query = serviceClient
            .from('revenue_wins')
            .select('*, users!inner(display_name, email)')
            .order('submitted_at', { ascending: false });

        if (filter === 'pending') {
            query = query.eq('admin_approved', false).eq('admin_rejected', false);
        } else if (filter === 'approved') {
            query = query.eq('admin_approved', true);
        }

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ wins: data });
    }

    // User view — own wins
    const { data, error } = await supabase
        .from('revenue_wins')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ wins: data });
}
