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

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const { id } = await params;
        const { supabase, user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const serviceClient = await createServiceClient();
        const { data: auditLog, error } = await serviceClient
            .from('audit_logs')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error || !auditLog) {
            return NextResponse.json(
                { error: 'Audit run not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        const metadata = (auditLog.metadata as Record<string, any>) || {};
        const status = metadata.status || 'queued';
        const result = metadata.result || null;
        const error_message = metadata.error_message || null;

        return NextResponse.json(
            {
                id: auditLog.id,
                status,
                result,
                error_message,
            },
            { status: 200, headers: corsHeaders }
        );
    } catch (error) {
        console.error('[extension/runs] Status error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch run status' },
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
