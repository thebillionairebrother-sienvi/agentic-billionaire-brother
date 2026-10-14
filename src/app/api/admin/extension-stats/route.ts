import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';

export const revalidate = 0; // Fresh analytics on each request

export interface ExtensionAuditSummary {
    id: string;
    createdAt: string;
    userId: string | null;
    userEmail: string;
    userName: string;
    url: string;
    domain: string;
    title: string;
    scope: 'page' | 'domain' | 'subpath';
    status: 'completed' | 'failed' | 'queued' | 'processing';
    complianceRisk: string;
    bestNextMove: string | null;
    whatThisPageSells: string | null;
    topConversionLeaks: string[];
    errorMessage: string | null;
}

export interface ExtensionStatsData {
    totalAudits: number;
    completedAudits: number;
    failedAudits: number;
    successRate: number;
    uniqueUsers: number;
    audits24h: number;
    audits7d: number;
    audits30d: number;
    scopeCounts: {
        page: number;
        domain: number;
        subpath: number;
    };
    riskCounts: {
        low: number;
        medium: number;
        high: number;
    };
    topDomains: Array<{ domain: string; count: number }>;
    telemetryCounts: {
        sidepanelOpens: number;
        pdfExports: number;
        textCopies: number;
    };
    recentAudits: ExtensionAuditSummary[];
}

function extractHostname(rawUrl?: string): string {
    if (!rawUrl) return 'Unknown';
    try {
        const parsed = new URL(rawUrl);
        return parsed.hostname.replace(/^www\./, '');
    } catch {
        return rawUrl.slice(0, 30);
    }
}

export async function GET(request: Request) {
    try {
        const { user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isAdmin(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const serviceClient = await createServiceClient();

        // 1. Fetch audit logs related to the Chrome Extension (projecting only lightweight JSON paths)
        const { data: logs, error: logsError } = await serviceClient
            .from('audit_logs')
            .select(
                'id, user_id, action, entity_type, created_at, eventName:metadata->>eventName, status:metadata->>status, auditScope:metadata->>auditScope, errorMessage:metadata->>error_message, url:metadata->snapshot->>url, title:metadata->snapshot->>title, complianceRisk:metadata->result->legalTechnicalities->>complianceRisk, bestNextMove:metadata->result->>bestNextMove, whatThisPageSells:metadata->result->>whatThisPageSells, topConversionLeaks:metadata->result->topConversionLeaks'
            )
            .in('action', ['extension_audit', 'extension_telemetry'])
            .order('created_at', { ascending: false })
            .limit(500);

        if (logsError) {
            throw logsError;
        }

        // 2. Fetch users to map user_id -> email and name
        const { data: users } = await serviceClient
            .from('users')
            .select('id, email, display_name');

        const userMap = new Map<string, { email: string; name: string }>();
        (users || []).forEach(u => {
            userMap.set(u.id, {
                email: u.email || 'Anonymous',
                name: u.display_name || u.email?.split('@')[0] || 'Member',
            });
        });

        // 3. Compute Aggregations
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const sevenDaysMs = 7 * oneDayMs;
        const thirtyDaysMs = 30 * oneDayMs;

        let totalAudits = 0;
        let completedAudits = 0;
        let failedAudits = 0;
        let audits24h = 0;
        let audits7d = 0;
        let audits30d = 0;

        const uniqueUserIds = new Set<string>();
        const domainCounts = new Map<string, number>();

        const scopeCounts = { page: 0, domain: 0, subpath: 0 };
        const riskCounts = { low: 0, medium: 0, high: 0 };
        const telemetryCounts = { sidepanelOpens: 0, pdfExports: 0, textCopies: 0 };

        const recentAudits: ExtensionAuditSummary[] = [];

        for (const entry of (logs || []) as Array<Record<string, any>>) {
            const createdAtTime = new Date(entry.created_at).getTime();
            const ageMs = now - createdAtTime;

            if (entry.user_id) {
                uniqueUserIds.add(entry.user_id);
            }

            if (entry.action === 'extension_telemetry') {
                const eventName = entry.eventName;
                if (eventName === 'sidepanel_open') telemetryCounts.sidepanelOpens++;
                else if (eventName === 'report_export_pdf') telemetryCounts.pdfExports++;
                else if (eventName === 'report_copy') telemetryCounts.textCopies++;
                continue;
            }

            if (entry.action === 'extension_audit') {
                totalAudits++;

                if (ageMs <= oneDayMs) audits24h++;
                if (ageMs <= sevenDaysMs) audits7d++;
                if (ageMs <= thirtyDaysMs) audits30d++;

                const status = entry.status || 'queued';
                if (status === 'completed') completedAudits++;
                else if (status === 'failed') failedAudits++;

                // Scopes
                const scope = (entry.auditScope || 'page') as 'page' | 'domain' | 'subpath';
                if (scope === 'domain') scopeCounts.domain++;
                else if (scope === 'subpath') scopeCounts.subpath++;
                else scopeCounts.page++;

                // Target domain
                const url = entry.url || '';
                const domain = extractHostname(url);
                if (domain && domain !== 'Unknown') {
                    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
                }

                // Legal / Compliance risk
                const rawRisk = (entry.complianceRisk || '').toLowerCase();
                if (rawRisk.includes('high')) riskCounts.high++;
                else if (rawRisk.includes('med')) riskCounts.medium++;
                else if (rawRisk.includes('low') || rawRisk.includes('none')) riskCounts.low++;

                // Build recent audit summary (top 40)
                if (recentAudits.length < 40) {
                    const userInfo = entry.user_id ? userMap.get(entry.user_id) : null;
                    recentAudits.push({
                        id: entry.id,
                        createdAt: entry.created_at,
                        userId: entry.user_id || null,
                        userEmail: userInfo?.email || 'Anonymous',
                        userName: userInfo?.name || 'Member',
                        url: url || '—',
                        domain: domain || '—',
                        title: entry.title || 'Untitled Page',
                        scope,
                        status,
                        complianceRisk: entry.complianceRisk || 'Unknown',
                        bestNextMove: entry.bestNextMove || null,
                        whatThisPageSells: entry.whatThisPageSells || null,
                        topConversionLeaks: Array.isArray(entry.topConversionLeaks) ? entry.topConversionLeaks.slice(0, 3) : [],
                        errorMessage: entry.errorMessage || null,
                    });
                }
            }
        }

        // Top domains sorted by frequency
        const topDomains = Array.from(domainCounts.entries())
            .map(([domain, count]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const successRate = totalAudits > 0 ? Math.round((completedAudits / totalAudits) * 100) : 100;

        const data: ExtensionStatsData = {
            totalAudits,
            completedAudits,
            failedAudits,
            successRate,
            uniqueUsers: uniqueUserIds.size,
            audits24h,
            audits7d,
            audits30d,
            scopeCounts,
            riskCounts,
            topDomains,
            telemetryCounts,
            recentAudits,
        };

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error: any) {
        console.error('[api/admin/extension-stats] Error fetching statistics:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
