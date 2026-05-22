/**
 * AI Middleware — Subscription Lookup
 * Fetches user's subscription tier from the subscriptions table.
 * Falls back to 'brother' tier if no subscription found (free/default state).
 */
import { SupabaseClient } from '@supabase/supabase-js';
import type { Tier } from '@/lib/ai-config';
import { GuardError } from './types';

export interface SubscriptionInfo {
    tier: Tier;
    status: 'active' | 'cancelled' | 'past_due' | 'trialing';
}

export async function getSubscriptionInfo(
    supabase: SupabaseClient,
    userId: string
): Promise<SubscriptionInfo> {
    // 1. Query users table first since users has proper SELECT policies
    const { data: userRecord } = await supabase
        .from('users')
        .select('tier')
        .eq('id', userId)
        .single();

    const userTier = (userRecord?.tier as Tier) || 'free';

    if (userTier === 'free') {
        return {
            tier: 'free' as Tier,
            status: 'active' as SubscriptionInfo['status'],
        };
    }

    // 2. Try to get detailed billing status from subscriptions if present
    const { data: subRecord } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!subRecord) {
        // Trust users table tier and default status to active if no subscription row exists (e.g. promo code)
        return {
            tier: userTier,
            status: 'active' as SubscriptionInfo['status'],
        };
    }

    if (subRecord.status !== 'active' && subRecord.status !== 'trialing') {
        throw new GuardError(
            'BILLING_INACTIVE',
            'Your subscription is inactive. Please update your payment method.',
            402,
            false
        );
    }

    return {
        tier: subRecord.tier as Tier,
        status: subRecord.status as SubscriptionInfo['status'],
    };
}
