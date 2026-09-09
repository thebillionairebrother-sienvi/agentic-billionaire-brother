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

export async function POST(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const body = await request.json().catch(() => ({}));
        const { eventName, params, clientId } = body;

        if (!eventName) {
            return NextResponse.json(
                { error: 'Missing eventName' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Optional user session detection
        let userId: string | null = null;
        try {
            const { user } = await createMobileAwareClient(request);
            if (user) {
                userId = user.id;
            }
        } catch {
            // Unauthenticated extension event is allowed (e.g. initial install/open)
        }

        const serviceClient = await createServiceClient();

        await serviceClient
            .from('audit_logs')
            .insert({
                user_id: userId,
                action: 'extension_telemetry',
                entity_type: 'event',
                metadata: {
                    eventName,
                    params: params || {},
                    clientId: clientId || null,
                    userAgent: request.headers.get('user-agent'),
                    recordedAt: new Date().toISOString(),
                },
            });

        return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
    } catch (error: any) {
        console.error('[extension/telemetry] Error logging telemetry:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
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
