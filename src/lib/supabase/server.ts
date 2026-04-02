import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing sessions.
                    }
                },
            },
        }
    );
}

/**
 * Creates a Supabase client that works for BOTH web (cookie auth)
 * and mobile (Bearer token auth). Pass the incoming request so we
 * can read the Authorization header as a fallback.
 *
 * Usage in API routes:
 *   const { supabase, user } = await createMobileAwareClient(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function createMobileAwareClient(request: Request) {
    // 1. Try cookie-based auth first (web)
    const cookieClient = await createClient();
    const { data: { user: cookieUser } } = await cookieClient.auth.getUser();

    if (cookieUser) {
        return { supabase: cookieClient, user: cookieUser };
    }

    // 2. Fall back to Bearer token (mobile)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return { supabase: cookieClient, user: null };
    }

    // Create an anon client with the Bearer token injected as a global header.
    // Supabase RLS will use this token to authorize queries.
    const mobileClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        }
    );

    const { data: { user } } = await mobileClient.auth.getUser(token);

    return { supabase: mobileClient, user };
}

export async function createServiceClient() {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}
