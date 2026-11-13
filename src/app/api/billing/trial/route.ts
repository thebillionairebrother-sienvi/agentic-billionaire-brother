import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import {
    addOneMonthPst, BFCM_OFFER_ID, BFCM_PLAN, BFCM_TERMS_VERSION, formatMoney, formatPst,
    renewalConsentText,
} from '@/lib/billing/config';
import { INELIGIBLE_MESSAGES } from '@/lib/billing/eligibility';
import { getBrotherPrice } from '@/lib/billing/stripe-prices';
import { ensureStripeCustomer } from '@/lib/billing/customer';
import { getTrialContext } from '@/lib/billing/trial';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/trial — start the BFCM 2026 card-required free month.
 * Body: { consent: true, termsVersion, shownFirstChargeDate, utm? }
 *
 * The cutoff is enforced here (server clock), at Checkout Session creation.
 * A session created before the cutoff stays valid for its 30-minute life.
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Please sign in to start your trial.' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        if (body.consent !== true) {
            return NextResponse.json({ error: 'Please confirm the automatic renewal terms to continue.' }, { status: 400 });
        }
        if (body.termsVersion !== BFCM_TERMS_VERSION) {
            return NextResponse.json({ error: 'The offer terms have changed. Please refresh the page.', refresh: true }, { status: 409 });
        }

        const now = new Date();
        const ctx = await getTrialContext(user.id, user.email, now);
        if (!ctx.eligibility.eligible) {
            return NextResponse.json(
                { error: INELIGIBLE_MESSAGES[ctx.eligibility.reason!], reason: ctx.eligibility.reason },
                { status: 403 },
            );
        }

        if (STRIPE_TEST_MODE) {
            return NextResponse.json({ error: 'Payments are not configured on this environment.' }, { status: 503 });
        }

        const price = await getBrotherPrice();
        const firstChargeAt = addOneMonthPst(now);

        // The user must have been shown the same first-charge date we will set.
        const serverDate = formatPst(firstChargeAt, { withTime: false });
        if (body.shownFirstChargeDate !== serverDate) {
            return NextResponse.json(
                { error: `Your first-charge date is now ${serverDate}. Please review and confirm again.`, refresh: true },
                { status: 409 },
            );
        }

        const consentText = renewalConsentText(firstChargeAt, price.unitAmount, price.currency);
        const admin = await createServiceClient();

        // One enrollment per user per offer. Pending rows (abandoned checkouts) are refreshed.
        const { data: existing } = await admin
            .from('trial_enrollments')
            .select('id, status, stripe_checkout_session_id')
            .eq('user_id', user.id)
            .eq('offer_id', BFCM_OFFER_ID)
            .maybeSingle();
        if (existing && existing.status !== 'pending') {
            return NextResponse.json({ error: INELIGIBLE_MESSAGES.already_used_trial }, { status: 403 });
        }

        // Double-click / back-button: reuse the still-open Checkout Session
        // instead of creating a second one.
        if (existing?.stripe_checkout_session_id) {
            try {
                const open = await stripe.checkout.sessions.retrieve(existing.stripe_checkout_session_id);
                if (open.status === 'open' && open.url) return NextResponse.json({ url: open.url });
            } catch {
                // Session missing/expired: fall through and create a new one.
            }
        }

        const customerId = await ensureStripeCustomer({
            id: user.id,
            email: ctx.email || user.email!,
            displayName: ctx.displayName,
            stripeCustomerId: ctx.stripeCustomerId,
        });

        const enrollmentRow = {
            user_id: user.id,
            offer_id: BFCM_OFFER_ID,
            status: 'pending',
            plan: BFCM_PLAN,
            stripe_customer_id: customerId,
            stripe_price_id: price.priceId,
            price_amount: price.unitAmount,
            currency: price.currency,
            billing_interval: price.interval,
            first_charge_at: firstChargeAt.toISOString(),
            terms_version: BFCM_TERMS_VERSION,
            consent_text: consentText,
            consented_at: now.toISOString(),
            consent_ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            consent_user_agent: request.headers.get('user-agent')?.slice(0, 500) || null,
            utm: body.utm && typeof body.utm === 'object' ? body.utm : null,
            updated_at: now.toISOString(),
        };
        const { data: enrollment, error: enrollError } = await admin
            .from('trial_enrollments')
            .upsert(enrollmentRow, { onConflict: 'user_id,offer_id' })
            .select('id')
            .single();
        if (enrollError || !enrollment) {
            console.error('[trial] enrollment upsert failed:', enrollError);
            return NextResponse.json({ error: 'Could not start your trial. Please try again.' }, { status: 500 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const metadata = { userId: user.id, tier: BFCM_PLAN, app: 'bb', offer: BFCM_OFFER_ID, enrollmentId: enrollment.id };

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            payment_method_collection: 'always',
            line_items: [{ price: price.priceId!, quantity: 1 }],
            allow_promotion_codes: false,
            subscription_data: {
                trial_end: Math.floor(firstChargeAt.getTime() / 1000),
                trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
                metadata,
            },
            metadata,
            // Stripe requires 30 min–24 h after creation; compute right before
            // the call with a small buffer so earlier awaits can't push it under 30 min.
            expires_at: Math.floor(Date.now() / 1000) + 32 * 60,
            custom_text: {
                submit: {
                    message:
                        `No charge today. Your free month ends ${formatPst(firstChargeAt)}. ` +
                        `Unless you cancel before then, you'll be charged ${formatMoney(price.unitAmount, price.currency)} ` +
                        `on that date and every month after. Cancel anytime from Settings.`,
                },
            },
            success_url: `${appUrl}/dashboard?trial=started`,
            cancel_url: `${appUrl}/offer?canceled=1`,
        }, { idempotencyKey: `bb-checkout-${BFCM_OFFER_ID}-${user.id}-${Math.floor(firstChargeAt.getTime() / 1000)}` });

        await admin.from('trial_enrollments')
            .update({ stripe_checkout_session_id: session.id })
            .eq('id', enrollment.id);

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('[trial] checkout error:', error);
        return NextResponse.json({ error: 'Could not start your trial. Please try again.' }, { status: 500 });
    }
}
