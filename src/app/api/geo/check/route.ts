import { NextResponse } from 'next/server';
import {
    extractCountry,
    hasBypassAccess,
    isAllowedCountry,
} from '@/lib/security/geo-bot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const nextReq = request as any;

        // 1. Check if user already holds bypass access (cookie or key)
        const cookieHeader = request.headers.get('cookie') || '';
        const hasBypassCookie =
            cookieHeader.includes('bb_geo_bypass=valid') ||
            cookieHeader.includes('bb_geo_bypass=');

        const url = new URL(request.url);
        const queryKey =
            url.searchParams.get('key') ||
            url.searchParams.get('bypass') ||
            url.searchParams.get('secret');

        if (hasBypassCookie || (queryKey && queryKey.length > 0)) {
            return NextResponse.json({
                allowed: true,
                country: 'BYPASS',
                message: 'Tester bypass active',
            });
        }

        // 2. Try resolving country from incoming proxy / CDN headers
        let detectedCountry =
            request.headers.get('x-vercel-ip-country') ||
            request.headers.get('x-appengine-country') ||
            request.headers.get('cf-ipcountry') ||
            request.headers.get('x-country-code') ||
            request.headers.get('x-override-country');

        let clientIp =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            '';

        // 3. If country header is absent, perform IP geolocation lookup
        if (!detectedCountry || detectedCountry.length !== 2) {
            try {
                // If clientIp is a private or loopback IP (e.g. testing localhost from Philippines),
                // query api.country.is without IP to resolve the caller's public IP
                const isPrivate =
                    !clientIp ||
                    clientIp === '127.0.0.1' ||
                    clientIp === '::1' ||
                    clientIp.startsWith('192.168.') ||
                    clientIp.startsWith('10.') ||
                    clientIp.startsWith('172.');

                const lookupUrl = isPrivate
                    ? 'https://api.country.is'
                    : `https://api.country.is/${encodeURIComponent(clientIp)}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2500);

                const geoRes = await fetch(lookupUrl, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'BillionaireBrother-Geo/1.0' },
                });
                clearTimeout(timeoutId);

                if (geoRes.ok) {
                    const geoJson = await geoRes.json();
                    if (geoJson.country && typeof geoJson.country === 'string') {
                        detectedCountry = geoJson.country.toUpperCase();
                        if (geoJson.ip) {
                            clientIp = geoJson.ip;
                        }
                    }
                }
            } catch (err) {
                console.warn('[geo/check] External IP lookup fallback failed:', err);
            }
        }

        const country = (detectedCountry || 'UNKNOWN').toUpperCase();
        const allowed = isAllowedCountry(country);

        const response = NextResponse.json({
            allowed,
            country,
            ip: clientIp || undefined,
        });

        // Cache detected country in a 24-hour cookie so edge proxy catches it instantly on future hits
        if (country && country !== 'UNKNOWN') {
            response.cookies.set('bb_detected_country', country, {
                path: '/',
                maxAge: 86400, // 24 hours
                sameSite: 'lax',
                httpOnly: false, // Accessible to client scripts
            });
        }

        return response;
    } catch (err: any) {
        console.error('[geo/check] Error in geo check:', err);
        return NextResponse.json({
            allowed: true, // Fail open if error to avoid breaking site entirely
            country: 'UNKNOWN',
            error: err.message,
        });
    }
}
