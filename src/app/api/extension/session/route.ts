import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

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

        return NextResponse.json(
            { userId: user.id, isAdmin: true },
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
