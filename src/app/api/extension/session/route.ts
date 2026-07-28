import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';

function getCorsHeaders(request: Request) {
    const origin = request.headers.get('origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

export async function GET(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json(
                { userId: null, error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        // Use service client to bypass RLS restrictions on system tables
        const serviceClient = await createServiceClient();
        const [{ data: userProfile }, { data: subRecord }, { data: profile }] = await Promise.all([
            serviceClient
                .from('users')
                .select('tier, email')
                .eq('id', user.id)
                .maybeSingle(),
            serviceClient
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            serviceClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle(),
        ]);

        const email = userProfile?.email || user.email || '';
        const tier = (subRecord?.tier || userProfile?.tier || 'free').toLowerCase();
        const isAdmin = profile?.role === 'admin';
        const hasRequiredPlan = tier === 'brother' || tier === 'team' || isAdmin;

        return NextResponse.json(
            {
                userId: user.id,
                email,
                tier,
                isAdmin,
                hasRequiredPlan,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        console.error('[extension/session] Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function OPTIONS(request: Request) {
    const corsHeaders = getCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
