import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';

/**
 * Twitter OAuth 2.0 PKCE — Step 1: Redirect user to Twitter authorize page
 * Uses per-user credentials stored in social_accounts
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's stored credentials
    const serviceClient = await createServiceClient();
    const { data: account } = await serviceClient
        .from('social_accounts')
        .select('client_id, client_secret')
        .eq('user_id', user.id)
        .eq('platform', 'twitter')
        .single();

    if (!account?.client_id || !account?.client_secret) {
        return NextResponse.redirect(new URL('/social?error=no_credentials', process.env.NEXT_PUBLIC_APP_URL || 'https://www.billionairebrother.com'));
    }

    const clientId = account.client_id;
    const redirectUri = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI
        || `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.billionairebrother.com'}/api/social/twitter/callback`;

    // Generate PKCE code_verifier and code_challenge
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');

    // Store in cookies (httpOnly, short-lived)
    const cookieStore = await cookies();
    cookieStore.set('twitter_code_verifier', codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
        sameSite: 'lax',
    });
    cookieStore.set('twitter_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 600,
        path: '/',
        sameSite: 'lax',
    });

    const scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(authUrl.toString());
}
