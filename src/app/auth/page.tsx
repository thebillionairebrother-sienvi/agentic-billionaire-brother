'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, Crown, Tag } from 'lucide-react';
import styles from './auth.module.css';

export default function AuthPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#131313' }} />}>
            <AuthPageInner />
        </Suspense>
    );
}

function AuthPageInner() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [promoCode, setPromoCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') || '/dashboard';
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'signup') {
                // Validate promo code if provided (optional field)
                const validCodes: Record<string, string> = {
                    'BILLIONAIREBROTHER2026': 'brother',
                    'BILLIONAIRETEAM2026': 'team',
                };
                const trimmedPromo = promoCode.toUpperCase().trim();
                let tier = 'free';

                if (trimmedPromo) {
                    const matchedTier = validCodes[trimmedPromo];
                    if (!matchedTier) {
                        setError('Invalid promo code. Please check and try again.');
                        setLoading(false);
                        return;
                    }
                    tier = matchedTier;
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { display_name: displayName, tier, promo_code: trimmedPromo || null },
                    },
                });
                if (error) throw error;

                // Store tier info so we can set it on first login
                if (trimmedPromo) {
                    sessionStorage.setItem('pending_promo_code', trimmedPromo);
                }
                sessionStorage.setItem('pending_tier', tier);

                setMessage('Check your email for a confirmation link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                // Check if there's a pending tier from signup
                const pendingPromo = sessionStorage.getItem('pending_promo_code');
                const pendingTier = sessionStorage.getItem('pending_tier');
                if (pendingTier) {
                    try {
                        await fetch('/api/auth/set-tier', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ promoCode: pendingPromo || null, tier: pendingTier }),
                        });
                        sessionStorage.removeItem('pending_promo_code');
                        sessionStorage.removeItem('pending_tier');
                    } catch {
                        // Non-blocking — tier can be set later
                    }
                }

                router.push(redirect);
                router.refresh();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>

            {/* ── Left — Brand panel ── */}
            <div className={styles.leftPanel}>
                <div className={styles.brandContent}>
                    <div className={styles.logoMark}>
                        <Crown size={24} />
                    </div>

                    <div className={styles.systemChip}>
                        <span className={styles.chipDot} />
                        <span>SYSTEM ONLINE // DEREK_V2.0</span>
                    </div>

                    <h1 className={styles.brandTitle}>
                        The Billionaire<br />
                        <span>Brother.</span>
                    </h1>
                    <p className={styles.brandTagline}>
                        Your business strategist. Built to execute.<br />
                        No fluff. Just metrics and relentless action.
                    </p>

                    <div className={styles.features}>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Strategy built by your Brother Derek</span>
                        </div>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Decision Scores with transparent reasoning</span>
                        </div>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Weekly Action Steps with actionable tasks</span>
                        </div>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Weekly check-ins that keep you honest</span>
                        </div>
                    </div>

                    <p className={styles.leftFooter}>
                        © {new Date().getFullYear()} THE BILLIONAIRE BROTHER
                    </p>
                </div>
            </div>

            {/* ── Right — Form panel ── */}
            <div className={styles.rightPanel}>
                <div className={styles.formWrapper}>
                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>
                            {mode === 'login' ? 'Access Terminal' : 'Initialize Account'}
                        </h2>
                        <p className={styles.formSubtitle}>
                            {mode === 'login'
                                ? 'AUTHENTICATE // DEREK SYSTEM'
                                : 'CREATE CREDENTIALS // BEGIN PROTOCOL'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>

                        {mode === 'signup' && (
                            <div className={styles.field}>
                                <label className={styles.fieldLabel} htmlFor="displayName">
                                    Display Name
                                </label>
                                <div className={styles.inputWrapper}>
                                    <User size={16} className={styles.inputIcon} />
                                    <input
                                        id="displayName"
                                        type="text"
                                        className="input"
                                        placeholder="Derek Junior"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {mode === 'signup' && (
                            <div className={styles.field}>
                                <label className={styles.fieldLabel} htmlFor="promoCode">
                                    Promo Code
                                    <span className={styles.fieldLabelOptional}>(optional)</span>
                                </label>
                                <div className={styles.inputWrapper}>
                                    <Tag size={16} className={styles.inputIcon} />
                                    <input
                                        id="promoCode"
                                        type="text"
                                        className="input"
                                        style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                        placeholder="ENTER CODE"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="email">
                                Email Address
                            </label>
                            <div className={styles.inputWrapper}>
                                <Mail size={16} className={styles.inputIcon} />
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="password">
                                Password
                            </label>
                            <div className={styles.inputWrapper}>
                                <Lock size={16} className={styles.inputIcon} />
                                <input
                                    id="password"
                                    type="password"
                                    className="input"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}
                        {message && <div className={styles.success}>{message}</div>}

                        <button
                            id="auth-submit-btn"
                            type="submit"
                            className={styles.submitBtn}
                            disabled={loading}
                        >
                            {loading
                                ? 'CONNECTING...'
                                : mode === 'login'
                                    ? 'ACCESS SYSTEM'
                                    : 'INITIALIZE ACCOUNT'}
                            {!loading && <ArrowRight size={16} />}
                        </button>
                    </form>

                    <div className={styles.switchMode}>
                        <span>
                            {mode === 'login'
                                ? "No account yet?"
                                : 'Already registered?'}
                        </span>
                        <button
                            id="auth-mode-toggle"
                            className={styles.switchModeBtn}
                            onClick={() => {
                                setMode(mode === 'login' ? 'signup' : 'login');
                                setError(null);
                                setMessage(null);
                            }}
                        >
                            {mode === 'login' ? 'CREATE ACCOUNT →' : 'SIGN IN →'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
