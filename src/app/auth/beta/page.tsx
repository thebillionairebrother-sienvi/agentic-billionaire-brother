'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Tag, Terminal } from 'lucide-react';
import styles from './beta-auth.module.css';

export default function BetaAuthPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050508' }} />}>
            <BetaAuthPageInner />
        </Suspense>
    );
}

function BetaAuthPageInner() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [betaCode, setBetaCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') || '/dashboard';
    const supabase = createClient();

    // Automatically redirect authenticated users to the dashboard
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                router.push('/dashboard');
            }
        };
        checkSession();
    }, [supabase, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        const attemptAuth = async (retriesLeft: number): Promise<void> => {
            try {
                const validCodes: Record<string, string> = {
                    'BILLIONAIREBROTHER2026': 'brother',
                    'BILLIONAIRETEAM2026': 'team',
                };
                const trimmedCode = betaCode.toUpperCase().trim();

                // Beta portal ALWAYS requires a valid beta code for sign up
                if (mode === 'signup') {
                    if (!trimmedCode) {
                        setError('Beta access code is required for registration.');
                        setLoading(false);
                        return;
                    }
                    const tier = validCodes[trimmedCode];
                    if (!tier) {
                        setError('Invalid beta access code. Please check and try again.');
                        setLoading(false);
                        return;
                    }

                    const redirectToUrl = `${window.location.origin}/auth/callback?next=/auth/beta`;
                    const { error } = await supabase.auth.signUp({
                        email,
                        password,
                        options: {
                            emailRedirectTo: redirectToUrl,
                            data: { display_name: displayName, tier, promo_code: trimmedCode },
                        },
                    });
                    if (error) throw error;

                    // Store tier info so we can set it on first login
                    sessionStorage.setItem('pending_promo_code', trimmedCode);
                    sessionStorage.setItem('pending_tier', tier);

                    setMessage('Beta registration successful! Check your email for a confirmation link.');
                } else {
                    // For Login, check if they entered a code
                    let tier = '';
                    if (trimmedCode) {
                        const matched = validCodes[trimmedCode];
                        if (!matched) {
                            setError('Invalid beta access code. Enter a valid code or leave blank if already registered.');
                            setLoading(false);
                            return;
                        }
                        tier = matched;
                    }

                    const { error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });
                    if (error) throw error;

                    // If a valid code was supplied during login, or if we have pending signup info
                    const activePromo = trimmedCode || sessionStorage.getItem('pending_promo_code');
                    const activeTier = tier || sessionStorage.getItem('pending_tier');

                    if (activeTier) {
                        try {
                            await fetch('/api/auth/set-tier', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ promoCode: activePromo || null, tier: activeTier }),
                            });
                            sessionStorage.removeItem('pending_promo_code');
                            sessionStorage.removeItem('pending_tier');
                        } catch {
                            // Non-blocking
                        }
                    }

                    // Set a session flag to force-enable Beta UI mode
                    sessionStorage.setItem('beta-tester-mode', 'true');

                    router.push(redirect);
                    router.refresh();
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'An error occurred';
                const isNetworkError = errMsg.toLowerCase().includes('failed to fetch')
                    || errMsg.toLowerCase().includes('load failed')
                    || errMsg.toLowerCase().includes('networkerror');

                if (isNetworkError && retriesLeft > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return attemptAuth(retriesLeft - 1);
                }

                if (isNetworkError) {
                    setError('Connection issue — please check your internet connection and try again.');
                } else {
                    setError(errMsg);
                }
            }
        };

        await attemptAuth(1);
        setLoading(false);
    };

    return (
        <div className={styles.container}>
            {/* ── Left — Beta Brand panel ── */}
            <div className={styles.leftPanel}>
                <div className={styles.brandContent}>
                    <div className={styles.logoMark}>
                        <ShieldCheck size={26} />
                    </div>

                    <div className={styles.systemChip}>
                        <span className={styles.chipDot} />
                        <span>BETA SECURE SHIELD // ACCESS_STAGE_2026</span>
                    </div>

                    <h1 className={styles.brandTitle}>
                        Billionaire Brother<br />
                        <span>Beta Portal.</span>
                    </h1>
                    <p className={styles.brandTagline}>
                        Welcome to the exclusive environment. As an early beta tester, you have secure access to premium features, testing new automation systems before public launch.
                    </p>

                    <div className={styles.features}>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Exclusive Obsidian & Dynamic Purple UI</span>
                        </div>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Direct Beta Feedback Channel Access</span>
                        </div>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Unlimited Strategy Generations & cycles</span>
                        </div>
                        <div className={styles.featureItem}>
                            <div className={styles.featureDot} />
                            <span>Unreleased feature tests & Derek integrations</span>
                        </div>
                    </div>

                    <p className={styles.leftFooter}>
                        SECURE // © {new Date().getFullYear()} THE BILLIONAIRE BROTHER LABS
                    </p>
                </div>
            </div>

            {/* ── Right — Form panel ── */}
            <div className={styles.rightPanel}>
                <div className={styles.formWrapper}>
                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>
                            {mode === 'login' ? 'Beta Access' : 'Create Beta Account'}
                        </h2>
                        <p className={styles.formSubtitle}>
                            {mode === 'login'
                                ? 'SECURE LOG IN // VERIFY PROTOCOL'
                                : 'ENTER SYSTEM PASSKEY // INITIALIZE'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        {/* Always require or show Promo Code for Beta Login/Signup */}
                        <div className={styles.field}>
                            <label className={styles.fieldLabel} htmlFor="betaCode">
                                Beta Access Code
                                {mode === 'login' && <span className={styles.fieldLabelOptional}>(optional if registered)</span>}
                            </label>
                            <div className={styles.inputWrapper}>
                                <Tag size={16} className={styles.inputIcon} />
                                <input
                                    id="betaCode"
                                    type="text"
                                    className="input"
                                    style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                    placeholder="ENTER CODE"
                                    value={betaCode}
                                    onChange={(e) => setBetaCode(e.target.value)}
                                    required={mode === 'signup'}
                                />
                            </div>
                        </div>

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
                                        placeholder="Beta Tester"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        required
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
                                    placeholder="beta@company.com"
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
                            id="beta-auth-submit-btn"
                            type="submit"
                            className={styles.submitBtn}
                            disabled={loading}
                        >
                            {loading
                                ? 'DECRYPTING...'
                                : mode === 'login'
                                    ? 'SECURE VERIFY'
                                    : 'INITIALIZE BETA PORT'}
                            {!loading && <ArrowRight size={16} />}
                        </button>
                    </form>

                    <div className={styles.switchMode}>
                        <span>
                            {mode === 'login'
                                ? "Register beta access?"
                                : 'Already have beta access?'}
                        </span>
                        <button
                            id="beta-auth-mode-toggle"
                            className={styles.switchModeBtn}
                            onClick={() => {
                                setMode(mode === 'login' ? 'signup' : 'login');
                                setError(null);
                                setMessage(null);
                            }}
                        >
                            {mode === 'login' ? 'INITIALIZE CREDENTIALS →' : 'SECURE SIGN IN →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
