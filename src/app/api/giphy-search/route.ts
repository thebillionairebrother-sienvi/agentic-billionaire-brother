import { NextResponse } from 'next/server';
import { createMobileAwareClient } from '@/lib/supabase/server';

/** Max characters accepted for a Giphy search query */
const QUERY_MAX_LENGTH = 100;

export async function POST(request: Request) {
    try {
        // Security: Only authenticated users may use this backend proxy
        const { user } = await createMobileAwareClient(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized', gifUrl: null }, { status: 401 });
        }

        const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
        if (!GIPHY_API_KEY) {
            console.error('[giphy-search] GIPHY_API_KEY not configured');
            return NextResponse.json({ error: 'Service unavailable', gifUrl: null }, { status: 503 });
        }

        const body = await request.json();
        const query = typeof body?.query === 'string' ? body.query.trim() : '';
        if (!query) {
            return NextResponse.json({ error: 'query is required', gifUrl: null }, { status: 400 });
        }
        if (query.length > QUERY_MAX_LENGTH) {
            return NextResponse.json({ error: 'query too long', gifUrl: null }, { status: 400 });
        }

        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=1&rating=pg-13`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[giphy-search] Giphy API error: ${response.status}`);
            return NextResponse.json({ error: 'GIF service error', gifUrl: null }, { status: 502 });
        }

        const data = await response.json();
        const gifUrl = data.data?.[0]?.images?.fixed_height?.url || null;

        return NextResponse.json({ gifUrl });
    } catch (error) {
        console.error('[giphy-search] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error', gifUrl: null },
            { status: 500 }
        );
    }
}

