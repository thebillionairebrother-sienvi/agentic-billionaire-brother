import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getExtensionCorsHeaders, getExtensionRunMemoryStore, getExtensionUser } from '@/lib/extension-auth';

export async function GET(request: Request) {
    const corsHeaders = getExtensionCorsHeaders(request);

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
            .select(
                'id, created_at, status:metadata->>status, auditScope:metadata->>auditScope, url:metadata->snapshot->>url, title:metadata->snapshot->>title, complianceRisk:metadata->result->legalTechnicalities->>complianceRisk, whatThisPageSells:metadata->result->>whatThisPageSells, bestNextMove:metadata->result->>bestNextMove, messages:metadata->messages'
            )
            .eq('user_id', user.id)
            .eq('action', 'extension_audit')
            .order('created_at', { ascending: false })
            .limit(40);

        if (error) {
            console.warn('[extension/history] Query error, falling back to in-memory runs:', error.message);
            const memHistory = Array.from(getExtensionRunMemoryStore().values())
                .filter((r) => r.userId === user.id)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((r) => ({
                    id: r.id,
                    createdAt: r.created_at,
                    status: r.status,
                    url: r.snapshot?.url || '',
                    title: r.snapshot?.title || 'Untitled Audit',
                    auditScope: r.auditScope || 'page',
                    complianceRisk: r.result?.legalTechnicalities?.complianceRisk || null,
                    whatThisPageSells: r.result?.whatThisPageSells || null,
                    bestNextMove: r.result?.bestNextMove || null,
                    hasResult: Boolean(r.result),
                    messageCount: (r.messages || []).length,
                }));
            return NextResponse.json({ history: memHistory }, { status: 200, headers: corsHeaders });
        }

        const history = (audits || []).map((entry: any) => {
            const hasResult = Boolean(entry.whatThisPageSells || entry.bestNextMove);
            return {
                id: entry.id,
                createdAt: entry.created_at,
                status: entry.status || 'completed',
                url: entry.url || '',
                title: entry.title || 'Untitled Audit',
                auditScope: entry.auditScope || 'page',
                complianceRisk: entry.complianceRisk || null,
                whatThisPageSells: entry.whatThisPageSells || null,
                bestNextMove: entry.bestNextMove || null,
                hasResult,
                messageCount: Array.isArray(entry.messages) ? entry.messages.length : 0,
            };
        });

        return NextResponse.json(
            { history },
            { status: 200, headers: corsHeaders }
        );
    } catch (error: any) {
        console.error('[extension/history] Error:', error);
        return NextResponse.json(
            { history: [] },
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

