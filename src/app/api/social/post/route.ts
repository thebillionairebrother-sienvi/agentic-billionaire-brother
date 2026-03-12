import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Refresh Twitter access token using refresh_token + per-user credentials
 */
async function refreshTwitterToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    if (!res.ok) return null;
    return res.json();
}

/**
 * Post an approved tweet to Twitter
 */
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await request.json();
    if (!postId) {
        return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    // Get the post
    const { data: post } = await serviceClient
        .from('social_posts')
        .select('*, social_accounts(*)')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

    if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.status === 'posted') {
        return NextResponse.json({ error: 'Already posted' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const account = post.social_accounts as any;
    let accessToken = account.access_token;

    // Check if token is expired — refresh if needed
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
        if (!account.refresh_token) {
            return NextResponse.json({ error: 'Token expired. Please reconnect Twitter.' }, { status: 401 });
        }

        const newTokens = await refreshTwitterToken(account.refresh_token, account.client_id, account.client_secret);
        if (!newTokens) {
            return NextResponse.json({ error: 'Token refresh failed. Please reconnect Twitter.' }, { status: 401 });
        }

        // Update stored tokens
        await serviceClient
            .from('social_accounts')
            .update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            })
            .eq('id', account.id);

        accessToken = newTokens.access_token;
    }

    // Post to Twitter
    try {
        const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ text: post.content }),
        });

        if (!tweetRes.ok) {
            const err = await tweetRes.text();
            console.error('[social/post] Twitter API error:', err);
            await serviceClient.from('social_posts').update({ status: 'failed' }).eq('id', postId);
            return NextResponse.json({ error: 'Failed to post tweet' }, { status: 500 });
        }

        const tweetData = await tweetRes.json();

        // Update post status
        await serviceClient
            .from('social_posts')
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                platform_post_id: tweetData.data?.id || null,
            })
            .eq('id', postId);

        console.log(`[social/post] ✅ Posted tweet ${tweetData.data?.id} for user ${user.id}`);
        return NextResponse.json({ success: true, tweetId: tweetData.data?.id });

    } catch (err) {
        console.error('[social/post] Error:', err);
        await serviceClient.from('social_posts').update({ status: 'failed' }).eq('id', postId);
        return NextResponse.json({ error: 'Failed to post' }, { status: 500 });
    }
}
