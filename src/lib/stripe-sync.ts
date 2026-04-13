/**
 * Stripe Sync Helper — Server-only
 *
 * Takes a Stripe Subscription object and upserts the correct rows in Supabase.
 * Called by the webhook handler for all subscription lifecycle events.
 */

import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import type { Tier } from '@/lib/ai-config';

/**
 * Maps a Stripe Price ID to our internal tier name.
 */
function priceIdToTier(priceId: string): Tier {
    if (priceId === process.env.STRIPE_PRICE_ID_TEAM) return 'team';
    if (priceId === process.env.STRIPE_PRICE_ID_BROTHER) return 'brother';
    // Fallback: try to detect by metadata on the price if price IDs aren't set yet
    return 'brother';
}

/**
 * Maps a Stripe subscription status to our internal subscription_status.
 */
function stripeStatusToInternal(status: Stripe.Subscription.Status): 'active' | 'cancelled' | 'past_due' | 'trialing' | 'none' {
    switch (status) {
        case 'active': return 'active';
        case 'trialing': return 'trialing' as any;
        case 'canceled': return 'cancelled';
        case 'past_due': return 'past_due';
        default: return 'none';
    }
}

/**
 * Upsert subscription + user tier from a Stripe Subscription object.
 * Safe to call multiple times — idempotent.
 */
export async function syncSubscriptionToDb(
    subscription: Stripe.Subscription,
    customerId: string,
    userId?: string
) {
    const admin = await createServiceClient();

    // Resolve user by stripe_customer_id if userId not provided
    let resolvedUserId = userId;
    if (!resolvedUserId) {
        const { data: user } = await admin
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single();
        resolvedUserId = user?.id;
    }

    if (!resolvedUserId) {
        console.error(`[stripe-sync] Could not resolve user for customer: ${customerId}`);
        return;
    }

    // Determine tier from first line item price
    const priceId = subscription.items.data[0]?.price.id ?? '';
    const tier = priceIdToTier(priceId);
    const status = stripeStatusToInternal(subscription.status);
    const periodEnd = new Date((subscription as any).current_period_end * 1000).toISOString();
    const isActive = status === 'active' || (status as string) === 'trialing';

    // Upsert into subscriptions table
    const { error: subError } = await admin
        .from('subscriptions')
        .upsert({
            user_id: resolvedUserId,
            stripe_subscription_id: subscription.id,
            tier,
            status,
            charter_pricing: false,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

    if (subError) {
        console.error('[stripe-sync] subscriptions upsert error:', subError);
    }

    // Update users table — tier + subscription_status
    const { error: userError } = await admin
        .from('users')
        .update({
            stripe_customer_id: customerId,
            subscription_status: status,
            subscription_plan: isActive ? tier : 'free',
            tier: isActive ? tier : 'free',
            updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedUserId);

    if (userError) {
        console.error('[stripe-sync] users update error:', userError);
    }

    console.log(`[stripe-sync] Synced user ${resolvedUserId} → tier=${tier}, status=${status}`);
}

/**
 * Handle subscription cancellation — revert user to free tier.
 */
export async function cancelSubscriptionInDb(subscription: Stripe.Subscription, customerId: string) {
    const admin = await createServiceClient();

    const { data: user } = await admin
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (!user) {
        console.error(`[stripe-sync] Could not find user for customer: ${customerId}`);
        return;
    }

    await admin.from('subscriptions').update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);

    await admin.from('users').update({
        subscription_status: 'cancelled',
        subscription_plan: 'free',
        tier: 'free',
        updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    console.log(`[stripe-sync] Cancelled subscription for user ${user.id}`);
}
