/**
 * Server-only: trial eligibility lookup for the current user (DB + Stripe).
 */
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/admin';
import { STRIPE_TEST_MODE } from '@/lib/stripe';
import { getSubscriptionHistory } from './customer';
import { evaluateTrialEligibility, type TrialEligibility } from './eligibility';

export interface TrialUserContext {
    userId: string;
    email: string | null;
    displayName: string | null;
    stripeCustomerId: string | null;
    isAdmin: boolean;
    eligibility: TrialEligibility;
    enrollment: { status: string; first_charge_at: string } | null;
}

export async function getTrialContext(userId: string, email: string | null | undefined, now = new Date()): Promise<TrialUserContext> {
    const admin = await createServiceClient();
    const [{ data: user }, { data: profile }, { data: enrollments }, { data: subs }] = await Promise.all([
        admin.from('users').select('email, display_name, stripe_customer_id').eq('id', userId).maybeSingle(),
        admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
        admin.from('trial_enrollments').select('offer_id, status, first_charge_at').eq('user_id', userId),
        admin.from('subscriptions').select('status, stripe_subscription_id').eq('user_id', userId).not('stripe_subscription_id', 'is', null),
    ]);

    const isAdmin = isAdminUser(email ?? user?.email, profile?.role);
    const completedEnrollment = enrollments?.find((e) => e.status !== 'pending') ?? null;

    let hasLive = Boolean(subs?.some((s) => ['active', 'trialing', 'past_due'].includes(s.status)));
    let hasAny = Boolean(subs && subs.length > 0) || Boolean(completedEnrollment);

    // Stripe is the source of truth for subscription history when configured.
    if (!STRIPE_TEST_MODE && user?.stripe_customer_id) {
        const history = await getSubscriptionHistory(user.stripe_customer_id);
        hasLive = hasLive || Boolean(history.live);
        hasAny = hasAny || history.any;
    }

    return {
        userId,
        email: email ?? user?.email ?? null,
        displayName: user?.display_name ?? null,
        stripeCustomerId: user?.stripe_customer_id ?? null,
        isAdmin,
        eligibility: evaluateTrialEligibility({
            now,
            isAdmin,
            hasLiveStripeSubscription: hasLive,
            hasPriorTrialOrSubscription: hasAny,
        }),
        enrollment: completedEnrollment
            ? { status: completedEnrollment.status, first_charge_at: completedEnrollment.first_charge_at }
            : null,
    };
}
