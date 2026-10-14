import { createMobileAwareClient, isTransientSupabaseError } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

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
    auditScope: string;
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

    // Check extension session recovery headers (sent by the Chrome Extension from cached session storage)
    const extEmail = (request.headers.get('x-bb-extension-email') || '').toLowerCase().trim();
    const extUserId = (request.headers.get('x-bb-extension-user-id') || '').trim();
    const origin = request.headers.get('origin') || '';
    const isExtensionOrigin = origin.startsWith('chrome-extension://') || process.env.NODE_ENV === 'development';

    if (isExtensionOrigin && extEmail) {
        const privileged = KNOWN_PRIVILEGED_USERS[extEmail];
        if (privileged) {
            return {
                id: extUserId || privileged.id,
                email: extEmail,
                app_metadata: {},
                user_metadata: { tier: privileged.tier },
                aud: 'authenticated',
                created_at: new Date().toISOString(),
            } as User;
        }
        if (extUserId && extUserId !== 'placeholder-user-id') {
            return {
                id: extUserId,
                email: extEmail,
                app_metadata: {},
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString(),
            } as User;
        }
    }

    // In local development, fall back to Spencer's account for seamless extension testing
    if (process.env.NODE_ENV === 'development') {
        return {
            id: '2208e1d4-20e7-4b7f-a672-7477202d8c8a',
            email: 'spenceralmodiel@gmail.com',
            app_metadata: {},
            user_metadata: { tier: 'brother' },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
        } as User;
    }

    return null;
}

export async function resolveExtensionUserPlan(
    serviceClient: any,
    user: User
): Promise<{
    email: string;
    tier: 'free' | 'brother' | 'team';
    isAdmin: boolean;
    hasRequiredPlan: boolean;
    dbHealthy: boolean;
}> {
    const rawEmail = (user.email || user.user_metadata?.email || '').toLowerCase().trim();
    const privileged = KNOWN_PRIVILEGED_USERS[rawEmail];

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

        const anyTransientError =
            isTransientSupabaseError(userRes.error) ||
            isTransientSupabaseError(subRes.error) ||
            isTransientSupabaseError(profileRes.error);

        const email = userRes.data?.email || rawEmail;
        const dbTier = (subRes.data?.tier || userRes.data?.tier || '').toLowerCase();
        const metaTier = (user.user_metadata?.tier || '').toLowerCase();

        let tier: 'free' | 'brother' | 'team' = 'free';
        if (dbTier === 'team' || metaTier === 'team' || privileged?.tier === 'team') {
            tier = 'team';
        } else if (dbTier === 'brother' || metaTier === 'brother' || privileged?.tier === 'brother') {
            tier = 'brother';
        } else if (anyTransientError) {
            // Do not downgrade an authenticated extension user to 'free' during a transient DB 504/522
            tier = 'brother';
        }

        const isAdmin = Boolean(profileRes.data?.role === 'admin' || privileged?.isAdmin);
        const hasRequiredPlan = tier === 'brother' || tier === 'team' || isAdmin;

        return {
            email,
            tier,
            isAdmin,
            hasRequiredPlan,
            dbHealthy: !anyTransientError,
        };
    } catch (err) {
        console.warn('[extension-auth] Plan lookup fallback due to DB error:', err);
        const tier: 'free' | 'brother' | 'team' = privileged?.tier || 'brother';
        const isAdmin = Boolean(privileged?.isAdmin);
        return {
            email: rawEmail,
            tier,
            isAdmin,
            hasRequiredPlan: true,
            dbHealthy: false,
        };
    }
}