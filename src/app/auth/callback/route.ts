import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const next = searchParams.get('next') ?? '/dashboard';
    const authFallbackPath = next.startsWith('/auth/beta') ? '/auth/beta' : '/auth';

    if (code || (tokenHash && type)) {
        const supabase = await createClient();
        const { error } = code
            ? await supabase.auth.exchangeCodeForSession(code)
            : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

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

                    const isScott = user.email?.toLowerCase() === 'scott@siemvi.com';

                    if (!existingSub) {
                        // Determine tier from signup metadata, but override for Scott
                        const tier = isScott ? 'team' : (user.user_metadata?.tier || 'free');
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
                    } else if (isScott) {
                        // Scott already has a subscription, make sure it is updated to team
                        await admin.from('subscriptions')
                            .update({ tier: 'team', status: 'active' })
                            .eq('user_id', user.id);
                        await admin.from('users').update({ tier: 'team' }).eq('id', user.id);
                    }
                }
            } catch (e) {
                console.error('[auth/callback] Failed to init subscription:', e);
                // Non-blocking — user can still proceed
            }

            return NextResponse.redirect(`${origin}${next}`);
        }

        // If `code` was provided, Supabase /auth/v1/verify already confirmed the email
        // before redirecting here, even if PKCE session exchange failed (e.g., opened on phone vs desktop).
        if (code) {
            console.warn('[auth/callback] Code exchange failed (likely cross-device confirmation):', error.message);
            return NextResponse.redirect(`${origin}${authFallbackPath}?confirmed=1`);
        }
    }

    return NextResponse.redirect(`${origin}${authFallbackPath}?error=callback_failed`);
}
