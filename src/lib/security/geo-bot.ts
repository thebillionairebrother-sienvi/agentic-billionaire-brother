import { type NextRequest } from 'next/server';

/**
 * Target Allowed Countries:
 * US = United States
 * CA = Canada
 * GB = United Kingdom (ISO 3166-1 alpha-2 is GB, though UK is often used synonymously)
 */
export const ALLOWED_COUNTRIES = new Set(['US', 'CA', 'GB', 'UK']);

export type UserAgentClassification = 'good_bot' | 'bad_bot' | 'human';

/**
 * Verified search engine bots and social unfurling crawlers.
 * These bots index public metadata, SEO tags, and social cards (Twitter, LinkedIn, Slack, etc.).
 * They must NOT be blocked, preserving SEO indexing and shareability.
 */
const GOOD_BOT_PATTERNS = [
    /googlebot/i,
    /bingbot/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /applebot/i,
    /twitterbot/i,
    /facebookexternalhit/i,
    /linkedinbot/i,
    /slackbot/i,
    /telegrambot/i,
    /whatsapp/i,
    /discordbot/i,
    /skypeuripreview/i,
    /google-inspectiontool/i,
    /google-read-aloud/i,
    /uptimerobot/i,
    /pingdom/i,
];

/**
 * Malicious scrapers, automated exploitation tools, headless automation runners,
 * and automated CLI clients that skew analytics or scrape private business logic.
 */
const BAD_BOT_PATTERNS = [
    // Automation & headless tools
    /headlesschrome/i,
    /phantomjs/i,
    /puppeteer/i,
    /playwright/i,
    /selenium/i,
    /webdriver/i,
    // CLI & scripting libraries commonly used for unauthorized scraping
    /python-requests/i,
    /python-urllib/i,
    /aiohttp/i,
    /httpx/i,
    /scrapy/i,
    /go-http-client/i,
    /apache-httpclient/i,
    /java\//i,
    /libwww-perl/i,
    /wget/i,
    /curl\//i,
    /postmanruntime/i,
    /insomnia/i,
    /colly/i,
    // Vulnerability & security scanners
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zgrab/i,
    /gobuster/i,
    /dirbuster/i,
    /censys/i,
    /shodan/i,
];

/**
 * Extract country code from request headers / edge geo object.
 */
export function extractCountry(request: NextRequest): string | null {
    // 1. Manual dev/test overrides (header or cookie)
    const headerOverride = request.headers.get('x-override-country') || request.headers.get('x-country-override');
    if (headerOverride) {
        return headerOverride.trim().toUpperCase();
    }

    const cookieOverride = request.cookies.get('bb_country_override')?.value;
    if (cookieOverride) {
        return cookieOverride.trim().toUpperCase();
    }

    // 2. Vercel Edge Geolocation Header
    const vercelCountry = request.headers.get('x-vercel-ip-country');
    if (vercelCountry) {
        return vercelCountry.trim().toUpperCase();
    }

    // 3. NextRequest Geo Object (if available in edge runtime)
    const geoCountry = (request as any).geo?.country;
    if (geoCountry && typeof geoCountry === 'string') {
        return geoCountry.trim().toUpperCase();
    }

    // 4. Cloudflare Header
    const cfCountry = request.headers.get('cf-ipcountry');
    if (cfCountry) {
        return cfCountry.trim().toUpperCase();
    }

    // 5. Standard CDN / Reverse Proxy Headers
    const genericCountry = request.headers.get('x-country-code') || request.headers.get('x-geo-country');
    if (genericCountry) {
        return genericCountry.trim().toUpperCase();
    }

    return null;
}

/**
 * Determine if request is running locally or in development environment.
 */
export function isLocalOrDevelopment(request: NextRequest): boolean {
    if (process.env.NODE_ENV === 'development') {
        return true;
    }

    const host = request.headers.get('host') || request.nextUrl.host || '';
    if (
        host.includes('localhost') ||
        host.startsWith('127.0.0.1') ||
        host.startsWith('[::1]') ||
        host.endsWith('.local')
    ) {
        return true;
    }

    return false;
}

/**
 * Check if the given country is permitted.
 */
export function isAllowedCountry(countryCode: string | null | undefined): boolean {
    if (!countryCode) return false;
    const normalized = countryCode.trim().toUpperCase();
    return ALLOWED_COUNTRIES.has(normalized);
}

/**
 * Classify incoming User-Agent string.
 */
export function classifyUserAgent(ua: string | null | undefined): UserAgentClassification {
    if (!ua || ua.trim().length === 0) {
        // Missing user agent is typical of low-effort scrapers
        return 'bad_bot';
    }

    const trimmed = ua.trim();

    // Check for good bots first (e.g. Googlebot, Twitterbot)
    for (const pattern of GOOD_BOT_PATTERNS) {
        if (pattern.test(trimmed)) {
            return 'good_bot';
        }
    }

    // Check for bad bots & scrapers
    for (const pattern of BAD_BOT_PATTERNS) {
        if (pattern.test(trimmed)) {
            return 'bad_bot';
        }
    }

    return 'human';
}

/**
 * Check if route is exempt from geo-fencing and general bot blocking.
 */
export function isExemptRoute(pathname: string): boolean {
    // 1. Static and system assets
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/images') ||
        pathname.startsWith('/fonts') ||
        pathname === '/favicon.ico' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|pdf|txt|css|js|map)$/i)
    ) {
        return true;
    }

    // 2. Webhooks (Stripe, Resend, Supabase webhooks must always pass through)
    if (pathname.startsWith('/api/webhooks')) {
        return true;
    }

    // 3. Extension backend API (authenticated via tokens / session)
    if (pathname.startsWith('/api/extension')) {
        return true;
    }

    // 4. Region restriction page itself and its waitlist API
    if (pathname === '/region-restricted' || pathname.startsWith('/api/leads/waitlist')) {
        return true;
    }

    // 5. Cron maintenance routes
    if (pathname.startsWith('/api/cron')) {
        return true;
    }

    return false;
}
