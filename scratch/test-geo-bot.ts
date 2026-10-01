import { NextRequest } from 'next/server';
import {
    isAllowedCountry,
    classifyUserAgent,
    isExemptRoute,
    extractCountry,
    ALLOWED_COUNTRIES,
} from '../src/lib/security/geo-bot';
import { proxy } from '../src/proxy';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key-for-test';
}

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${msg}`);
}

async function runTests() {
    console.log('--- Testing isAllowedCountry ---');
    assert(isAllowedCountry('US') === true, 'US is allowed');
    assert(isAllowedCountry('us') === true, 'us (lowercase) is allowed');
    assert(isAllowedCountry('CA') === true, 'CA is allowed');
    assert(isAllowedCountry('ca') === true, 'ca (lowercase) is allowed');
    assert(isAllowedCountry('GB') === true, 'GB is allowed');
    assert(isAllowedCountry('gb') === true, 'gb (lowercase) is allowed');
    assert(isAllowedCountry('UK') === true, 'UK is allowed');
    assert(isAllowedCountry('FR') === false, 'FR is rejected');
    assert(isAllowedCountry('DE') === false, 'DE is rejected');
    assert(isAllowedCountry('AU') === false, 'AU is rejected');
    assert(isAllowedCountry('IN') === false, 'IN is rejected');
    assert(isAllowedCountry('SG') === false, 'SG is rejected');
    assert(isAllowedCountry(null) === false, 'null is rejected');
    assert(isAllowedCountry(undefined) === false, 'undefined is rejected');

    console.log('\n--- Testing classifyUserAgent ---');
    // Good bots (Search engines & social unfurlers)
    assert(classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)') === 'good_bot', 'Googlebot is good_bot');
    assert(classifyUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)') === 'good_bot', 'Bingbot is good_bot');
    assert(classifyUserAgent('Twitterbot/1.0') === 'good_bot', 'Twitterbot is good_bot');
    assert(classifyUserAgent('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)') === 'good_bot', 'facebookexternalhit is good_bot');
    assert(classifyUserAgent('LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)') === 'good_bot', 'LinkedInBot is good_bot');
    assert(classifyUserAgent('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)') === 'good_bot', 'Slackbot is good_bot');

    // Bad bots (Scrapers, automation, scanners)
    assert(classifyUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/118.0.5993.88 Safari/537.36') === 'bad_bot', 'HeadlessChrome is bad_bot');
    assert(classifyUserAgent('puppeteer-extra-plugin-stealth') === 'bad_bot', 'Puppeteer is bad_bot');
    assert(classifyUserAgent('Playwright/1.38.0 (x64; linux)') === 'bad_bot', 'Playwright is bad_bot');
    assert(classifyUserAgent('python-requests/2.31.0') === 'bad_bot', 'python-requests is bad_bot');
    assert(classifyUserAgent('curl/8.4.0') === 'bad_bot', 'curl is bad_bot');
    assert(classifyUserAgent('Wget/1.21.4') === 'bad_bot', 'Wget is bad_bot');
    assert(classifyUserAgent('sqlmap/1.7#stable (http://sqlmap.org)') === 'bad_bot', 'sqlmap is bad_bot');
    assert(classifyUserAgent('') === 'bad_bot', 'Empty UA is bad_bot');
    assert(classifyUserAgent(null) === 'bad_bot', 'Null UA is bad_bot');

    // Humans
    assert(classifyUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36') === 'human', 'Chrome desktop is human');
    assert(classifyUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1') === 'human', 'Safari mobile is human');

    console.log('\n--- Testing isExemptRoute ---');
    assert(isExemptRoute('/_next/static/chunks/main.js') === true, '/_next is exempt');
    assert(isExemptRoute('/images/og-image.jpg') === true, '/images is exempt');
    assert(isExemptRoute('/favicon.ico') === true, 'favicon.ico is exempt');
    assert(isExemptRoute('/robots.txt') === true, 'robots.txt is exempt');
    assert(isExemptRoute('/sitemap.xml') === true, 'sitemap.xml is exempt');
    assert(isExemptRoute('/api/webhooks/stripe') === true, 'stripe webhook is exempt');
    assert(isExemptRoute('/api/extension/session') === true, 'extension api is exempt');
    assert(isExemptRoute('/region-restricted') === true, '/region-restricted is exempt');
    assert(isExemptRoute('/api/leads/waitlist') === true, '/api/leads/waitlist is exempt');
    assert(isExemptRoute('/') === false, 'homepage / is not exempt');
    assert(isExemptRoute('/dashboard') === false, '/dashboard is not exempt');
    assert(isExemptRoute('/guide') === false, '/guide is not exempt');

    console.log('\n--- Testing extractCountry ---');
    const reqVercel = new NextRequest('http://example.com/', {
        headers: { 'x-vercel-ip-country': 'ca' },
    });
    assert(extractCountry(reqVercel) === 'CA', 'extractCountry picks up x-vercel-ip-country');

    const reqCloudflare = new NextRequest('http://example.com/', {
        headers: { 'cf-ipcountry': 'gb' },
    });
    assert(extractCountry(reqCloudflare) === 'GB', 'extractCountry picks up cf-ipcountry');

    const reqOverride = new NextRequest('http://example.com/', {
        headers: { 'x-override-country': 'us' },
    });
    assert(extractCountry(reqOverride) === 'US', 'extractCountry honors x-override-country');

    console.log('\n--- Testing Full Proxy Request Pipeline ---');
    // Test 1: Bad Bot blocked with 403
    const badBotReq = new NextRequest('http://thebillionairebrother.com/', {
        headers: {
            'user-agent': 'python-requests/2.31.0',
            'x-vercel-ip-country': 'US',
        },
    });
    const badBotRes = await proxy(badBotReq);
    assert(badBotRes.status === 403, 'Bad bot is blocked with 403');

    // Test 2: Good Bot allowed
    const goodBotReq = new NextRequest('http://thebillionairebrother.com/', {
        headers: {
            'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'x-vercel-ip-country': 'FR', // Even from non-target country, Googlebot is allowed for SEO indexing
        },
    });
    const goodBotRes = await proxy(goodBotReq);
    assert(goodBotRes.status === 200, 'Good bot passes through for SEO indexing');
    assert(goodBotRes.headers.get('x-bb-crawler') === '1', 'Crawler header set');

    // Test 3: Non-target country human redirected to /region-restricted
    // Note: Emulate production host
    const frHumanReq = new NextRequest('https://thebillionairebrother.com/', {
        headers: {
            'host': 'thebillionairebrother.com',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'x-vercel-ip-country': 'FR',
        },
    });
    // In Node test environment, temporarily mock NODE_ENV as production
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    try {
        const frRes = await proxy(frHumanReq);
        assert(frRes.status === 307, 'Out-of-region human is redirected with 307');
        assert(Boolean(frRes.headers.get('location')?.includes('/region-restricted')), 'Redirect location is /region-restricted');
        assert(Boolean(frRes.headers.get('location')?.includes('country=FR')), 'Redirect location preserves country param');
    } finally {
        (process.env as any).NODE_ENV = originalEnv;
    }

    // Test 4: Target country US allowed
    (process.env as any).NODE_ENV = 'production';
    try {
        const usHumanReq = new NextRequest('https://thebillionairebrother.com/', {
            headers: {
                'host': 'thebillionairebrother.com',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'x-vercel-ip-country': 'US',
            },
        });
        const usRes = await proxy(usHumanReq);
        assert(usRes.status === 200, 'US human passes through with 200');
        assert(usRes.headers.get('x-bb-country') === 'US', 'US country header passed downstream');
    } finally {
        (process.env as any).NODE_ENV = originalEnv;
    }

    // Test 5: Out-of-region user is blocked even with auth cookie UNLESS they have bypass key
    (process.env as any).NODE_ENV = 'production';
    try {
        // Without bypass key -> blocked
        const authReqNoKey = new NextRequest('https://thebillionairebrother.com/dashboard', {
            headers: {
                'host': 'thebillionairebrother.com',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'x-vercel-ip-country': 'SG', // Singapore
                'cookie': 'sb-test-auth-token=valid-session-jwt',
            },
        });
        const authResNoKey = await proxy(authReqNoKey);
        assert(authResNoKey.status === 307, 'Out-of-region auth user without key is redirected');
        assert(Boolean(authResNoKey.headers.get('location')?.includes('/region-restricted')), 'Auth user is redirected to /region-restricted');

        // With bypass key -> allowed
        const authReqWithKey = new NextRequest('https://thebillionairebrother.com/dashboard', {
            headers: {
                'host': 'thebillionairebrother.com',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'x-vercel-ip-country': 'SG',
                'cookie': 'sb-test-auth-token=valid-session-jwt; bb_geo_bypass=valid',
            },
        });
        const authResWithKey = await proxy(authReqWithKey);
        const locWithKey = authResWithKey.headers.get('location') || '';
        assert(!locWithKey.includes('/region-restricted'), 'Out-of-region auth user WITH bypass key is NOT blocked by geo-fence');
    } finally {
        (process.env as any).NODE_ENV = originalEnv;
    }

    // Test 6: Waitlist API validation
    console.log('\n--- Testing Waitlist API Route ---');
    const { POST: waitlistHandler } = await import('../src/app/api/leads/waitlist/route');
    
    // Invalid email test
    const invalidEmailReq = new Request('http://localhost:3000/api/leads/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', country: 'FR' }),
    });
    const invalidEmailRes = await waitlistHandler(invalidEmailReq);
    assert(invalidEmailRes.status === 400, 'Invalid email returns 400 Bad Request');

    // Valid email test
    const validEmailReq = new Request('http://localhost:3000/api/leads/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'founder@example.com', country: 'FR' }),
    });
    const validEmailRes = await waitlistHandler(validEmailReq);
    assert(validEmailRes.status === 200, 'Valid waitlist submission returns 200');
    const validJson = await validEmailRes.json();
    assert(validJson.success === true, 'Response body has success: true');

    // Test 7: Philippines Geofencing & Secret Key Bypass
    console.log('\n--- Testing Philippines & Secret Key Bypass ---');
    assert(isAllowedCountry('PH') === false, 'PH is rejected by default');

    // 7a. Philippines user without key -> REDIRECTED to /region-restricted
    const phReqNoKey = new NextRequest('https://thebillionairebrother.com/', {
        headers: {
            'host': 'thebillionairebrother.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
            'x-vercel-ip-country': 'PH',
        },
    });
    const phResNoKey = await proxy(phReqNoKey);
    assert(phResNoKey.status === 307, 'PH visitor without key is blocked (307 redirect)');
    assert(Boolean(phResNoKey.headers.get('location')?.includes('/region-restricted')), 'Redirected to /region-restricted');
    assert(Boolean(phResNoKey.headers.get('location')?.includes('country=PH')), 'Country param is PH');

    // 7b. Philippines user with Secret Key in URL (?key=bb_secret_team_2026) -> ALLOWED (200)
    const phReqWithKey = new NextRequest('https://thebillionairebrother.com/?key=bb_secret_team_2026', {
        headers: {
            'host': 'thebillionairebrother.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
            'x-vercel-ip-country': 'PH',
        },
    });
    const phResWithKey = await proxy(phReqWithKey);
    assert(phResWithKey.status === 200, 'PH visitor with Secret Key URL param is ALLOWED (200)');
    assert(Boolean(phResWithKey.cookies.get('bb_geo_bypass')?.value === 'valid'), 'Sets 30-day bypass cookie on response');

    // 7c. Philippines user with cookie bb_geo_bypass=valid -> ALLOWED (200)
    const phReqWithCookie = new NextRequest('https://thebillionairebrother.com/', {
        headers: {
            'host': 'thebillionairebrother.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
            'x-vercel-ip-country': 'PH',
            'cookie': 'bb_geo_bypass=valid',
        },
    });
    const phResWithCookie = await proxy(phReqWithCookie);
    assert(phResWithCookie.status === 200, 'PH visitor with bypass cookie is ALLOWED (200)');

    // 7d. Bypass API verification
    const { POST: bypassHandler } = await import('../src/app/api/geo/bypass/route');
    const wrongKeyReq = new Request('http://localhost:3000/api/geo/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'wrong_password' }),
    });
    const wrongKeyRes = await bypassHandler(wrongKeyReq);
    assert(wrongKeyRes.status === 401, 'Wrong bypass key returns 401 Unauthorized');

    const rightKeyReq = new Request('http://localhost:3000/api/geo/bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'bb_secret_team_2026' }),
    });
    const rightKeyRes = await bypassHandler(rightKeyReq);
    assert(rightKeyRes.status === 200, 'Correct bypass key returns 200 OK');

    console.log('\n🎉 ALL SECURITY, PHILIPPINES GEO-FENCING & SECRET BYPASS TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
    console.error('Test execution error:', err);
    process.exit(1);
});
