import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

/**
 * Twitter OAuth 2.0 PKCE — Step 2: Handle callback, exchange code for tokens
 * Uses per-user credentials from social_accounts
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        console.error('[twitter/callback] User denied access:', error);
        return NextResponse.redirect(new URL('/social?error=denied', request.url));
    }

    if (!code || !state) {
        return NextResponse.redirect(new URL('/social?error=missing_params', request.url));
    }

    // Verify state
    const cookieStore = await cookies();
    const savedState = cookieStore.get('twitter_state')?.value;
    const codeVerifier = cookieStore.get('twitter_code_verifier')?.value;

    if (!savedState || savedState !== state) {
        return NextResponse.redirect(new URL('/social?error=invalid_state', request.url));
    }
    if (!codeVerifier) {
        return NextResponse.redirect(new URL('/social?error=missing_verifier', request.url));
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.redirect(new URL('/auth', request.url));
    }

    // Get user's stored credentials
    const serviceClient = await createServiceClient();
    const { data: account } = await serviceClient
        .from('social_accounts')
        .select('id, client_id, client_secret')
        .eq('user_id', user.id)
        .eq('platform', 'twitter')
        .single();

    if (!account?.client_id || !account?.client_secret) {
        return NextResponse.redirect(new URL('/social?error=no_credentials', request.url));
    }

    const redirectUri = process.env.NEXT_PUBLIC_TWITTER_REDIRECT_URI
        || `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.billionairebrother.com'}/api/social/twitter/callback`;

    try {
        // Exchange code for tokens using user's own credentials
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${account.client_id}:${account.client_secret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.error('[twitter/callback] Token exchange failed:', err);
            return NextResponse.redirect(new URL('/social?error=token_failed', request.url));
        }

        const tokens = await tokenRes.json();

        // Get user info from Twitter
        const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const meData = await meRes.json();
        const twitterUser = meData.data;

        // Update the existing record with tokens + profile
        await serviceClient
            .from('social_accounts')
            .update({
                platform_user_id: twitterUser.id,
                platform_username: twitterUser.username,
                platform_display_name: twitterUser.name,
                platform_avatar_url: twitterUser.profile_image_url,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token || null,
                token_expires_at: tokens.expires_in
                    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                    : null,
                connected_at: new Date().toISOString(),
            })
            .eq('id', account.id);

        // Clean up cookies
        cookieStore.delete('twitter_code_verifier');
        cookieStore.delete('twitter_state');

        console.log(`[twitter/callback] ✅ Connected @${twitterUser.username} for user ${user.id}`);
        return NextResponse.redirect(new URL('/social?connected=true', request.url));

    } catch (err) {
        console.error('[twitter/callback] Error:', err);
        return NextResponse.redirect(new URL('/social?error=unknown', request.url));
    }
}
