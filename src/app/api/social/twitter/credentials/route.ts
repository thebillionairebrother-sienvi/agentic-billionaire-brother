import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/** Reasonable bounds for Twitter OAuth 2.0 app credentials */
const CLIENT_ID_MAX_LENGTH = 64;
const CLIENT_SECRET_MAX_LENGTH = 128;

/**
 * Save Twitter API credentials for the current user.
 * Called before initiating OAuth flow.
 */
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { clientId, clientSecret } = body as Record<string, unknown>;

    // Validate presence
    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Client ID and Secret are required' }, { status: 400 });
    }

    // Validate types and lengths
    if (typeof clientId !== 'string' || typeof clientSecret !== 'string') {
        return NextResponse.json({ error: 'Invalid credential format' }, { status: 400 });
    }
    if (clientId.trim().length === 0 || clientSecret.trim().length === 0) {
        return NextResponse.json({ error: 'Client ID and Secret cannot be empty' }, { status: 400 });
    }
    if (clientId.length > CLIENT_ID_MAX_LENGTH) {
        return NextResponse.json({ error: `Client ID must be under ${CLIENT_ID_MAX_LENGTH} characters` }, { status: 400 });
    }
    if (clientSecret.length > CLIENT_SECRET_MAX_LENGTH) {
        return NextResponse.json({ error: `Client Secret must be under ${CLIENT_SECRET_MAX_LENGTH} characters` }, { status: 400 });
    }
    // Only allow printable ASCII (no control chars, no unicode trickery)
    if (!/^[\x21-\x7E]+$/.test(clientId) || !/^[\x21-\x7E]+$/.test(clientSecret)) {
        return NextResponse.json({ error: 'Invalid characters in credentials' }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    // Upsert credentials (creates or updates the record)
    const { error } = await serviceClient
        .from('social_accounts')
        .upsert({
            user_id: user.id,
            platform: 'twitter',
            client_id: clientId.trim(),
            client_secret: clientSecret.trim(),
            platform_user_id: '',
        }, {
            onConflict: 'user_id,platform',
        });

    if (error) {
        console.error('[social/credentials] DB error:', error);
        return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
