import { NextResponse } from 'next/server';
import { createMobileAwareClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/admin';
import { isBetaProgramOver } from '@/lib/billing/config';

/**
 * POST /api/auth/set-tier
 * Called after signup/login to apply a beta access code.
 *
 * Rules:
 *  - Admins always get full access and are never changed here.
 *  - Users with a Stripe subscription (active/trialing/past_due) are never
 *    changed here — only the Stripe webhook manages their tier.
 *  - Beta codes stop working when the beta program ends (BETA_PROGRAM_ENDS_AT).
 */

const PROMO_CODES: Record<string, 'brother' | 'team'> = {
    'BILLIONAIREBROTHER2026': 'brother',
    'BILLIONAIRETEAM2026': 'team',
};

const STRIPE_MANAGED = ['active', 'trialing', 'past_due'];

export async function POST(request: Request) {
    try {
        const { user } = await createMobileAwareClient(request);

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const { promoCode, tier: requestedTier } = body;

        const admin = await createServiceClient();
        const [{ data: current }, { data: profile }] = await Promise.all([
            admin.from('users').select('tier, subscription_status').eq('id', user.id).maybeSingle(),
            admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        ]);

        if (isAdminUser(user.email, profile?.role)) {
            if (current?.tier !== 'team') {
                await admin.from('users').update({ tier: 'team' }).eq('id', user.id);
            }
            return NextResponse.json({ success: true, tier: 'team', admin: true });
        }

        if (current && STRIPE_MANAGED.includes(current.subscription_status)) {
            return NextResponse.json({ success: true, tier: current.tier, managedBy: 'stripe' });
        }

        // (Scott is now an admin via ADMIN_EMAILS, handled above.)
        let tier: 'free' | 'brother' | 'team' = 'free';
        const betaOver = isBetaProgramOver();

        if (promoCode && typeof promoCode === 'string') {
            if (betaOver) {
                return NextResponse.json(
                    { error: 'The beta program has ended. Beta codes are no longer valid.' },
                    { status: 400 },
                );
            }
            const matched = PROMO_CODES[promoCode.toUpperCase().trim()];
            if (!matched) {
                return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
            }
            tier = matched;
        } else if (requestedTier !== 'free') {
            // No code and no explicit free request: leave the tier unchanged.
            return NextResponse.json({ success: true, tier: current?.tier ?? 'free' });
        }

        const { error: updateError } = await admin
            .from('users')
            .update({ tier, subscription_plan: tier })
            .eq('id', user.id);

        if (updateError) {
            console.error('Failed to set user tier:', updateError);
            return NextResponse.json({ error: 'Failed to set tier' }, { status: 500 });
        }

        return NextResponse.json({ success: true, tier });
    } catch (err) {
        console.error('Set tier error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
