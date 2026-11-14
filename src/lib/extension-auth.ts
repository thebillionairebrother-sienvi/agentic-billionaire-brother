import { createMobileAwareClient, isTransientSupabaseError } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { DerekMode } from '@/lib/extension-derek-mode';
import {
    decideExtensionTier,
    hasPaidExtensionAccess,
    readCachedPlan,
    takeOutageAllowance,
    type CachedPlan,
    type PlanTier,
} from '@/lib/extension-plan';

const KNOWN_PRIVILEGED_USERS: Record<string, { id: string; tier: 'brother' | 'team'; isAdmin: boolean }> = {
    'spenceralmodiel@gmail.com': {
        id: '2208e1d4-20e7-4b7f-a672-7477202d8c8a',
        tier: 'brother',
        isAdmin: true,
    },
    'scott@siemvi.com': {
        id: 'scott-siemvi-admin',
        tier: 'team',
        isAdmin: true,
    },
    'yourbro@thebillionairebrother.com': {
        id: 'derek-admin-id',
        tier: 'team',
        isAdmin: true,
    },
};

export interface ExtensionRunMemoryRecord {
    id: string;
    userId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    snapshot: any;
    // Competitor Battle Mode runs (auditScope 'battle') only
    competitorSnapshot?: any;
    auditScope: string;
    derekMode?: DerekMode;
    result: any | null;
    error_message: string | null;
    messages: any[];
    created_at: string;
}

const globalForExtension = globalThis as unknown as {
    __bbExtensionRuns?: Map<string, ExtensionRunMemoryRecord>;
};

export function getExtensionRunMemoryStore(): Map<string, ExtensionRunMemoryRecord> {
    if (!globalForExtension.__bbExtensionRuns) {
        globalForExtension.__bbExtensionRuns = new Map<string, ExtensionRunMemoryRecord>();
    }
    // Cap memory store to 50 recent runs
    if (globalForExtension.__bbExtensionRuns.size > 50) {
        const oldestKey = globalForExtension.__bbExtensionRuns.keys().next().value;
        if (oldestKey) globalForExtension.__bbExtensionRuns.delete(oldestKey);
    }
    return globalForExtension.__bbExtensionRuns;
}

/**
 * Strips multi-megabyte base64 image payloads (screenshot & promoImages[].base64)
 * from a PageSnapshot before persisting to Postgres JSONB.
 * Raw images are kept in memory for Gemini multimodal calls but never stored in audit_logs.
 */
export function sanitizeSnapshotForDb(snapshot: any): any {
    if (!snapshot || typeof snapshot !== 'object') return {};
    const { screenshot: _screenshot, promoImages, ...rest } = snapshot;
    return {
        ...rest,
        hadScreenshot: Boolean(_screenshot),
        promoImages: Array.isArray(promoImages)
            ? promoImages.slice(0, 6).map((img: any) => ({
                  src: img?.src || '',
                  alt: img?.alt || '',
                  title: img?.title,
              }))
            : [],
    };
}

export function getExtensionCorsHeaders(request: Request) {
    const origin = request.headers.get('origin') || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BB-Extension-Email, X-BB-Extension-User-Id',
    };
}

