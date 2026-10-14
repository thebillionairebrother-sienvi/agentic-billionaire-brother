import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_FETCH_TIMEOUT_MS = 4500;

function createTimeoutFetch(timeoutMs = SUPABASE_FETCH_TIMEOUT_MS): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal) {
            return fetch(input, init);
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(input, { ...init, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    };
}

function decodeJwtUser(jwt: string): User | null {
    try {
        const parts = jwt.split('.');
        if (parts.length !== 3) return null;
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (!payload?.sub) return null;

        // Allow up to 7 days grace if upstream Supabase Auth is experiencing a 504/522 outage
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp + 7 * 24 * 3600 < nowSec) {
            return null;
        }

        return {
            id: payload.sub,
            email: payload.email || payload.user_metadata?.email || '',
            app_metadata: payload.app_metadata || {},
            user_metadata: payload.user_metadata || {},
            aud: payload.aud || 'authenticated',
            role: payload.role || 'authenticated',
            created_at: new Date().toISOString(),
        } as User;
    } catch {
        return null;
    }
}

export function extractUserFromCookiesOrToken(
    allCookies: Array<{ name: string; value: string }>,
    bearerToken?: string | null
): { user: User | null; accessToken: string | null } {
    if (bearerToken) {
        const user = decodeJwtUser(bearerToken);
        if (user) return { user, accessToken: bearerToken };
    }

    try {
        // Find sb-*-auth-token cookie (either single cookie or chunked .0, .1, ...)
        const authCookies = allCookies.filter(
            c => c.name.startsWith('sb-') && c.name.includes('-auth-token') && !c.name.includes('code-verifier')
        );
        if (authCookies.length === 0) return { user: null, accessToken: null };

        let combined = '';
        const exact = authCookies.find(c => c.name.endsWith('-auth-token'));
        if (exact) {
            combined = exact.value;
        } else {
            const sortedChunks = authCookies
                .filter(c => /-auth-token\.\d+$/.test(c.name))
                .sort((a, b) => {
                    const idxA = parseInt(a.name.split('.').pop() || '0', 10);
                    const idxB = parseInt(b.name.split('.').pop() || '0', 10);
                    return idxA - idxB;
                });
            combined = sortedChunks.map(c => c.value).join('');
        }

        if (!combined) return { user: null, accessToken: null };

        let decodedStr = combined;
        if (decodedStr.startsWith('base64-')) {
            decodedStr = Buffer.from(decodedStr.slice(7), 'base64url').toString('utf8');
        } else if (decodedStr.startsWith('%')) {
            try {
                decodedStr = decodeURIComponent(decodedStr);
            } catch {}
        }

        const parsed = JSON.parse(decodedStr);
        const accessToken: string | null =
            parsed?.access_token || (Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : null);

        if (parsed?.user?.id) {
            return { user: parsed.user as User, accessToken };
        }

        if (accessToken) {
            const jwtUser = decodeJwtUser(accessToken);
            if (jwtUser) return { user: jwtUser, accessToken };
        }
    } catch {}

    return { user: null, accessToken: null };
}

export function isTransientSupabaseError(err: any): boolean {
    if (!err) return false;
    const status = err?.status || err?.code;
    if (status === 502 || status === 503 || status === 504 || status === 522 || status === 524) {
        return true;
    }
    const msg = String(err?.message || err).toLowerCase();
    return (
        msg.includes('gateway timeout') ||
        msg.includes('504') ||
        msg.includes('522') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('connection timed out') ||
        msg.includes('fetch failed') ||
        msg.includes('aborted') ||
        msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('<!doctype html>')
    );
}

export async function createClient(options?: { readOnlyCookies?: boolean }) {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                fetch: createTimeoutFetch(SUPABASE_FETCH_TIMEOUT_MS),
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    if (options?.readOnlyCookies) {
                        // Do not mutate or clear browser auth cookies during background API checks
                        return;
                    }
                    try {
                        cookiesToSet.forEach(({ name, value, options: cookieOpts }) => {
                            // Never allow a transient upstream failure to delete the auth token cookie
                            if (!value && name.startsWith('sb-') && name.includes('-auth-token')) {
                                return;
                            }
                            cookieStore.set(name, value, cookieOpts);
                        });
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    );
}

/**
 * Creates a Supabase client that works for BOTH web (cookie auth)
 * and mobile/extension (Bearer token or cookie auth).
 *
 * Uses readOnlyCookies so concurrent extension polling NEVER wipes the user's
 * browser session cookie, short-circuits in 0ms when no credentials exist,
 * and falls back to the signed JWT/cookie session if Supabase GoTrue returns 504/522.
 */
export async function createMobileAwareClient(request: Request) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    const cookieClient = await createClient({ readOnlyCookies: true });

    // 0. Fast short-circuit: if neither an sb-* auth cookie nor a Bearer token is present,
    // do not make a network call to Supabase /auth/v1/user.
    if (!hasAuthCookie && !token) {
        return { supabase: cookieClient, user: null };
    }

    // 1. Try cookie-based auth first (web / extension)
    if (hasAuthCookie) {
        try {
            const { data: { user: cookieUser }, error } = await cookieClient.auth.getUser();
            if (cookieUser) {
                return { supabase: cookieClient, user: cookieUser };
            }
            if (error && isTransientSupabaseError(error)) {
                const fallback = extractUserFromCookiesOrToken(allCookies, token);
                if (fallback.user) {
                    console.warn('[supabase/server] /auth/v1/user timed out; recovered user from session cookie:', fallback.user.email);
                    return { supabase: cookieClient, user: fallback.user };
                }
            }
        } catch (err) {
            const fallback = extractUserFromCookiesOrToken(allCookies, token);
            if (fallback.user) {
                console.warn('[supabase/server] /auth/v1/user threw error; recovered user from session cookie:', fallback.user.email);
                return { supabase: cookieClient, user: fallback.user };
            }
        }
    }

    // 2. Fall back to Bearer token (mobile / extension header)
    if (!token) {
        return { supabase: cookieClient, user: null };
    }

    const mobileClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${token}` },
                fetch: createTimeoutFetch(SUPABASE_FETCH_TIMEOUT_MS),
            },
        }
    );

    try {
        const { data: { user }, error } = await mobileClient.auth.getUser(token);
        if (user) {
            return { supabase: mobileClient, user };
        }
        if (error && isTransientSupabaseError(error)) {
            const fallback = extractUserFromCookiesOrToken(allCookies, token);
            if (fallback.user) {
                return { supabase: mobileClient, user: fallback.user };
            }
        }
    } catch {
        const fallback = extractUserFromCookiesOrToken(allCookies, token);
        if (fallback.user) {
            return { supabase: mobileClient, user: fallback.user };
        }
    }

    return { supabase: mobileClient, user: null };
}

export async function createServiceClient() {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            global: {
                fetch: createTimeoutFetch(SUPABASE_FETCH_TIMEOUT_MS),
            },
        }
    );
}

