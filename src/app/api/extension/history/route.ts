import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import { getExtensionUser } from '@/lib/extension-auth';

function getCorsHeaders(request: Request) {
    const origin = request.headers.get('origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

export async function GET(request: Request) {
    const corsHeaders = getCorsHeaders(request);

    try {
        const user = await getExtensionUser(request);
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        const serviceClient = await createServiceClient();
        const { data: audits, error } = await serviceClient
            .from('audit_logs')
            .select('id, metadata, created_at')
            .eq('user_id', user.id)
            .eq('action', 'extension_audit')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('[extension/history] Query error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch audit history' },
                { status: 500, headers: corsHeaders }
            );
        }

        const history = (audits || []).map((entry: any) => {
            const meta = entry.metadata || {};
            const result = meta.result || null;
            const snapshot = meta.snapshot || {};
            return {
                id: entry.id,
                createdAt: entry.created_at,
                status: meta.status || 'completed',
                url: snapshot.url || '',
                title: snapshot.title || 'Untitled Audit',
                auditScope: meta.auditScope || 'page',
                complianceRisk: result?.legalTechnicalities?.complianceRisk || null,
                whatThisPageSells: result?.whatThisPageSells || null,
                bestNextMove: result?.bestNextMove || null,
                hasResult: Boolean(result),
                messageCount: (meta.messages || []).length,
            };
        });

        return NextResponse.json(
            { history },
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('[extension/history] Error:', error);
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