export async function getExtensionUser(request: Request): Promise<User | null> {
    try {
        const { user } = await createMobileAwareClient(request);
        if (user) return user;
    } catch (err) {
        console.warn('[extension-auth] createMobileAwareClient error:', err);
    }

    // Local development only: the extension's cached-session headers and a fixed
    // test account. In production these headers prove nothing (any client can send
    // them with a fake chrome-extension:// Origin), so they are ignored there.
    if (process.env.NODE_ENV === 'development') {
        const extEmail = (request.headers.get('x-bb-extension-email') || '').toLowerCase().trim();
        const extUserId = (request.headers.get('x-bb-extension-user-id') || '').trim();
        const privileged = KNOWN_PRIVILEGED_USERS[extEmail];
        if (extEmail && (privileged || (extUserId && extUserId !== 'placeholder-user-id'))) {
            return {
                id: extUserId || privileged!.id,
                email: extEmail,
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString(),
            } as User;
        }
        return {
            id: '2208e1d4-20e7-4b7f-a672-7477202d8c8a',
            email: 'spenceralmodiel@gmail.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        } as User;
    }

    return null;
}

const globalForPlans = globalThis as unknown as { __bbExtensionPlans?: Map<string, CachedPlan> };
function planCache(): Map<string, CachedPlan> {
    if (!globalForPlans.__bbExtensionPlans) globalForPlans.__bbExtensionPlans = new Map();
    return globalForPlans.__bbExtensionPlans;
}

/**
 * Plan for an authenticated extension user.
 *
 * On a transient Supabase error the last plan verified on this server instance
 * (up to LAST_KNOWN_PLAN_TTL_MS old) is used. With nothing cached the user gets
 * no paid access and dbHealthy=false, so routes answer 503 "try again" instead
 * of either locking out or handing out paid access.
 */
export async function resolveExtensionUserPlan(
    serviceClient: any,
    user: User
): Promise<{
    email: string;
    tier: PlanTier;
    isAdmin: boolean;
    hasRequiredPlan: boolean;
    dbHealthy: boolean;
}> {
    const rawEmail = (user.email || '').toLowerCase().trim();
    const privileged = KNOWN_PRIVILEGED_USERS[rawEmail];

    const fromCacheOrDenied = () => {
        const cached = readCachedPlan(planCache(), user.id);
        const tier: PlanTier = cached?.tier || privileged?.tier || 'free';
        const isAdmin = Boolean(cached?.isAdmin || privileged?.isAdmin);
        return {
            email: cached?.email || rawEmail,
            tier,
            isAdmin,
            hasRequiredPlan: hasPaidExtensionAccess(tier, isAdmin),
            dbHealthy: false,
        };
    };

    try {
        const [userRes, subRes, profileRes] = await Promise.all([
            serviceClient.from('users').select('tier, email').eq('id', user.id).maybeSingle(),
            serviceClient
                .from('subscriptions')
                .select('tier, status')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            serviceClient.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        ]);

        if (userRes.error || subRes.error || profileRes.error) {
            const transient =
                isTransientSupabaseError(userRes.error) ||
                isTransientSupabaseError(subRes.error) ||
                isTransientSupabaseError(profileRes.error);
            console.warn(`[extension-auth] Plan lookup error (${transient ? 'transient' : 'non-transient'}), using last known plan`);
            return fromCacheOrDenied();
        }

        const email = userRes.data?.email || rawEmail;
        const tier = decideExtensionTier({
            usersTier: userRes.data?.tier,
            subscription: subRes.data,
            privilegedTier: privileged?.tier,
        });
        const isAdmin = Boolean(profileRes.data?.role === 'admin' || privileged?.isAdmin);
        planCache().set(user.id, { tier, isAdmin, email, at: Date.now() });

        return {
            email,
            tier,
            isAdmin,
            hasRequiredPlan: hasPaidExtensionAccess(tier, isAdmin),
            dbHealthy: true,
        };
    } catch (err) {
        console.warn('[extension-auth] Plan lookup threw, using last known plan:', err);
        return fromCacheOrDenied();
    }
}

/** Response for "we couldn't verify your plan right now" (DB outage, nothing cached). */
export const PLAN_UNVERIFIED_ERROR =
    'Billionaire Brother could not verify your plan right now (temporary server issue). Please try again in a minute.';

// ── Usage guard outage fallback (per server instance) ──
const globalForOutage = globalThis as unknown as { __bbExtensionOutageLog?: Map<string, number[]> };
/** When usage counters can't be read: a few requests per user per hour instead of no limit. */
export function allowDuringUsageOutage(userId: string): boolean {
    if (!globalForOutage.__bbExtensionOutageLog) globalForOutage.__bbExtensionOutageLog = new Map();
    return takeOutageAllowance(globalForOutage.__bbExtensionOutageLog, userId);
}
