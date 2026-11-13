import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import { STRIPE_PRICE_IDS } from '@/lib/plan-gating';
import { isAdminUser } from '@/lib/admin';
import { isTeamCheckoutEnabled } from '@/lib/billing/config';
import { getBrotherPrice } from '@/lib/billing/stripe-prices';
import { ensureStripeCustomer, getSubscriptionHistory, checkoutIdempotencyKey } from '@/lib/billing/customer';
import type { Tier } from '@/lib/ai-config';

/**
 * Regular (non-trial) checkout.
 * Brother: $39 first month for first-time subscribers, then $49/month.
 * Team: disabled until the re-costed Team plan is approved.
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const tier = body.tier as Tier;

        if (tier !== 'brother' && tier !== 'team') {
            return NextResponse.json({ error: 'Invalid tier. Must be "brother" or "team".' }, { status: 400 });
        }
        if (tier === 'team' && !isTeamCheckoutEnabled()) {
            return NextResponse.json({ error: 'The Team plan is not available for purchase yet.' }, { status: 409 });
        }

        // ── Stripe not configured: return a dummy URL ──
        if (STRIPE_TEST_MODE) {
            return NextResponse.json({
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?billing=test`,
                test_mode: true,
            });
        }

        const [{ data: profile }, { data: roleRow }] = await Promise.all([
            supabase.from('users').select('stripe_customer_id, email, display_name').eq('id', user.id).single(),
            supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        ]);

        if (isAdminUser(user.email, roleRow?.role)) {
            return NextResponse.json({ error: 'Admin accounts already have full access.' }, { status: 409 });
        }

        const customerId = await ensureStripeCustomer({
            id: user.id,
            email: profile?.email || user.email!,
            displayName: profile?.display_name,
            stripeCustomerId: profile?.stripe_customer_id,
        });

        // ── Never create a second subscription ──
        const history = await getSubscriptionHistory(customerId);
        if (history.live) {
            return NextResponse.json(
                { error: 'You already have an active subscription. Manage it from Settings.', manage: true },
                { status: 409 },
            );
        }

        let priceId: string;
        let discounts: { coupon: string }[] | undefined;
        if (tier === 'brother') {
            const price = await getBrotherPrice();
            priceId = price.priceId!;
            // $39 first month only for people who have never subscribed before.
            if (price.introCouponId && !history.any) discounts = [{ coupon: price.introCouponId }];
        } else {
            priceId = STRIPE_PRICE_IDS.team || '';
            if (!priceId) {
                return NextResponse.json({ error: 'Stripe Price ID for tier "team" is not configured.' }, { status: 500 });
            }
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            ...(discounts ? { discounts } : { allow_promotion_codes: false }),
            metadata: { userId: user.id, tier, app: 'bb' },
            subscription_data: {
                metadata: { userId: user.id, tier, app: 'bb' },
            },
            success_url: `${appUrl}/settings?checkout=success&tier=${tier}`,
            cancel_url: `${appUrl}/upgrade?canceled=true`,
        }, { idempotencyKey: checkoutIdempotencyKey(user.id, tier) });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Checkout session error:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
