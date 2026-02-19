import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';

export async function POST() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ── Test mode: redirect back to settings with a toast message ──
        if (STRIPE_TEST_MODE) {
            return NextResponse.json({
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?billing=test`,
                test_mode: true,
            });
        }

        // ── Production: real Stripe billing portal ──
        const { data: profile } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        if (!profile?.stripe_customer_id) {
            return NextResponse.json({ error: 'No billing account' }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Billing portal error:', error);
        return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }
}
