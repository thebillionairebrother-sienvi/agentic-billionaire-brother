/**
 * Plan Gating — Feature Entitlements by Tier
 *
 * This is the product feature gate layer, separate from ai-config.ts
 * (which handles AI token budget enforcement).
 * 
 * This file defines WHAT features each plan gets access to.
 */

import type { Tier } from '@/lib/ai-config';

export interface PlanFeatures {
    /** Prompts per day (matches TIER_CONFIG for display purposes) */
    dailyPrompts: number;
    /** Can use "Have Derek Do It" full Ship Pack flow */
    shipPack: boolean;
    /** Can download AI deliverables */
    deliverableDownloads: boolean;
    /** Can access weekly Board Meeting / check-in */
    boardMeeting: boolean;
    /** Can access team seats / collaboration */
    teamSeats: boolean;
    /** Can purchase extra token top-ups when limit is hit */
    tokenTopUp: boolean;
    /** Max weekly cycles (null = unlimited) */
    maxWeeklyCycles: number | null;
    /** Plan display label */
    label: string;
    /** Monthly price in USD */
    monthlyPrice: number | null;
}

export const PLAN_FEATURES: Record<Tier, PlanFeatures> = {
    free: {
        dailyPrompts: 10,
        shipPack: false,
        deliverableDownloads: false,
        boardMeeting: false,
        teamSeats: false,
        tokenTopUp: false,
        maxWeeklyCycles: 1,
        label: 'Free',
        monthlyPrice: 0,
    },
    brother: {
        dailyPrompts: 40,
        shipPack: true,
        deliverableDownloads: true,
        boardMeeting: true,
        teamSeats: false,
        tokenTopUp: true,
        maxWeeklyCycles: null,
        label: 'Brother Plan',
        monthlyPrice: 99.99,
    },
    team: {
        dailyPrompts: 100,
        shipPack: true,
        deliverableDownloads: true,
        boardMeeting: true,
        teamSeats: true,
        tokenTopUp: true,
        maxWeeklyCycles: null,
        label: 'Team Plan',
        monthlyPrice: 199,
    },
};

export type PlanFeatureKey = keyof Omit<PlanFeatures, 'label' | 'monthlyPrice' | 'dailyPrompts' | 'maxWeeklyCycles'>;

/**
 * Check if a given tier has access to a feature.
 */
export function canAccess(tier: Tier, feature: PlanFeatureKey): boolean {
    return !!PLAN_FEATURES[tier][feature];
}

/**
 * Get the upgrade target for a given tier.
 * Free → brother, brother → team, team → null (already max).
 */
export function getUpgradeTier(tier: Tier): Tier | null {
    if (tier === 'free') return 'brother';
    if (tier === 'brother') return 'team';
    return null;
}

/**
 * Stripe Price IDs indexed by tier for easy lookup in checkout.
 * These pull from environment variables set in .env.local.
 */
export const STRIPE_PRICE_IDS: Partial<Record<Tier, string>> = {
    brother: process.env.STRIPE_PRICE_ID_BROTHER || '',
    team: process.env.STRIPE_PRICE_ID_TEAM || '',
};
