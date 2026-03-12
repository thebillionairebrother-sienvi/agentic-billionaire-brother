import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Disconnect Twitter account — revoke token and remove from DB
 */
export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    // Get the account
    const { data: account } = await serviceClient
        .from('social_accounts')
        .select('id, access_token, client_id, client_secret')
        .eq('user_id', user.id)
        .eq('platform', 'twitter')
        .single();

    if (!account) {
        return NextResponse.json({ error: 'No Twitter account connected' }, { status: 404 });
    }

    // Try to revoke token using user's credentials
    if (account.access_token && account.client_id && account.client_secret) {
        try {
            await fetch('https://api.twitter.com/2/oauth2/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${Buffer.from(`${account.client_id}:${account.client_secret}`).toString('base64')}`,
                },
                body: new URLSearchParams({
                    token: account.access_token,
                    token_type_hint: 'access_token',
                }),
            });
        } catch (e) {
            console.warn('[twitter/disconnect] Token revocation failed:', e);
        }
    }

    // Delete associated posts first, then account
    await serviceClient.from('social_posts').delete().eq('social_account_id', account.id);
    await serviceClient.from('social_accounts').delete().eq('id', account.id);

    console.log(`[twitter/disconnect] ✅ Disconnected Twitter for user ${user.id}`);
    return NextResponse.json({ success: true });
}
