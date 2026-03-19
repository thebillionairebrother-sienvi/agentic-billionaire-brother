'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, Crown, Tag } from 'lucide-react';
import styles from './auth.module.css';

export default function AuthPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />}>
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
                // Validate promo code client-side first
                const validCodes: Record<string, string> = {
                    'BILLIONAIREBROTHER2026': 'brother',
                    'BILLIONAIRETEAM2026': 'team',
                };
                const tier = validCodes[promoCode.toUpperCase().trim()];
                if (!tier) {
                    setError('Invalid promo code. Please check and try again.');
                    setLoading(false);
                    return;
                }

                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { display_name: displayName, tier, promo_code: promoCode.toUpperCase().trim() },
                    },
                });
                if (error) throw error;

                // Set tier via API (will run after email confirmation when user logs in)
                // For now store the promo code so we can set tier on first login
                sessionStorage.setItem('pending_promo_code', promoCode.toUpperCase().trim());

                setMessage('Check your email for a confirmation link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                // Check if there's a pending promo code from signup
                const pendingPromo = sessionStorage.getItem('pending_promo_code');
                if (pendingPromo) {
                    try {
                        await fetch('/api/auth/set-tier', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ promoCode: pendingPromo }),
                        });
                        sessionStorage.removeItem('pending_promo_code');
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
            <div className={styles.leftPanel}>
                <div className={styles.brandContent}>
                    <div className={styles.logoMark}>
                        <Crown size={32} />
                    </div>
                    <h1 className={styles.brandTitle}>The Billionaire Brother</h1>
                    <p className={styles.brandTagline}>
                        Your business strategist. Built to execute.
                    </p>
                    <div className={styles.features}>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Strategy built by your Brother</span>
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
                </div>
            </div>

            <div className={styles.rightPanel}>
                <div className={styles.formWrapper}>
                    <div className={styles.formHeader}>
                        <h2 className="heading-lg">
                            {mode === 'login' ? 'Welcome back' : 'Get started'}
                        </h2>
                        <p className="text-secondary">
                            {mode === 'login'
                                ? 'Sign in to your account'
                                : 'Create your account to begin'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {mode === 'signup' && (
                            <div className={styles.field}>
                                <label className="label" htmlFor="displayName">
                                    Display Name
                                </label>
                                <div className={styles.inputWrapper}>
                                    <User size={18} className={styles.inputIcon} />
                                    <input
                                        id="displayName"
                                        type="text"
                                        className="input"
                                        style={{ paddingLeft: '2.75rem' }}
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
                                <label className="label" htmlFor="promoCode">
                                    Promo Code
                                </label>
                                <div className={styles.inputWrapper}>
                                    <Tag size={18} className={styles.inputIcon} />
                                    <input
                                        id="promoCode"
                                        type="text"
                                        className="input"
                                        style={{ paddingLeft: '2.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        placeholder="Enter your promo code"
                                        value={promoCode}
                                        onChange={(e) => setPromoCode(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className={styles.field}>
                            <label className="label" htmlFor="email">
                                Email
                            </label>
                            <div className={styles.inputWrapper}>
                                <Mail size={18} className={styles.inputIcon} />
                                <input
                                    id="email"
                                    type="email"
                                    className="input"
                                    style={{ paddingLeft: '2.75rem' }}
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className="label" htmlFor="password">
                                Password
                            </label>
                            <div className={styles.inputWrapper}>
                                <Lock size={18} className={styles.inputIcon} />
                                <input
                                    id="password"
                                    type="password"
                                    className="input"
                                    style={{ paddingLeft: '2.75rem' }}
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
                            type="submit"
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%' }}
                            disabled={loading}
                        >
                            {loading
                                ? 'Loading...'
                                : mode === 'login'
                                    ? 'Sign In'
                                    : 'Create Account'}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className={styles.switchMode}>
                        <span className="text-secondary">
                            {mode === 'login'
                                ? "Don't have an account?"
                                : 'Already have an account?'}
                        </span>
                        <button
                            className="btn btn-ghost"
                            onClick={() => {
                                setMode(mode === 'login' ? 'signup' : 'login');
                                setError(null);
                                setMessage(null);
                            }}
                        >
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
