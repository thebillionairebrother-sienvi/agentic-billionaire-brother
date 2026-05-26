import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const authBetaUrl = new URL('/auth/beta', url.origin);
    
    // Forward any existing query params (like redirect, error, etc.)
    url.searchParams.forEach((val, key) => {
        authBetaUrl.searchParams.set(key, val);
    });

    return NextResponse.redirect(authBetaUrl.toString());
}
