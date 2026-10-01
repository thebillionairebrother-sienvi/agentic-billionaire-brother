import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
    classifyUserAgent,
    extractCountry,
    isAllowedCountry,
    isExemptRoute,
    isLocalOrDevelopment,
} from '@/lib/security/geo-bot';

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // 1. Bypass check: static assets, system files, webhooks, extension APIs, and waitlist
    if (isExemptRoute(pathname)) {
        if (pathname === '/region-restricted') {
            const response = NextResponse.next();
            response.headers.set('x-bb-restricted', '1');
            return response;
        }
        return await updateSession(request);
    }

    // 2. User-Agent Classification
    const userAgent = request.headers.get('user-agent');
    const classification = classifyUserAgent(userAgent);

    // 3. Bad Bot Filtering: Immediately block scrapers, automated runners, and vulnerability scanners
    if (classification === 'bad_bot') {
        return new NextResponse(
            JSON.stringify({
                error: 'Forbidden',
                message: 'Automated access, scrapers, and unrecognized automated clients are not permitted.',
            }),
            {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0',
                },
            }
        );
    }

    // 4. Good Bot Handling (Search Engines & Social Crawlers)
    // Allow Googlebot, Bingbot, Twitterbot, LinkedInBot, etc. to crawl public pages
    // so SEO rankings, metadata indexing, and social unfurling cards remain fully functional.
    if (classification === 'good_bot') {
        const response = NextResponse.next();
        response.headers.set('x-bb-crawler', '1');
        return response;
    }

    // 5. Authenticated Users Bypass
    // Logged-in customers or team members traveling abroad should not be locked out.
    const hasAuthCookie = request.cookies
        .getAll()
        .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

    if (hasAuthCookie) {
        return await updateSession(request);
    }

    // 6. Geo-Fencing: Target Audience US / Canada / UK
    const isDev = isLocalOrDevelopment(request);
    const country = extractCountry(request);

    if (!isDev && country) {
        if (!isAllowedCountry(country)) {
            // Redirect out-of-region visitor to the branded waitlist landing page
            const redirectUrl = request.nextUrl.clone();
            redirectUrl.pathname = '/region-restricted';
            redirectUrl.searchParams.set('country', country);
            return NextResponse.redirect(redirectUrl, { status: 307 });
        }
    }

    // 7. Allowed human visitor: update Supabase auth session and pass through
    const response = await updateSession(request);
    if (country) {
        response.headers.set('x-bb-country', country);
    }
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder assets
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
