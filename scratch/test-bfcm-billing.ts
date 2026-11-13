/**
 * BFCM 2026 billing logic checks. Run: npx tsx scratch/test-bfcm-billing.ts
 * Pure functions only — no Stripe or Supabase calls.
 */
import assert from 'node:assert/strict';
import {
    addOneMonthPst, offerWindowState, formatPst, isReminderDue, isPastDueGraceOver,
    renewalConsentText, BFCM_ENDS_AT,
} from '../src/lib/billing/config';
import { evaluateTrialEligibility } from '../src/lib/billing/eligibility';
import { signCancelToken, verifyCancelToken } from '../src/lib/billing/cancel-token';

let passed = 0;
function check(name: string, fn: () => void) {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
}

const START = new Date('2026-11-19T08:00:00.000Z'); // Nov 19 00:00 PST

console.log('Offer window (fixed PST cutoff)');
check('closed boundary is 2026-12-01T08:00:00Z', () =>
    assert.equal(BFCM_ENDS_AT.toISOString(), '2026-12-01T08:00:00.000Z'));
check('Nov 30 11:59:59.999 p.m. PST is open', () =>
    assert.equal(offerWindowState(new Date('2026-12-01T07:59:59.999Z'), START), 'open'));
check('Nov 30 11:59 p.m. PST (07:59:00Z) is open', () =>
    assert.equal(offerWindowState(new Date('2026-12-01T07:59:00.000Z'), START), 'open'));
check('Dec 1 00:00 PST (08:00:00Z) is closed', () =>
    assert.equal(offerWindowState(new Date('2026-12-01T08:00:00.000Z'), START), 'closed'));
check('Manila 3:59 p.m. Dec 1 is still open', () =>
    assert.equal(offerWindowState(new Date('2026-12-01T15:59:00+08:00'), START), 'open'));
check('Manila 4:00 p.m. Dec 1 is closed', () =>
    assert.equal(offerWindowState(new Date('2026-12-01T16:00:00+08:00'), START), 'closed'));
check('one ms before launch is upcoming', () =>
    assert.equal(offerWindowState(new Date('2026-11-19T07:59:59.999Z'), START), 'upcoming'));
check('launch instant is open', () => assert.equal(offerWindowState(START, START), 'open'));

console.log('Full month from signup (fixed PST wall clock)');
check('Nov 30 11:00 p.m. PST → Dec 30 11:00 p.m. PST', () => {
    const end = addOneMonthPst(new Date('2026-12-01T07:00:00.000Z'));
    assert.equal(end.toISOString(), '2026-12-31T07:00:00.000Z');
    assert.equal(formatPst(end), 'Dec 30, 2026, 11:00 p.m. PST');
});
check('Nov 19 9:15 a.m. PST → Dec 19 9:15 a.m. PST', () => {
    const end = addOneMonthPst(new Date('2026-11-19T17:15:00.000Z'));
    assert.equal(formatPst(end), 'Dec 19, 2026, 9:15 a.m. PST');
});
check('last eligible minute → Dec 30 11:59 p.m. PST', () => {
    const end = addOneMonthPst(new Date('2026-12-01T07:59:00.000Z'));
    assert.equal(formatPst(end), 'Dec 30, 2026, 11:59 p.m. PST');
});
check('every Nov 19–30 signup gets exactly 30 days', () => {
    for (let day = 19; day <= 30; day++) {
        const s = new Date(Date.UTC(2026, 10, day, 20, 0, 0));
        const days = (addOneMonthPst(s).getTime() - s.getTime()) / 86_400_000;
        assert.equal(days, 30, `Nov ${day}`);
    }
});
check('Jan 31 clamps to Feb 28', () =>
    assert.equal(formatPst(addOneMonthPst(new Date('2027-01-31T20:00:00.000Z')), { withTime: false }), 'Feb 28, 2027'));
check('trial end is at least 48h ahead (Stripe minimum)', () => {
    const s = new Date('2026-11-25T00:00:00Z');
    assert.ok(addOneMonthPst(s).getTime() - s.getTime() > 48 * 3600_000);
});

console.log('Reminder + failed-payment timing');
const charge = new Date('2026-12-30T07:00:00.000Z');
check('8 days before → not due', () => assert.equal(isReminderDue(charge, new Date(charge.getTime() - 8 * 86_400_000)), false));
check('exactly 7 days before → due', () => assert.equal(isReminderDue(charge, new Date(charge.getTime() - 7 * 86_400_000)), true));
check('after charge → not due', () => assert.equal(isReminderDue(charge, new Date(charge.getTime() + 1)), false));
check('past-due grace ends after 7 days', () => {
    const since = new Date('2026-12-30T07:00:00Z');
    assert.equal(isPastDueGraceOver(since, new Date('2027-01-06T06:59:59Z')), false);
    assert.equal(isPastDueGraceOver(since, new Date('2027-01-06T07:00:00Z')), true);
});
check('consent text names price, date and renewal', () => {
    const t = renewalConsentText(charge, 4900, 'usd');
    assert.match(t, /\$49\.00 USD/);
    assert.match(t, /Dec 29, 2026, 11:00 p\.m\. PST/);
    assert.match(t, /every month/);
});

console.log('Eligibility');
const base = { now: new Date('2026-11-25T00:00:00Z'), startsAt: START, isAdmin: false, hasLiveStripeSubscription: false, hasPriorTrialOrSubscription: false };
check('new / free / former-beta user is eligible', () => assert.equal(evaluateTrialEligibility(base).eligible, true));
check('admin is not eligible', () => assert.equal(evaluateTrialEligibility({ ...base, isAdmin: true }).reason, 'admin'));
check('paying subscriber is not eligible', () => assert.equal(evaluateTrialEligibility({ ...base, hasLiveStripeSubscription: true }).reason, 'already_subscribed'));
check('repeat enrollment is rejected', () => assert.equal(evaluateTrialEligibility({ ...base, hasPriorTrialOrSubscription: true }).reason, 'already_used_trial'));
check('after cutoff is rejected', () => assert.equal(evaluateTrialEligibility({ ...base, now: BFCM_ENDS_AT }).reason, 'offer_closed'));
check('before launch is rejected', () => assert.equal(evaluateTrialEligibility({ ...base, now: new Date('2026-11-18T00:00:00Z') }).reason, 'offer_upcoming'));

console.log('Cancel-link tokens');
const SECRET = 'test-secret-0123456789abcdef';
const tok = signCancelToken({ u: 'user-1', s: 'sub_123', exp: Math.floor(Date.UTC(2027, 0, 1) / 1000) }, SECRET);
check('valid token verifies', () => assert.deepEqual(verifyCancelToken(tok, new Date('2026-12-25T00:00:00Z'), SECRET)?.s, 'sub_123'));
check('tampered token is rejected', () => {
    const [body, sig] = tok.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'user-2', s: 'sub_123', exp: 9999999999 })).toString('base64url');
    assert.equal(verifyCancelToken(`${forged}.${sig}`, new Date(), SECRET), null);
    assert.equal(verifyCancelToken(`${body}.AAAA`, new Date(), SECRET), null);
});
check('expired token is rejected', () => assert.equal(verifyCancelToken(tok, new Date('2027-01-02T00:00:00Z'), SECRET), null));
check('wrong secret is rejected', () => assert.equal(verifyCancelToken(tok, new Date('2026-12-25T00:00:00Z'), 'another-secret-0123456789'), null));

console.log(`\nAll ${passed} checks passed.`);
