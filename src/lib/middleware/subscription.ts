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
    const { data } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) {
        // No subscription record — default to brother tier (free/onboarding state)
        return {
            tier: 'brother' as Tier,
            status: 'active' as SubscriptionInfo['status'],
        };
    }

    if (data.status !== 'active' && data.status !== 'trialing') {
        throw new GuardError(
            'BILLING_INACTIVE',
            'Your subscription is inactive. Please update your payment method.',
            402,
            false
        );
    }

    return {
        tier: data.tier as Tier,
        status: data.status as SubscriptionInfo['status'],
    };
}
