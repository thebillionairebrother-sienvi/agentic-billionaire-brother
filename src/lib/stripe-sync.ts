/**
 * Stripe Sync Helper — Server-only
 *
 * Every webhook event is treated as a notification: we re-retrieve the
 * subscription from Stripe (pinned SDK API version) and derive DB state from
 * that, so the webhook endpoint's payload API version doesn't matter and
 * out-of-order / duplicate events are harmless (idempotent).
 *
 * The Stripe account is shared with other Sienvi products, so subscriptions
 * whose price is not a Billionaire Brother price are ignored.
 */

import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/admin';
import type { Tier } from '@/lib/ai-config';

type InternalStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'none';

const LIVE_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set(['active', 'trialing', 'past_due']);

/** Maps a Stripe Price to our tier, or null if it isn't a BB price. */
export function priceToTier(price: Stripe.Price | undefined | null): Exclude<Tier, 'free'> | null {
    if (!price) return null;
    if (price.id === process.env.STRIPE_PRICE_ID_TEAM || price.lookup_key?.startsWith('bb_team')) return 'team';
    if (price.id === process.env.STRIPE_PRICE_ID_BROTHER || price.lookup_key?.startsWith('bb_brother')) return 'brother';
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;
    const meta = typeof price.product === 'object' && price.product && 'metadata' in price.product ? price.product.metadata : undefined;
    if (meta?.bb_tier === 'brother' || meta?.bb_tier === 'team') return meta.bb_tier;
    if (productId && productId === process.env.STRIPE_PRODUCT_ID_BROTHER) return 'brother';
    return null;
}

function toInternalStatus(status: Stripe.Subscription.Status): InternalStatus {
    switch (status) {
        case 'active': return 'active';
        case 'trialing': return 'trialing';
        case 'past_due': return 'past_due';
        case 'canceled':
        case 'unpaid':
        case 'paused':
        case 'incomplete_expired':
            return 'cancelled';
        default:
            return 'none'; // incomplete
    }
}

function enrollmentStatus(sub: Stripe.Subscription): string {
    switch (sub.status) {
        case 'trialing': return sub.cancel_at_period_end || sub.cancel_at ? 'cancelled' : 'active';
        case 'active': return 'converted';
        case 'past_due':
        case 'unpaid': return 'payment_failed';
        case 'canceled':
            return sub.cancellation_details?.reason === 'cancellation_requested' ? 'cancelled' : 'ended';
        default: return 'active';
    }
}

const ts = (secs: number | null | undefined) => (secs ? new Date(secs * 1000).toISOString() : null);

/** Retrieve a subscription fresh from Stripe and sync it. */
export async function syncSubscriptionById(subscriptionId: string, hintUserId?: string) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price.product'],
    });
    return syncSubscription(subscription, hintUserId);
}

export async function syncSubscription(subscription: Stripe.Subscription, hintUserId?: string) {
    const item = subscription.items.data[0];
    const tier = priceToTier(item?.price);
    if (!tier) {
        console.log(`[stripe-sync] Ignoring non-BB subscription ${subscription.id}`);
        return;
    }

    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const admin = await createServiceClient();

    // Resolve the user: metadata first (subscription.created can arrive before
    // checkout.session.completed), then the caller's hint, then the customer id.
    let userId = subscription.metadata?.userId || hintUserId;
    if (!userId) {
        const { data } = await admin.from('users').select('id').eq('stripe_customer_id', customerId).maybeSingle();
        userId = data?.id;
    }
    if (!userId) {
        console.error(`[stripe-sync] Could not resolve user for BB subscription ${subscription.id} / ${customerId}`);
        return;
    }

    const [{ data: user }, { data: profile }, { data: existingRows }] = await Promise.all([
        admin.from('users').select('id, email').eq('id', userId).maybeSingle(),
        admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
        admin.from('subscriptions').select('id, stripe_subscription_id, status, past_due_since').eq('user_id', userId),
    ]);
    if (!user) {
        console.error(`[stripe-sync] User ${userId} not found for subscription ${subscription.id}`);
        return;
    }

    const status = toInternalStatus(subscription.status);
    const hasAccess = LIVE_STATUSES.has(subscription.status);
    const thisRow = existingRows?.find((r) => r.stripe_subscription_id === subscription.id);
    const otherLive = existingRows?.some(
        (r) => r.stripe_subscription_id && r.stripe_subscription_id !== subscription.id &&
            ['active', 'trialing', 'past_due'].includes(r.status),
    );

    const pastDueSince = subscription.status === 'past_due'
        ? (thisRow?.past_due_since ?? new Date().toISOString())
        : null;

    const row = {
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        tier,
        status: status === 'none' ? 'cancelled' : status,
        current_period_start: ts(item?.current_period_start),
        current_period_end: ts(item?.current_period_end),
        trial_end: ts(subscription.trial_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
        past_due_since: pastDueSince,
        charter_pricing: false,
        promo_code: null,
        updated_at: new Date().toISOString(),
    };
    // Row selection, safe whether or not prod has a UNIQUE(user_id):
    //  1. this subscription's own row → update it
    //  2. else a legacy beta/comp row with no Stripe id → take it over
    //  3. else insert; on a unique-key conflict, update the user's row
    const reusable = thisRow ?? existingRows?.find((r) => !r.stripe_subscription_id);
    let subError;
    if (reusable) {
        ({ error: subError } = await admin.from('subscriptions').update(row).eq('id', reusable.id));
    } else {
        ({ error: subError } = await admin.from('subscriptions').insert(row));
        if (subError?.code === '23505') {
            ({ error: subError } = await admin.from('subscriptions').update(row).eq('user_id', userId));
        }
    }
    if (subError) console.error('[stripe-sync] subscriptions write error:', subError);

    // A stale event for an old subscription must not downgrade a user who has
    // another live subscription.
    if (!hasAccess && otherLive) {
        console.log(`[stripe-sync] ${subscription.id} ended but user ${userId} has another live subscription; tier unchanged`);
    } else {
        const isAdmin = isAdminUser(user.email, profile?.role);
        const userUpdate: Record<string, unknown> = {
            stripe_customer_id: customerId,
            subscription_status: status,
            updated_at: new Date().toISOString(),
        };
        if (!isAdmin) {
            userUpdate.tier = hasAccess ? tier : 'free';
            userUpdate.subscription_plan = hasAccess ? tier : 'free';
        }
        const { error: userError } = await admin.from('users').update(userUpdate).eq('id', userId);
        if (userError) console.error('[stripe-sync] users update error:', userError);
    }

    const offerId = subscription.metadata?.offer;
    if (offerId) {
        const { error: enrollError } = await admin.from('trial_enrollments').update({
            stripe_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            status: enrollmentStatus(subscription),
            updated_at: new Date().toISOString(),
        }).eq('user_id', userId).eq('offer_id', offerId);
        if (enrollError) console.error('[stripe-sync] trial_enrollments update error:', enrollError);
    }

    console.log(`[stripe-sync] ${subscription.id} → user ${userId} tier=${tier} status=${subscription.status}`);
}

/** Subscription id from an invoice, across API versions. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const fromParent = invoice.parent?.subscription_details?.subscription;
    if (fromParent) return typeof fromParent === 'string' ? fromParent : fromParent.id;
    const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
    if (!legacy) return null;
    return typeof legacy === 'string' ? legacy : legacy.id;
}
