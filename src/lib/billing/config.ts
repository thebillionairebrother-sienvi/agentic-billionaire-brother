/**
 * Billing configuration and pure helpers (no I/O).
 *
 * Commercial terms (confirmed 2026-11-13):
 *  - Brother plan: $39 USD for the first month, then $49 USD/month.
 *  - BFCM 2026 (Nov 19 – Nov 30 11:59 p.m. PST): one full month free, card
 *    required, then the standard Brother price. The BFCM offer replaces the
 *    $39 first month for people who enrol in the trial.
 *  - Team plan: being re-costed, so checkout is disabled unless
 *    NEXT_PUBLIC_TEAM_CHECKOUT_ENABLED=true.
 *
 * All time math uses fixed PST (UTC-8), never local/DST time.
 */

/** Fixed Pacific Standard Time offset in milliseconds (UTC-8). */
export const PST_OFFSET_MS = -8 * 60 * 60 * 1000;

// ─── Brother plan pricing ─────────────────────────────────────────────

/** Stripe lookup key of the standard Brother monthly price ($49 USD). */
export const BROTHER_PRICE_LOOKUP_KEY = 'bb_brother_monthly_4900';

/** Stripe coupon id that takes $10 off the first invoice ($49 → $39). */
export const BROTHER_INTRO_COUPON_ID = 'bb-brother-first-month-39';

/** Display fallbacks used only when Stripe is not reachable/configured. */
export const BROTHER_STANDARD_CENTS = 4900;
export const BROTHER_INTRO_CENTS = 3900;
export const BILLING_CURRENCY = 'usd';

/** Team checkout stays off until the re-costed Team plan is approved. */
export function isTeamCheckoutEnabled(): boolean {
    return process.env.NEXT_PUBLIC_TEAM_CHECKOUT_ENABLED === 'true';
}

// ─── BFCM 2026 trial offer ────────────────────────────────────────────

export const BFCM_OFFER_ID = 'bfcm2026';
export const BFCM_TERMS_VERSION = 'bfcm2026-v1';
export const BFCM_PLAN = 'brother' as const;

/*
 * BFCM first charge: the free month replaces the $39 intro, so the first
 * charge after the trial is the standard $49. Charging $39 after the trial
 * is NOT implemented (it needs the coupon-after-trial behaviour proven on a
 * Stripe test clock first).
 */

/**
 * Enrollment opens (default Nov 19 00:00 PST). Override with
 * NEXT_PUBLIC_BFCM_STARTS_AT (ISO string). It must be NEXT_PUBLIC_ so the
 * homepage/upgrade page (client) and /offer + API (server) agree; it is
 * inlined at build time.
 */
export function bfcmStartsAt(): Date {
    return new Date(process.env.NEXT_PUBLIC_BFCM_STARTS_AT || '2026-11-19T08:00:00.000Z');
}

/**
 * Enrollment closes: Nov 30 2026 11:59 p.m. PST is the last eligible minute.
 * The first rejected instant is 2026-12-01T08:00:00.000Z.
 */
export const BFCM_ENDS_AT = new Date('2026-12-01T08:00:00.000Z');

export type OfferWindowState = 'upcoming' | 'open' | 'closed';

export function offerWindowState(now: Date, startsAt: Date = bfcmStartsAt()): OfferWindowState {
    const t = now.getTime();
    if (t < startsAt.getTime()) return 'upcoming';
    if (t >= BFCM_ENDS_AT.getTime()) return 'closed';
    return 'open';
}

/**
 * One full calendar month from `start`, measured on the fixed-PST wall clock.
 * Example: Nov 30 23:00 PST → Dec 30 23:00 PST. If the target month is
 * shorter, the day is clamped (Jan 31 → Feb 28).
 */
export function addOneMonthPst(start: Date): Date {
    const wall = new Date(start.getTime() + PST_OFFSET_MS);
    const y = wall.getUTCFullYear();
    const m = wall.getUTCMonth();
    const d = wall.getUTCDate();
    const targetMonth = m + 1;
    const daysInTarget = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
    const shifted = Date.UTC(
        y,
        targetMonth,
        Math.min(d, daysInTarget),
        wall.getUTCHours(),
        wall.getUTCMinutes(),
        wall.getUTCSeconds(),
        wall.getUTCMilliseconds(),
    );
    return new Date(shifted - PST_OFFSET_MS);
}

/** Format an instant on the fixed-PST clock, e.g. "Dec 30, 2026, 11:00 p.m. PST". */
export function formatPst(date: Date, opts: { withTime?: boolean } = { withTime: true }): string {
    const wall = new Date(date.getTime() + PST_OFFSET_MS);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const base = `${months[wall.getUTCMonth()]} ${wall.getUTCDate()}, ${wall.getUTCFullYear()}`;
    if (opts.withTime === false) return base;
    const h24 = wall.getUTCHours();
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mm = String(wall.getUTCMinutes()).padStart(2, '0');
    return `${base}, ${h12}:${mm} ${h24 < 12 ? 'a.m.' : 'p.m.'} PST`;
}

export function formatMoney(cents: number, currency: string = BILLING_CURRENCY): string {
    const amount = (cents / 100).toFixed(2);
    return `$${amount} ${currency.toUpperCase()}`;
}

/** The renewal-consent sentence the user must explicitly agree to. */
export function renewalConsentText(firstChargeAt: Date, priceCents: number, currency: string): string {
    return (
        `I understand my free month of the Brother Plan ends on ${formatPst(firstChargeAt)}. ` +
        `Unless I cancel before then, my card will be charged ${formatMoney(priceCents, currency)} ` +
        `on that date and every month after until I cancel. I can cancel anytime before the first charge and pay nothing.`
    );
}

// ─── Reminders & failed payments ──────────────────────────────────────

export const REMINDER_DAYS_BEFORE_CHARGE = 7;
export const PAST_DUE_GRACE_DAYS = 7;

/** True when a reminder is due: within 7 days of the charge and the charge is still in the future. */
export function isReminderDue(firstChargeAt: Date, now: Date): boolean {
    const msUntil = firstChargeAt.getTime() - now.getTime();
    return msUntil > 0 && msUntil <= REMINDER_DAYS_BEFORE_CHARGE * 24 * 60 * 60 * 1000;
}

export function isPastDueGraceOver(pastDueSince: Date, now: Date): boolean {
    return now.getTime() - pastDueSince.getTime() >= PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

// ─── Beta program ─────────────────────────────────────────────────────

/** Beta comps and beta codes end at this instant (override with BETA_PROGRAM_ENDS_AT). */
export function betaProgramEndsAt(): Date {
    return new Date(process.env.BETA_PROGRAM_ENDS_AT || '2026-11-20T08:00:00.000Z');
}

export function isBetaProgramOver(now: Date = new Date()): boolean {
    return now.getTime() >= betaProgramEndsAt().getTime();
}
