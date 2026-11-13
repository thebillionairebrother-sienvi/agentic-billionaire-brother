import { NextResponse } from 'next/server';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import { verifyCancelToken } from '@/lib/billing/cancel-token';
import { syncSubscriptionById } from '@/lib/stripe-sync';

export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/trial/cancel  { token }
 * One-click cancellation from the reminder email (no login required; the
 * token is an HMAC-signed, expiring link bound to one user + subscription).
 * Cancels at period end: the user keeps access until the trial ends, is never
 * charged, then returns to the free plan.
 */
export async function POST(request: Request) {
    if (STRIPE_TEST_MODE) {
        return NextResponse.json({ error: 'Payments are not configured.' }, { status: 503 });
    }
    const { token } = await request.json().catch(() => ({ token: null }));
    const payload = typeof token === 'string' ? verifyCancelToken(token) : null;
    if (!payload) {
        return NextResponse.json(
            { error: 'This link has expired or is invalid. Sign in and cancel from Settings → Manage Billing.' },
            { status: 400 },
        );
    }

    try {
        const sub = await stripe.subscriptions.retrieve(payload.s);
        if (sub.metadata?.userId !== payload.u) {
            return NextResponse.json({ error: 'This link is not valid for this subscription.' }, { status: 400 });
        }
        if (sub.status === 'canceled' || sub.cancel_at_period_end) {
            return NextResponse.json({ ok: true, alreadyCancelled: true, accessUntil: sub.trial_end });
        }
        if (sub.status !== 'trialing') {
            return NextResponse.json(
                { error: 'Your trial has already ended. Manage your plan from Settings.' },
                { status: 409 },
            );
        }

        const updated = await stripe.subscriptions.update(sub.id, {
            cancel_at_period_end: true,
            metadata: { ...sub.metadata, cancelled_via: 'reminder_email' },
        });
        await syncSubscriptionById(updated.id, payload.u);
        return NextResponse.json({ ok: true, accessUntil: updated.trial_end });
    } catch (err) {
        console.error('[trial-cancel] failed:', err);
        return NextResponse.json({ error: 'Could not cancel right now. Please try again or use Settings.' }, { status: 500 });
    }
}
