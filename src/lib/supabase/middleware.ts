import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { extractUserFromCookiesOrToken, isTransientSupabaseError } from './server';
import type { User } from '@supabase/supabase-js';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const allCookies = request.cookies.getAll();
    const hasAuthCookie = allCookies.some(
        c => c.name.startsWith('sb-') && c.name.includes('-auth-token') && !c.name.includes('code-verifier')
    );

    const protectedPaths = ['/dashboard', '/onboard', '/strategies', '/commit', '/brief', '/ship-pack', '/board-meeting', '/settings', '/assets', '/admin'];
    const isProtected = protectedPaths.some((path) =>
        request.nextUrl.pathname.startsWith(path)
    );

    // Fast path: if visitor has no Supabase auth cookie at all, skip network call to /auth/v1/user
    if (!hasAuthCookie) {
        if (isProtected) {
            const url = request.nextUrl.clone();
            url.pathname = '/auth';
            url.searchParams.set('redirect', request.nextUrl.pathname);
            return NextResponse.redirect(url);
        }
        return supabaseResponse;
    }

    let pendingCookiesToSet: Array<{ name: string; value: string; options?: any }> = [];

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
                    if (init?.signal) return fetch(input, init);
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 4000);
                    try {
                        return await fetch(input, { ...init, signal: controller.signal });
                    } finally {
                        clearTimeout(timer);
                    }
                },
            },
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    pendingCookiesToSet = cookiesToSet;
                },
            },
        }
    );

    let user: User | null = null;
    let hadTransientError = false;

    try {
        const { data, error } = await supabase.auth.getUser();
        user = data?.user ?? null;
        if (error && isTransientSupabaseError(error)) {
            hadTransientError = true;
            user = extractUserFromCookiesOrToken(allCookies).user;
        }
    } catch {
        hadTransientError = true;
        user = extractUserFromCookiesOrToken(allCookies).user;
    }

    // Apply cookie updates ONLY if we did not hit a transient 504/522 upstream failure
    // (prevents @supabase/ssr from deleting the user's auth cookie when GoTrue times out)
    if (!hadTransientError && pendingCookiesToSet.length > 0) {
        pendingCookiesToSet.forEach(({ name, value }) => {
            if (!value && name.startsWith('sb-') && name.includes('-auth-token')) {
                return;
            }
            request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
            request,
        });
        pendingCookiesToSet.forEach(({ name, value, options }) => {
            if (!value && name.startsWith('sb-') && name.includes('-auth-token')) {
                return;
            }
            supabaseResponse.cookies.set(name, value, options);
        });
    }

    if (isProtected && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth';
        url.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(url);
    }

    // If logged in and visiting auth page, redirect to dashboard
    if (user && request.nextUrl.pathname === '/auth') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

