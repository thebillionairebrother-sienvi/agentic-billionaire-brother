import { NextResponse } from 'next/server';
import { isValidBypassKey } from '@/lib/security/geo-bot';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key } = body;

        if (!isValidBypassKey(key)) {
            return NextResponse.json(
                { error: 'Invalid bypass key. Please check your credentials.' },
                { status: 401 }
            );
        }

        const response = NextResponse.json({
            success: true,
            message: 'Bypass authorization verified. Access granted for 30 days.',
        });

        // Set persistent 30-day bypass cookie
        response.cookies.set('bb_geo_bypass', 'valid', {
            path: '/',
            maxAge: 30 * 24 * 60 * 60, // 30 days
            sameSite: 'lax',
            httpOnly: false,
        });

        return response;
    } catch (err: any) {
        return NextResponse.json(
            { error: 'Invalid request payload.' },
            { status: 400 }
        );
    }
}
