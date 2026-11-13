/**
 * Pure trial-eligibility rules for the BFCM 2026 offer (no I/O).
 */
import { offerWindowState, type OfferWindowState } from './config';

export type TrialIneligibleReason =
    | 'offer_upcoming'
    | 'offer_closed'
    | 'admin'
    | 'already_subscribed'
    | 'already_used_trial';

export interface TrialEligibilityInput {
    now: Date;
    startsAt?: Date;
    isAdmin: boolean;
    /** The Stripe customer has an active, trialing or past_due subscription. */
    hasLiveStripeSubscription: boolean;
    /** The user has ever completed a trial enrollment or held any Stripe subscription. */
    hasPriorTrialOrSubscription: boolean;
}

export interface TrialEligibility {
    eligible: boolean;
    window: OfferWindowState;
    reason?: TrialIneligibleReason;
}

/**
 * Beta/promo comps are deliberately NOT counted as a prior trial or
 * subscription: they never had a card on file.
 */
export function evaluateTrialEligibility(input: TrialEligibilityInput): TrialEligibility {
    const window = offerWindowState(input.now, input.startsAt);
    if (window === 'upcoming') return { eligible: false, window, reason: 'offer_upcoming' };
    if (window === 'closed') return { eligible: false, window, reason: 'offer_closed' };
    if (input.isAdmin) return { eligible: false, window, reason: 'admin' };
    if (input.hasLiveStripeSubscription) return { eligible: false, window, reason: 'already_subscribed' };
    if (input.hasPriorTrialOrSubscription) return { eligible: false, window, reason: 'already_used_trial' };
    return { eligible: true, window };
}

export const INELIGIBLE_MESSAGES: Record<TrialIneligibleReason, string> = {
    offer_upcoming: 'The Black Friday trial opens on November 19.',
    offer_closed: 'The Black Friday trial closed on November 30 at 11:59 p.m. PST.',
    admin: 'Admin accounts already have full access and cannot enrol in the trial.',
    already_subscribed: 'You already have an active subscription. Manage it from Settings.',
    already_used_trial: 'This account has already used a free trial or subscription.',
};
