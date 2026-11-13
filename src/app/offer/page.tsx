import type { Metadata } from 'next';
import Link from 'next/link';
import { Crown, Check, CalendarClock, MailCheck, XCircle, Target, MessageSquare, Repeat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { STRIPE_TEST_MODE } from '@/lib/stripe';
import {
    addOneMonthPst, BFCM_ENDS_AT, BFCM_TERMS_VERSION, formatMoney, formatPst, offerWindowState,
    renewalConsentText, REMINDER_DAYS_BEFORE_CHARGE,
} from '@/lib/billing/config';
import { INELIGIBLE_MESSAGES } from '@/lib/billing/eligibility';
import { getBrotherPriceForDisplay } from '@/lib/billing/stripe-prices';
import { getTrialContext } from '@/lib/billing/trial';
import { PLAN_FEATURES } from '@/lib/plan-gating';
import { OfferCheckout } from './OfferCheckout';
import styles from './offer.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Try the Brother Plan free for one month | Billionaire Brother',
    description: 'Bring your next business decision to Derek. One month free, credit card required. Offer ends November 30, 11:59 p.m. PST.',
};

const INCLUDED = [
    `${PLAN_FEATURES.brother.dailyPrompts} prompts a day with Derek`,
    'Strategy diagnosis and Decision Scores',
    'Have Derek Do It: action-step packs',
    'Downloadable deliverables',
    'Weekly Board Meeting check-ins',
];

const STEPS = [
    { icon: Target, title: 'Pick one decision', body: 'Clarify an offer, choose your next step, or size up a competitor.' },
    { icon: MessageSquare, title: 'Work it through with Derek', body: 'Get a diagnosis, ranked options and a concrete action plan.' },
    { icon: Repeat, title: 'Decide if it earns its keep', body: 'Keep going after your free month, or cancel before it ends.' },
];

