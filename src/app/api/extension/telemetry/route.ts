import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, extractUserFromCookiesOrToken } from '@/lib/supabase/server';
import { getExtensionCorsHeaders } from '@/lib/extension-auth';

export async function POST(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);

    try {
        const body = await request.json().catch(() => ({}));
        const { eventName, params, clientId } = body;

        if (!eventName) {
            return NextResponse.json(
                { error: 'Missing eventName' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Fast 0ms user detection from cookie or header without calling /auth/v1/user
        let userId: string | null = request.headers.get('x-bb-extension-user-id') || null;
        if (!userId) {
            try {
                const cookieStore = await cookies();
                const authHeader = request.headers.get('Authorization');
                const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
                const extracted = extractUserFromCookiesOrToken(cookieStore.getAll(), token);
                if (extracted.user?.id) {
                    userId = extracted.user.id;
                }
            } catch {}
        }

        // Fire-and-forget DB insert so telemetry never blocks or fails if DB is busy
        createServiceClient()
            .then(serviceClient =>
                serviceClient.from('audit_logs').insert({
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
                })
            )
            .catch(() => {});

        return NextResponse.json({ success: true }, { status: 200, headers: corsHeaders });
    } catch (error: any) {
        console.error('[extension/telemetry] Error logging telemetry:', error);
        return NextResponse.json(
            { success: false },
            { status: 200, headers: corsHeaders }
        );
    }
}

export async function OPTIONS(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

