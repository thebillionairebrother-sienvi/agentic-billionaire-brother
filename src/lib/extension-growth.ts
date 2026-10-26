/**
 * Chrome extension growth metrics for the admin dashboard.
 *
 * The extension is flagged "Mature content" on the Chrome Web Store, so its public listing is hidden from
 * signed-out visitors and cannot be scraped. Instead:
 * - the live version comes from Google's update server (works for any published item), and
 * - users/installs/uninstalls come from our own extension telemetry rows in audit_logs.
 */

export const CHROME_EXTENSION_ID = process.env.CHROME_EXTENSION_ID || 'ofaehbeohogfjnfbfjpnceihhnegamnh';

// Lifecycle events are sent by the service worker without user interaction (e.g. Chrome auto-updates),
// so they must not count towards "active" users.
export const LIFECYCLE_EVENTS = ['extension_installed', 'extension_updated', 'extension_uninstalled'] as const;

export interface TelemetryRow {
    created_at: string;
    eventName: string | null;
    clientId: string | null;
    extVersion?: string | null;
}

export interface WindowCount {
    current: number;
    previous: number;
}

export interface ExtensionGrowthData {
    extensionId: string;
    storeUrl: string;
    liveVersion: string | null;
    liveVersionFirstSeen: string | null;
    activeUsers: {
        day: WindowCount;
        week: WindowCount;
        month: WindowCount;
    };
    installs: WindowCount; // last 30 days vs previous 30 days
    uninstalls: WindowCount; // last 30 days vs previous 30 days
    totalInstalls: number;
    totalUninstalls: number;
    clientsOnLiveVersion: number | null; // null until events carry ext_version (extension v1.0.19+)
    trackingSince: string | null;
    generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extracts the published version from the update server's gupdate XML.
 * Anchored on <updatecheck> because the root <gupdate> element also has a version-like protocol attribute.
 */
export function parseUpdateCheckVersion(xml: string): string | null {
    const tag = xml.match(/<updatecheck\b[^>]*>/i)?.[0];
    if (!tag) return null;
    const status = tag.match(/\bstatus="([^"]*)"/i)?.[1];
    if (status && status !== 'ok') return null;
    return tag.match(/\bversion="([^"]+)"/i)?.[1] ?? null;
}

function countDistinct(rows: TelemetryRow[], start: number, end: number, include: (row: TelemetryRow) => boolean): number {
    const ids = new Set<string>();
    for (const row of rows) {
        if (!row.clientId || !include(row)) continue;
        const t = new Date(row.created_at).getTime();
        if (t >= start && t < end) ids.add(row.clientId);
    }
    return ids.size;
}

function windowCount(rows: TelemetryRow[], now: number, days: number, include: (row: TelemetryRow) => boolean): WindowCount {
    const span = days * DAY_MS;
    return {
        current: countDistinct(rows, now - span, now + 1, include),
        previous: countDistinct(rows, now - 2 * span, now - span, include),
    };
}

/**
 * Aggregates telemetry rows (expected to cover at least the last 60 days) into distinct-client counts.
 * Windows are rolling: "week" is the last 7 days, compared with the 7 days before that.
 */
export function aggregateGrowth(rows: TelemetryRow[], now: number, liveVersion: string | null) {
    const lifecycle = new Set<string>(LIFECYCLE_EVENTS);
    const isActive = (row: TelemetryRow) => !!row.eventName && !lifecycle.has(row.eventName);
    const isInstall = (row: TelemetryRow) => row.eventName === 'extension_installed';
    const isUninstall = (row: TelemetryRow) => row.eventName === 'extension_uninstalled';

    // Any non-uninstall event on the live version means that client is running it
    const onLiveVersion = (row: TelemetryRow) =>
        !!liveVersion && row.extVersion === liveVersion && !isUninstall(row);

    return {
        activeUsers: {
            day: windowCount(rows, now, 1, isActive),
            week: windowCount(rows, now, 7, isActive),
            month: windowCount(rows, now, 30, isActive),
        },
        installs: windowCount(rows, now, 30, isInstall),
        uninstalls: windowCount(rows, now, 30, isUninstall),
        clientsOnLiveVersion: rows.some(row => row.extVersion)
            ? countDistinct(rows, now - 30 * DAY_MS, now + 1, onLiveVersion)
            : null,
    };
}
