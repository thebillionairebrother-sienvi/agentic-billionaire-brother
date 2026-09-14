import { NextResponse } from 'next/server';
import { getGifFromPool } from '@/lib/gif-pool';

/** Max characters accepted for a Giphy search query */
const QUERY_MAX_LENGTH = 100;

/**
 * Shared helper — fetch a GIF URL from GIF pools or Giphy for a given query.
 * Checks local curated pools first (e.g. Adam Scott Bababooey for good news/wins),
 * then falls back to Giphy search API.
 * Returns null if anything goes wrong (no throw).
 */
export async function fetchGifUrl(query: string): Promise<string | null> {
    if (!query) return null;

    // 1. Check curated GIF pools first (zero network latency, guaranteed match)
    const poolGif = getGifFromPool(query);
    if (poolGif) {
        return poolGif;
    }

    // 2. Fall back to Giphy API search
    const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
    if (!GIPHY_API_KEY) return null;

    try {
        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=1&rating=pg-13`;
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return null;

        const data = await response.json();
        return data.data?.[0]?.images?.fixed_height?.url || null;
    } catch {
        return null;
    }
}

/**
 * POST /api/giphy-search
 * Public endpoint — no auth required (guest chatbot needs GIFs too).
 * Checks GIF pools first, then queries Giphy API.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const query = typeof body?.query === 'string' ? body.query.trim() : '';
        if (!query) {
            return NextResponse.json({ error: 'query is required', gifUrl: null }, { status: 400 });
        }
        if (query.length > QUERY_MAX_LENGTH) {
            return NextResponse.json({ error: 'query too long', gifUrl: null }, { status: 400 });
        }

        // 1. Check curated GIF pools first (even without Giphy API key)
        const poolGif = getGifFromPool(query);
        if (poolGif) {
            return NextResponse.json({ gifUrl: poolGif });
        }

        // 2. Fall back to Giphy API
        const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
        if (!GIPHY_API_KEY) {
            console.error('[giphy-search] GIPHY_API_KEY not configured');
            return NextResponse.json({ error: 'Service unavailable', gifUrl: null }, { status: 503 });
        }

        const gifUrl = await fetchGifUrl(query);
        return NextResponse.json({ gifUrl });
    } catch (error) {
        console.error('[giphy-search] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error', gifUrl: null },
            { status: 500 }
        );
    }
}
