import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import {
    CHROME_EXTENSION_ID,
    aggregateGrowth,
    parseUpdateCheckVersion,
    type ExtensionGrowthData,
    type TelemetryRow,
} from '@/lib/extension-growth';

export const revalidate = 0;

const PAGE_SIZE = 1000; // PostgREST caps each response at ~1000 rows
const MAX_ROWS = 100_000;
const UPDATE_CHECK_TIMEOUT_MS = 5000;
const TELEMETRY_COLUMNS = 'created_at, eventName:metadata->>eventName, clientId:metadata->>clientId, extVersion:metadata->params->>ext_version';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

async function fetchLiveVersion(): Promise<string | null> {
    // prodversion must be >= the manifest's minimum_chrome_version (120)
    const url = `https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=130.0&acceptformat=crx3&x=${encodeURIComponent(`id=${CHROME_EXTENSION_ID}&uc`)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
    try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!res.ok) return null;
        return parseUpdateCheckVersion(await res.text());
    } catch (err) {
        console.warn('[api/admin/extension-growth] Update check failed:', err);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchTelemetry(
    serviceClient: ServiceClient,
    filter: { since?: string; eventNames?: string[] }
): Promise<TelemetryRow[]> {
    const rows: TelemetryRow[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
        let query = serviceClient
            .from('audit_logs')
            .select(TELEMETRY_COLUMNS)
            .eq('action', 'extension_telemetry')
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }) // unique tiebreaker so equal timestamps can't shift across pages
            .range(from, from + PAGE_SIZE - 1);
        if (filter.since) query = query.gte('created_at', filter.since);
        if (filter.eventNames) query = query.in('metadata->>eventName', filter.eventNames);

        const { data, error } = await query;
        if (error) throw error;
        rows.push(...((data || []) as unknown as TelemetryRow[]));
        if (!data || data.length < PAGE_SIZE) break;
    }
    return rows;
}

/** Returns when this version was first seen on the store, recording it if it's new. */
async function recordVersionFirstSeen(serviceClient: ServiceClient, version: string): Promise<string> {
    const { data } = await serviceClient
        .from('audit_logs')
        .select('created_at')
        .eq('action', 'extension_store_version')
        .eq('metadata->>version', version)
        .order('created_at', { ascending: true })
        .limit(1);
    if (data && data.length > 0) return data[0].created_at;

    const now = new Date().toISOString();
    // Concurrent dashboard loads may insert duplicates; reading the earliest row keeps the date correct
    await serviceClient.from('audit_logs').insert({
        user_id: null,
        action: 'extension_store_version',
        entity_type: 'extension',
        metadata: { version, extensionId: CHROME_EXTENSION_ID },
        created_at: now,
    });
    return now;
}

function distinctClients(rows: TelemetryRow[], eventName: string): number {
    return new Set(rows.filter(r => r.eventName === eventName && r.clientId).map(r => r.clientId)).size;
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
        const now = Date.now();
        const since = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

        const [liveVersion, recentRows, lifecycleRows, earliest] = await Promise.all([
            fetchLiveVersion(),
            fetchTelemetry(serviceClient, { since }),
            fetchTelemetry(serviceClient, { eventNames: ['extension_installed', 'extension_uninstalled'] }),
            serviceClient
                .from('audit_logs')
                .select('created_at')
                .eq('action', 'extension_telemetry')
                .not('metadata->>clientId', 'is', null)
                .order('created_at', { ascending: true })
                .limit(1),
        ]);

        const liveVersionFirstSeen = liveVersion
            ? await recordVersionFirstSeen(serviceClient, liveVersion).catch(() => null)
            : null;

        const data: ExtensionGrowthData = {
            extensionId: CHROME_EXTENSION_ID,
            storeUrl: `https://chromewebstore.google.com/detail/${CHROME_EXTENSION_ID}`,
            liveVersion,
            liveVersionFirstSeen,
            ...aggregateGrowth(recentRows, now, liveVersion),
            totalInstalls: distinctClients(lifecycleRows, 'extension_installed'),
            totalUninstalls: distinctClients(lifecycleRows, 'extension_uninstalled'),
            trackingSince: earliest.data?.[0]?.created_at ?? null,
            generatedAt: new Date(now).toISOString(),
        };

        return NextResponse.json({ success: true, data }, { status: 200 });
    } catch (error: unknown) {
        console.error('[api/admin/extension-growth] Error computing growth metrics:', error);
        return NextResponse.json(
            { error: (error instanceof Error && error.message) || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
