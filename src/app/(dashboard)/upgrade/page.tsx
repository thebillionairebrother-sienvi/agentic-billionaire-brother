'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Crown, Check, ArrowLeft, Zap, Users, Shield, Loader2, AlertCircle, X } from 'lucide-react';
import styles from './upgrade.module.css';

const PLANS = [
    {
        tier: 'brother' as const,
        name: 'Brother Plan',
        price: 99.99,
        badge: 'Most Popular',
        badgeStyle: 'gold',
        features: [
            '40 AI prompts / day',
            'Strategy diagnosis',
            'Decision Scores',
            'Have Derek Do It (Ship Pack)',
            'AI deliverable downloads',
            'Weekly Board Meeting check-ins',
            'Token top-up add-ons available',
        ],
        lockedFeatures: ['Team seats'],
        cta: 'Upgrade to Brother',
        icon: Crown,
        color: 'gold',
    },
    {
        tier: 'team' as const,
        name: 'Team Plan',
        price: 199,
        badge: 'Team',
        badgeStyle: 'blue',
        features: [
            '100 AI prompts / day',
            'Strategy diagnosis',
            'Decision Scores',
            'Have Derek Do It (Ship Pack)',
            'AI deliverable downloads',
            'Weekly Board Meeting check-ins',
            'Token top-up add-ons available',
            'Team seats & collaboration',
        ],
        lockedFeatures: [],
        cta: 'Upgrade to Team',
        icon: Users,
        color: 'blue',
    },
];

type CheckoutState = 'idle' | 'loading' | 'error';

function UpgradePageInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    const [activeTier, setActiveTier] = useState<string | null>(null);

    const wasCanceled = searchParams.get('canceled') === 'true';
    const preselectedPlan = searchParams.get('plan');

    useEffect(() => {
        if (preselectedPlan) {
            setActiveTier(preselectedPlan);
        }
    }, [preselectedPlan]);

    const handleCheckout = async (tier: 'brother' | 'team') => {
        setCheckoutState('loading');
        setCheckoutError(null);
        setActiveTier(tier);

        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to start checkout.');
            }

            if (data.test_mode) {
                // In test mode, redirect to settings with a notice
                router.push('/settings?billing=test');
                return;
            }

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setCheckoutError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setCheckoutState('error');
            setActiveTier(null);
        }
    };

    return (
        <div className={styles.page}>
            {/* Background glow */}
            <div className={styles.bgGlow} aria-hidden="true" />

            {/* Nav */}
            <nav className={styles.nav}>
                <Link href="/dashboard" className={styles.back}>
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
                <div className={styles.navBrand}>
                    <Crown size={18} style={{ color: 'var(--gold-400)' }} />
                    <span>The Billionaire Brother</span>
                </div>
            </nav>

            {/* Cancellation notice */}
            {wasCanceled && (
                <div className={styles.cancelBanner}>
                    <AlertCircle size={16} />
                    <span>No worries — you weren't charged. Ready when you are.</span>
                </div>
            )}

            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerBadge}>
                    <Zap size={14} />
                    <span>Upgrade Your Plan</span>
                </div>
                <h1 className={styles.title}>
                    Unlock Your Full<br />
                    <span className={styles.titleGold}>Billionaire Strategy Stack</span>
                </h1>
                <p className={styles.subtitle}>
                    Everything you need to go from strategy to revenue. Cancel anytime.
                </p>
            </header>

            {/* Pricing cards */}
            <div className={styles.pricingGrid}>
                {PLANS.map((plan) => {
                    const Icon = plan.icon;
                    const isLoading = checkoutState === 'loading' && activeTier === plan.tier;

                    return (
                        <div
                            key={plan.tier}
                            className={`${styles.card} ${plan.color === 'gold' ? styles.cardGold : styles.cardBlue}`}
                        >
                            {/* Badge */}
                            <div className={`${styles.cardBadge} ${plan.color === 'gold' ? styles.cardBadgeGold : styles.cardBadgeBlue}`}>
                                {plan.color === 'blue' ? <Users size={12} /> : <Crown size={12} />}
                                {plan.badge}
                            </div>

                            {/* Plan name & icon */}
                            <div className={styles.cardHeader}>
                                <div className={`${styles.planIcon} ${plan.color === 'gold' ? styles.planIconGold : styles.planIconBlue}`}>
                                    <Icon size={22} />
                                </div>
                                <div>
                                    <h2 className={styles.planName}>{plan.name}</h2>
                                    <div className={styles.planPrice}>
                                        <span className={styles.currency}>$</span>
                                        <span className={styles.amount}>{plan.price}</span>
                                        <span className={styles.period}>/mo</span>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <ul className={styles.featureList}>
                                {plan.features.map((f) => (
                                    <li key={f} className={styles.featureItem}>
                                        <span className={`${styles.featureCheck} ${plan.color === 'gold' ? styles.featureCheckGold : styles.featureCheckBlue}`}>
                                            <Check size={13} strokeWidth={3} />
                                        </span>
                                        {f}
                                    </li>
                                ))}
                                {plan.lockedFeatures.map((f) => (
                                    <li key={f} className={`${styles.featureItem} ${styles.featureLocked}`}>
                                        <span className={styles.featureX}>
                                            <X size={13} strokeWidth={3} />
                                        </span>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <button
                                id={`checkout-${plan.tier}-btn`}
                                className={`btn btn-lg ${plan.color === 'gold' ? 'btn-primary' : styles.btnBlue}`}
                                style={{ width: '100%' }}
                                onClick={() => handleCheckout(plan.tier)}
                                disabled={checkoutState === 'loading'}
                                aria-label={`${plan.cta} for $${plan.price}/month`}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={18} className={styles.spinner} />
                                        Redirecting to Stripe...
                                    </>
                                ) : plan.cta}
                            </button>

                            {/* Subtext */}
                            <p className={styles.cardSubtext}>
                                <Shield size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                                Cancel anytime. No contracts.
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Error state */}
            {checkoutState === 'error' && checkoutError && (
                <div className={styles.errorBanner}>
                    <AlertCircle size={16} />
                    <span>{checkoutError}</span>
                </div>
            )}

            {/* FAQ / Trust signals */}
            <div className={styles.trust}>
                <div className={styles.trustItem}>
                    <Shield size={16} style={{ color: 'var(--accent-green)' }} />
                    <span>Secure payment via Stripe</span>
                </div>
                <div className={styles.trustItem}>
                    <Check size={16} style={{ color: 'var(--accent-green)' }} />
                    <span>Cancel from your settings anytime</span>
                </div>
                <div className={styles.trustItem}>
                    <Zap size={16} style={{ color: 'var(--gold-400)' }} />
                    <span>Instant access after payment</span>
                </div>
            </div>

            {/* Free plan reminder */}
            <p className={styles.freeNote}>
                Want to stay free for now?{' '}
                <Link href="/dashboard" className={styles.freeNoteLink}>
                    Continue with Free plan
                </Link>
            </p>
        </div>
    );
}

export default function UpgradePage() {
    return (
        <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--gold-400)' }} />
            </div>
        }>
            <UpgradePageInner />
        </Suspense>
    );
}
