import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import { syncSubscriptionToDb, cancelSubscriptionInDb } from '@/lib/stripe-sync';
import { createServiceClient } from '@/lib/supabase/server';

// Don't cache this endpoint
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    if (STRIPE_TEST_MODE) {
        console.warn('[webhook] Stripe is in test mode — webhook received but skipped.');
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
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error('[webhook] Signature verification failed:', err);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`[webhook] Received event: ${event.type}`);

    try {
        switch (event.type) {

            /**
             * A checkout session completed — first payment.
             * Link the Stripe customer to the user via metadata.userId.
             */
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const customerId = session.customer as string;

                if (!userId || !customerId) {
                    console.error('[webhook] checkout.session.completed missing userId or customerId');
                    break;
                }

                // Store stripe_customer_id on the user immediately
                const admin = await createServiceClient();
                await admin.from('users').update({
                    stripe_customer_id: customerId,
                }).eq('id', userId);

                // If there's an associated subscription, sync it now
                if (session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(
                        session.subscription as string,
                        { expand: ['items.data.price'] }
                    );
                    await syncSubscriptionToDb(subscription, customerId, userId);
                }
                break;
            }

            /**
             * Subscription created — new signup via API (non-checkout path).
             */
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                await syncSubscriptionToDb(subscription, customerId);
                break;
            }

            /**
             * Subscription deleted / cancelled.
             */
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                await cancelSubscriptionInDb(subscription, customerId);
                break;
            }

            /**
             * Invoice paid — confirm active status (catches renewals).
             */
            case 'invoice.paid': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = (invoice as any).subscription as string;
                const customerId = invoice.customer as string;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(
                        subscriptionId,
                        { expand: ['items.data.price'] }
                    );
                    await syncSubscriptionToDb(subscription, customerId);
                }
                break;
            }

            /**
             * Invoice payment failed — mark as past_due.
             */
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                const admin = await createServiceClient();
                
                const { data: user } = await admin
                    .from('users')
                    .select('id')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (user) {
                    await admin.from('users').update({
                        subscription_status: 'past_due',
                        updated_at: new Date().toISOString(),
                    }).eq('id', user.id);

                    await admin.from('subscriptions').update({
                        status: 'past_due',
                        updated_at: new Date().toISOString(),
                    }).eq('user_id', user.id);
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