export default async function OfferPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
    const params = await searchParams;
    const now = new Date();
    const offerWindow = offerWindowState(now);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ctx = user && offerWindow === 'open' ? await getTrialContext(user.id, user.email, now) : null;

    const price = await getBrotherPriceForDisplay();
    const firstChargeAt = addOneMonthPst(now);
    const firstChargeDate = formatPst(firstChargeAt, { withTime: false });
    const priceLabel = formatMoney(price.unitAmount, price.currency);
    const perLabel = price.interval === 'year' ? 'year' : 'month';
    const cutoffLabel = 'November 30, 2026 at 11:59 p.m. PST';

    // Stripe is configured but the $49 lookup-key price is missing: never show a
    // CTA that would fail at checkout.
    const pricingMisconfigured = !STRIPE_TEST_MODE && price.source === 'fallback';

    let action: React.ReactNode;
    if (pricingMisconfigured && offerWindow === 'open') {
        action = <p className={styles.notice}>The trial is temporarily unavailable. Please try again shortly.</p>;
    } else if (offerWindow === 'upcoming') {
        action = <p className={styles.notice}>The trial opens on November 19. Check back then.</p>;
    } else if (offerWindow === 'closed') {
        action = (
            <div className={styles.notice}>
                <p>{INELIGIBLE_MESSAGES.offer_closed}</p>
                <Link href="/upgrade" className={styles.secondaryCta}>See current plans</Link>
            </div>
        );
    } else if (!user) {
        action = (
            <div className={styles.checkout}>
                <Link href="/auth?mode=signup&redirect=%2Foffer" className={styles.cta}>Create your account to start</Link>
                <p className={styles.hint}>
                    Already have an account? <Link href="/auth?redirect=%2Foffer">Sign in</Link>
                </p>
            </div>
        );
    } else if (ctx && !ctx.eligibility.eligible) {
        action = (
            <div className={styles.notice}>
                <p>{INELIGIBLE_MESSAGES[ctx.eligibility.reason!]}</p>
                <Link href={ctx.eligibility.reason === 'already_subscribed' ? '/settings' : '/dashboard'} className={styles.secondaryCta}>
                    {ctx.eligibility.reason === 'already_subscribed' ? 'Go to Settings' : 'Go to your dashboard'}
                </Link>
            </div>
        );
    } else {
        action = (
            <OfferCheckout
                termsVersion={BFCM_TERMS_VERSION}
                firstChargeDate={firstChargeDate}
                consentText={renewalConsentText(firstChargeAt, price.unitAmount, price.currency)}
            />
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <Link href="/" className={styles.brand}>
                    <span className={styles.logoMark}><Crown size={18} aria-hidden /></span>
                    Billionaire Brother
                </Link>
                {!user && <Link href="/auth?redirect=%2Foffer" className={styles.headerLink}>Sign in</Link>}
            </header>

            <main className={styles.main}>
                {params.canceled && (
                    <div className={styles.banner} role="status">Checkout was cancelled. Nothing was charged.</div>
                )}

                <section className={styles.hero}>
                    <p className={styles.eyebrow}>Black Friday · Cyber Monday</p>
                    <h1 className={styles.title}>Bring your next business decision to Derek.</h1>
                    <p className={styles.lede}>
                        Try the Brother Plan free for one month. Credit card required.
                    </p>
                </section>

                <div className={styles.grid}>
                    <div className={styles.details}>
                        <section className={styles.section}>
                            <h2 className={styles.h2}>How to get the most from your month</h2>
                            <ol className={styles.steps}>
                                {STEPS.map((s, i) => (
                                    <li key={s.title} className={styles.step}>
                                        <span className={styles.stepNum}>{i + 1}</span>
                                        <div>
                                            <h3 className={styles.stepTitle}><s.icon size={16} aria-hidden /> {s.title}</h3>
                                            <p className={styles.stepBody}>{s.body}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section className={styles.section}>
                            <h2 className={styles.h2}>Included in the Brother Plan</h2>
                            <ul className={styles.included}>
                                {INCLUDED.map((f) => (
                                    <li key={f}><Check size={16} aria-hidden /> {f}</li>
                                ))}
                            </ul>
                            <p className={styles.small}>
                                Standard Brother Plan usage limits apply during the trial and after it. Usage is not unlimited.
                            </p>
                        </section>

                        <section className={styles.section}>
                            <h2 className={styles.h2}>The fine print, in plain words</h2>
                            <ul className={styles.terms}>
                                <li><CalendarClock size={16} aria-hidden /> Your free month starts when you sign up and lasts one full month, even if you join on the last day.</li>
                                <li><MailCheck size={16} aria-hidden /> We email you {REMINDER_DAYS_BEFORE_CHARGE} days before your first charge, with a one-click cancel link.</li>
                                <li><XCircle size={16} aria-hidden /> Cancel anytime before your first charge and pay nothing. You keep access until the month ends, then move to the free plan.</li>
                                <li><Crown size={16} aria-hidden /> No card? You can keep using the free plan. The card is only needed for the trial.</li>
                            </ul>
                            <p className={styles.small}>
                                Sign-ups close {cutoffLabel} ({BFCM_ENDS_AT.toISOString().slice(0, 16).replace('T', ' ')} UTC).
                                One trial per account.
                            </p>
                        </section>
                    </div>

                    <aside className={styles.summary} aria-label="Trial summary">
                        <div className={styles.summaryHead}>
                            <span className={styles.planName}><Crown size={16} aria-hidden /> Brother Plan</span>
                            <span className={styles.badge}>1 month free</span>
                        </div>

                        <dl className={styles.lines}>
                            <div className={styles.line}>
                                <dt>Due today</dt>
                                <dd className={styles.big}>$0.00</dd>
                            </div>
                            <div className={styles.line}>
                                <dt>First charge</dt>
                                <dd>{priceLabel}{offerWindow === 'open' ? ` on ${firstChargeDate}` : ', one month after sign-up'}</dd>
                            </div>
                            <div className={styles.line}>
                                <dt>Then</dt>
                                <dd>{priceLabel} every {perLabel} until you cancel</dd>
                            </div>
                        </dl>

                        {action}
                    </aside>
                </div>
            </main>

            <footer className={styles.footer}>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/refunds">Refunds</Link>
                <Link href="/contact">Contact</Link>
            </footer>
        </div>
    );
}
