'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, Lock } from 'lucide-react';
import styles from './offer.module.css';

interface Props {
    termsVersion: string;
    firstChargeDate: string;
    consentText: string;
}

function readUtm(): Record<string, string> | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref']) {
        const v = params.get(key);
        if (v) utm[key] = v.slice(0, 100);
    }
    return Object.keys(utm).length ? utm : null;
}

export function OfferCheckout({ termsVersion, firstChargeDate, consentText }: Props) {
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsRefresh, setNeedsRefresh] = useState(false);

    const start = async () => {
        if (!agreed || loading) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/billing/trial', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    consent: true,
                    termsVersion,
                    shownFirstChargeDate: firstChargeDate,
                    utm: readUtm(),
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                setNeedsRefresh(Boolean(data.refresh));
                throw new Error(data.error || 'Could not start your trial.');
            }
            window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.checkout}>
            <label className={styles.consent}>
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    aria-describedby="consent-text"
                />
                <span id="consent-text">{consentText}</span>
            </label>

            <button
                type="button"
                className={styles.cta}
                onClick={start}
                disabled={!agreed || loading}
                aria-disabled={!agreed || loading}
            >
                {loading ? <Loader2 size={18} className={styles.spin} aria-hidden /> : null}
                {loading ? 'Opening secure checkout…' : 'Start my trial'}
                {!loading && <ArrowRight size={18} aria-hidden />}
            </button>

            {!agreed && !error && (
                <p className={styles.hint}>Tick the box above to continue.</p>
            )}

            {error && (
                <div className={styles.error} role="alert">
                    {error}
                    {needsRefresh && (
                        <button type="button" className={styles.linkButton} onClick={() => window.location.reload()}>
                            Refresh
                        </button>
                    )}
                </div>
            )}

            <p className={styles.secure}>
                <Lock size={13} aria-hidden /> Card details are handled by Stripe. $0.00 is charged today.
            </p>
        </div>
    );
}
