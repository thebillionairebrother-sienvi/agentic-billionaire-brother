import { NextResponse } from 'next/server';
import { isBetaProgramOver } from '@/lib/billing/config';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const authBetaUrl = new URL(isBetaProgramOver() ? '/auth' : '/auth/beta', url.origin);
    
    // Forward any existing query params (like redirect, error, etc.)
    url.searchParams.forEach((val, key) => {
        authBetaUrl.searchParams.set(key, val);
    });

    return NextResponse.redirect(authBetaUrl.toString());
}
