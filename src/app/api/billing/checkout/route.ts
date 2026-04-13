import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import { STRIPE_PRICE_IDS } from '@/lib/plan-gating';
import type { Tier } from '@/lib/ai-config';

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

        // ── Test mode: return a dummy URL ──
        if (STRIPE_TEST_MODE) {
            return NextResponse.json({
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?billing=test`,
                test_mode: true,
            });
        }

        const priceId = STRIPE_PRICE_IDS[tier];
        if (!priceId) {
            return NextResponse.json(
                { error: `Stripe Price ID for tier "${tier}" is not configured.` },
                { status: 500 }
            );
        }

        // Look up or create Stripe customer
        const { data: profile } = await supabase
            .from('users')
            .select('stripe_customer_id, email, display_name')
            .eq('id', user.id)
            .single();

        let customerId = profile?.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: profile?.email || user.email,
                name: profile?.display_name || undefined,
                metadata: { userId: user.id },
            });
            customerId = customer.id;
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            metadata: {
                userId: user.id,
                tier,
            },
            subscription_data: {
                metadata: { userId: user.id, tier },
            },
            success_url: `${appUrl}/settings?checkout=success&tier=${tier}`,
            cancel_url: `${appUrl}/upgrade?canceled=true`,
            allow_promotion_codes: true,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Checkout session error:', error);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
