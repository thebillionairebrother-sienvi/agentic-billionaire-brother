import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

    const { clientId, clientSecret } = await request.json();
    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Client ID and Secret are required' }, { status: 400 });
    }

    const serviceClient = await createServiceClient();

    // Upsert credentials (creates or updates the record)
    const { error } = await serviceClient
        .from('social_accounts')
        .upsert({
            user_id: user.id,
            platform: 'twitter',
            client_id: clientId,
            client_secret: clientSecret,
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
