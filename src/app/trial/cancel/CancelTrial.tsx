'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown, Loader2, CheckCircle2 } from 'lucide-react';
import styles from '../../offer/offer.module.css';

function formatAccessDate(unixSeconds?: number | null): string | null {
    if (!unixSeconds) return null;
    // Fixed PST (UTC-8), matching every other billing date we show.
    const wall = new Date(unixSeconds * 1000 - 8 * 3600_000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[wall.getUTCMonth()]} ${wall.getUTCDate()}, ${wall.getUTCFullYear()}`;
}

export function CancelTrial({ token }: { token: string }) {
    const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [message, setMessage] = useState<string | null>(null);
    const [accessUntil, setAccessUntil] = useState<string | null>(null);

    const cancel = async () => {
        setState('loading');
        setMessage(null);
        try {
            const res = await fetch('/api/billing/trial/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not cancel.');
            setAccessUntil(formatAccessDate(data.accessUntil));
            setState('done');
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Could not cancel.');
            setState('error');
        }
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <Link href="/" className={styles.brand}>
                    <span className={styles.logoMark}><Crown size={18} aria-hidden /></span>
                    Billionaire Brother
                </Link>
            </header>
            <main className={styles.main}>
                <div className={styles.summary} style={{ maxWidth: 460, margin: '40px auto', position: 'static' }}>
                    {state === 'done' ? (
                        <div className={styles.checkout} role="status">
                            <h1 className={styles.h2} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle2 size={20} color="var(--gold-400)" aria-hidden /> Your trial is cancelled
                            </h1>
                            <p className={styles.notice}>
                                You won&apos;t be charged. You keep full access
                                {accessUntil ? ` until ${accessUntil}` : ' until your free month ends'}, then your account moves to the free plan.
                            </p>
                            <Link href="/dashboard" className={styles.secondaryCta}>Back to Billionaire Brother</Link>
                        </div>
                    ) : (
                        <div className={styles.checkout}>
                            <h1 className={styles.h2}>Cancel your free trial?</h1>
                            <p className={styles.notice}>
                                You won&apos;t be charged. You keep full access until your free month ends, then move to the free plan.
                                You can subscribe again later from Settings.
                            </p>
                            {!token ? (
                                <p className={styles.error}>This link is incomplete. Sign in and cancel from Settings → Manage Billing.</p>
                            ) : (
                                <button type="button" className={styles.cta} onClick={cancel} disabled={state === 'loading'}>
                                    {state === 'loading' && <Loader2 size={18} className={styles.spin} aria-hidden />}
                                    {state === 'loading' ? 'Cancelling…' : 'Yes, cancel my trial'}
                                </button>
                            )}
                            {message && <div className={styles.error} role="alert">{message}</div>}
                            <Link href="/dashboard" className={styles.hint}>Keep my trial</Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
