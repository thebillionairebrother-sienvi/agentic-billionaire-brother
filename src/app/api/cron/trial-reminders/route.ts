import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import { sendEmail } from '@/lib/ses';
import { isPastDueGraceOver, REMINDER_DAYS_BEFORE_CHARGE } from '@/lib/billing/config';
import { signCancelToken } from '@/lib/billing/cancel-token';
import { buildTrialReminderEmail } from '@/lib/billing/reminder-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/trial-reminders — run hourly (Cloud Scheduler) with
 * `Authorization: Bearer $CRON_SECRET`.
 *  1. Sends the 7-day pre-charge reminder once per enrollment.
 *  2. Cancels subscriptions that stayed past_due beyond the grace period
 *     (the webhook then moves the user back to the free plan).
 */
export async function GET(request: Request) {
    if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (STRIPE_TEST_MODE) {
        return NextResponse.json({ skipped: 'stripe not configured' });
    }

    const now = new Date();
    const admin = await createServiceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const result = { remindersSent: 0, remindersSkipped: 0, reminderErrors: 0, pastDueCancelled: 0 };

    // ── 1. Seven-day reminders ──
    const windowEnd = new Date(now.getTime() + REMINDER_DAYS_BEFORE_CHARGE * 86_400_000).toISOString();
    const { data: due } = await admin
        .from('trial_enrollments')
        .select('id, user_id, stripe_subscription_id, first_charge_at, price_amount, currency, billing_interval')
        .eq('status', 'active')
        .is('reminder_sent_at', null)
        .gt('first_charge_at', now.toISOString())
        .lte('first_charge_at', windowEnd)
        .limit(200);

    for (const row of due ?? []) {
        // Claim the row first so overlapping runs can't double-send.
        const { data: claimed } = await admin
            .from('trial_enrollments')
            .update({ reminder_sent_at: now.toISOString() })
            .eq('id', row.id)
            .is('reminder_sent_at', null)
            .select('id');
        if (!claimed?.length) continue;

        try {
            if (!row.stripe_subscription_id) throw new Error('missing subscription id');
            const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
            // Already cancelled → no charge will happen, so no reminder needed.
            if (sub.status !== 'trialing' || sub.cancel_at_period_end || sub.cancel_at) {
                result.remindersSkipped++;
                continue;
            }
            const chargeAt = new Date((sub.trial_end ?? 0) * 1000);
            const item = sub.items.data[0];

            const { data: user } = await admin.from('users').select('email, display_name').eq('id', row.user_id).single();
            if (!user?.email) throw new Error('user email not found');

            const token = signCancelToken({
                u: row.user_id,
                s: sub.id,
                exp: Math.floor(chargeAt.getTime() / 1000),
            });
            const email = buildTrialReminderEmail({
                name: user.display_name,
                firstChargeAt: chargeAt,
                priceCents: item?.price.unit_amount ?? row.price_amount,
                currency: item?.price.currency ?? row.currency,
                interval: item?.price.recurring?.interval ?? row.billing_interval,
                cancelUrl: `${appUrl}/trial/cancel?token=${encodeURIComponent(token)}`,
                manageUrl: `${appUrl}/settings`,
            });

            const sent = await sendEmail({ to: user.email, ...email });
            if (!sent.success) throw new Error(sent.error || 'send failed');
            result.remindersSent++;
        } catch (err) {
            console.error(`[trial-reminders] enrollment ${row.id} failed:`, err);
            result.reminderErrors++;
            // Release the claim so the next run retries.
            await admin.from('trial_enrollments').update({ reminder_sent_at: null }).eq('id', row.id);
        }
    }

    // ── 2. Failed-payment grace period ──
    const { data: pastDue } = await admin
        .from('subscriptions')
        .select('stripe_subscription_id, past_due_since')
        .eq('status', 'past_due')
        .not('past_due_since', 'is', null)
        .not('stripe_subscription_id', 'is', null)
        .limit(200);

    for (const row of pastDue ?? []) {
        if (!isPastDueGraceOver(new Date(row.past_due_since!), now)) continue;
        try {
            const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id!);
            if (sub.status === 'past_due' || sub.status === 'unpaid') {
                await stripe.subscriptions.cancel(sub.id, {
                    cancellation_details: { comment: 'BB: payment failed, grace period ended' },
                });
                // The user has lost access, so they must never be charged for the
                // failed period later: void the subscription's open invoices
                // (otherwise Stripe retries could still collect them).
                const open = await stripe.invoices.list({ subscription: sub.id, status: 'open', limit: 10 });
                for (const inv of open.data) {
                    if (inv.id) await stripe.invoices.voidInvoice(inv.id);
                }
                result.pastDueCancelled++;
            }
        } catch (err) {
            console.error(`[trial-reminders] past-due cancel failed for ${row.stripe_subscription_id}:`, err);
        }
    }

    console.log('[trial-reminders]', result);
    return NextResponse.json(result);
}
