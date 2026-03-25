import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Ensure user has a subscription record (defaults to free tier)
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const admin = await createServiceClient();
                    const { data: existingSub } = await admin
                        .from('subscriptions')
                        .select('id')
                        .eq('user_id', user.id)
                        .limit(1)
                        .single();

                    if (!existingSub) {
                        // Determine tier from signup metadata
                        const tier = user.user_metadata?.tier || 'free';
                        await admin.from('subscriptions').insert({
                            user_id: user.id,
                            tier,
                            status: 'active',
                            charter_pricing: tier !== 'free',
                            promo_code: user.user_metadata?.promo_code || null,
                            started_at: new Date().toISOString(),
                        });

                        // Also set tier on users table
                        await admin.from('users').update({ tier }).eq('id', user.id);
                    }
                }
            } catch (e) {
                console.error('[auth/callback] Failed to init subscription:', e);
                // Non-blocking — user can still proceed
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/auth?error=callback_failed`);
}

