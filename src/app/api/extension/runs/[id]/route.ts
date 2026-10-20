import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getExtensionCorsHeaders, getExtensionRunMemoryStore, getExtensionUser } from '@/lib/extension-auth';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const corsHeaders = getExtensionCorsHeaders(request);

    try {
        const { id } = await params;
        const user = await getExtensionUser(request);

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        // 1. Check in-memory run store first (0ms latency and immune to DB timeouts)
        const cachedRun = getExtensionRunMemoryStore().get(id);
        if (cachedRun && cachedRun.userId === user.id && (cachedRun.status === 'completed' || cachedRun.status === 'failed')) {
            return NextResponse.json(
                {
                    id: cachedRun.id,
                    status: cachedRun.status,
                    result: cachedRun.result,
                    error_message: cachedRun.error_message,
                    snapshot: cachedRun.snapshot,
                    auditScope: cachedRun.auditScope,
                    messages: cachedRun.messages,
                    created_at: cachedRun.created_at,
                },
                { status: 200, headers: corsHeaders }
            );
        }

        // 2. Query only lightweight JSONB paths so Postgres never reads multi-MB base64 screenshots from TOAST
        const serviceClient = await createServiceClient();
        const { data: auditLog, error } = await serviceClient
            .from('audit_logs')
            .select(
                'id, created_at, status:metadata->>status, error_message:metadata->>error_message, auditScope:metadata->>auditScope, result:metadata->result, messages:metadata->messages, url:metadata->snapshot->>url, title:metadata->snapshot->>title, metaDescription:metadata->snapshot->>metaDescription, h1:metadata->snapshot->h1, h2:metadata->snapshot->h2, heroCopy:metadata->snapshot->>heroCopy, ctaText:metadata->snapshot->ctaText, navLinks:metadata->snapshot->navLinks, elements:metadata->snapshot->elements'
            )
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error || !auditLog) {
            // Fall back to in-memory queued run if DB is slow or row only exists in memory
            if (cachedRun && cachedRun.userId === user.id) {
                return NextResponse.json(
                    {
                        id: cachedRun.id,
                        status: cachedRun.status,
                        result: cachedRun.result,
                        error_message: cachedRun.error_message,
                        snapshot: cachedRun.snapshot,
                        auditScope: cachedRun.auditScope,
                        messages: cachedRun.messages,
                        created_at: cachedRun.created_at,
                    },
                    { status: 200, headers: corsHeaders }
                );
            }
            return NextResponse.json(
                { error: 'Audit run not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        const row = auditLog as Record<string, any>;
        const status = row.status || cachedRun?.status || 'queued';
        const result = row.result || cachedRun?.result || null;
        const error_message = row.error_message || cachedRun?.error_message || null;
        const auditScope = row.auditScope || cachedRun?.auditScope || 'page';
        const messages = row.messages || cachedRun?.messages || [];
        const snapshot = cachedRun?.snapshot || {
            url: row.url || '',
            title: row.title || '',
            metaDescription: row.metaDescription || '',
            h1: Array.isArray(row.h1) ? row.h1 : [],
            h2: Array.isArray(row.h2) ? row.h2 : [],
            heroCopy: row.heroCopy || '',
            ctaText: Array.isArray(row.ctaText) ? row.ctaText : [],
            navLinks: Array.isArray(row.navLinks) ? row.navLinks : [],
            // data-bb-id element refs so history re-opens can still highlight exact elements
            elements: Array.isArray(row.elements) ? row.elements : [],
        };

        return NextResponse.json(
            {
                id: row.id,
                status,
                result,
                error_message,
                snapshot,
                auditScope,
                messages,
                created_at: row.created_at,
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
    const corsHeaders = getExtensionCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

