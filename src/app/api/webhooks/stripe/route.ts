import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import { syncSubscriptionById, invoiceSubscriptionId } from '@/lib/stripe-sync';
import { createServiceClient } from '@/lib/supabase/server';

// Don't cache this endpoint
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook. Events are notifications only: we always re-read the
 * subscription from Stripe and sync from that (see stripe-sync.ts), so the
 * handler is idempotent and independent of the endpoint's API version.
 */
export async function POST(request: Request) {
    if (STRIPE_TEST_MODE) {
        console.warn('[webhook] Stripe is not configured (no STRIPE_SECRET_KEY) — webhook skipped.');
        return NextResponse.json({ received: true, mode: 'test' });
    }

    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
        console.error('[webhook] Signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`[webhook] Received event: ${event.type} (${event.id})`);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
                // Shared Sienvi account: only handle BB sessions (they carry metadata.app = 'bb').
                if (!userId || session.metadata?.app !== 'bb') {
                    console.log('[webhook] checkout.session.completed is not a BB session; ignored');
                    break;
                }

                const admin = await createServiceClient();
                if (customerId) {
                    await admin.from('users').update({ stripe_customer_id: customerId }).eq('id', userId);
                }

                const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
                if (subscriptionId) {
                    await syncSubscriptionById(subscriptionId, userId);
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
            case 'customer.subscription.trial_will_end': {
                const subscription = event.data.object as Stripe.Subscription;
                await syncSubscriptionById(subscription.id);
                break;
            }

            case 'invoice.paid':
            case 'invoice.payment_succeeded':
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = invoiceSubscriptionId(invoice);
                if (subscriptionId) {
                    await syncSubscriptionById(subscriptionId);
                }
                break;
            }

            default:
                console.log(`[webhook] Unhandled event type: ${event.type}`);
        }
    } catch (err) {
        console.error(`[webhook] Handler error for ${event.type}:`, err);
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
