/**
 * Server-only Stripe customer helpers that prevent duplicate customers and
 * duplicate subscriptions.
 */
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';

export interface BillingUser {
    id: string;
    email: string;
    displayName?: string | null;
    stripeCustomerId?: string | null;
}

/**
 * Returns the user's Stripe customer id, creating it once if needed.
 * The id is saved immediately (not left to the webhook), and creation uses an
 * idempotency key so concurrent clicks resolve to the same customer.
 */
export async function ensureStripeCustomer(user: BillingUser): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create(
        {
            email: user.email,
            name: user.displayName || undefined,
            metadata: { userId: user.id, app: 'bb' },
        },
        { idempotencyKey: `bb-customer-${user.id}` },
    );

    const admin = await createServiceClient();
    const { error } = await admin.from('users').update({ stripe_customer_id: customer.id }).eq('id', user.id);
    if (error) console.error('[billing] failed to persist stripe_customer_id:', error);
    return customer.id;
}

export interface SubscriptionHistory {
    /** active, trialing or past_due subscription exists */
    live: Stripe.Subscription | null;
    /** any subscription ever existed (any status) */
    any: boolean;
}

export async function getSubscriptionHistory(customerId: string): Promise<SubscriptionHistory> {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    const live = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status)) ?? null;
    const any = subs.data.some((s) => s.status !== 'incomplete_expired');
    return { live, any };
}

/** Idempotency key that collapses repeated clicks within the same minute. */
export function checkoutIdempotencyKey(userId: string, kind: string): string {
    return `bb-checkout-${kind}-${userId}-${Math.floor(Date.now() / 60_000)}`;
}
