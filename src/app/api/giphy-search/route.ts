import { NextResponse } from 'next/server';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function OPTIONS() {
    return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
    try {
        const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
        if (!GIPHY_API_KEY) {
            throw new Error('GIPHY_API_KEY not configured');
        }

        const { query } = await request.json();
        if (!query) {
            throw new Error('query is required');
        }

        const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=1&rating=pg-13`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Giphy API error: ${response.status}`);
        }

        const data = await response.json();
        const gifUrl = data.data?.[0]?.images?.fixed_height?.url || null;

        return NextResponse.json(
            { gifUrl },
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error('Giphy search error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error', gifUrl: null },
            { status: 500, headers: corsHeaders }
        );
    }
}
