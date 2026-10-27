'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Tag, RefreshCw } from 'lucide-react';
import { checkEmailDomainTypo } from '@/lib/auth/email-validation';
import styles from './beta-auth.module.css';

export default function BetaAuthPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#050508' }} />}>
            <BetaAuthPageInner />
        </Suspense>
    );
}

const VALID_BETA_CODES: Record<string, string> = {
    'BILLIONAIREBROTHER2026': 'brother',
    'BILLIONAIRETEAM2026': 'team',
};

function BetaAuthPageInner() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [betaCode, setBetaCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [suggestedEmail, setSuggestedEmail] = useState<string | null>(null);
    const [confirmedTypoEmail, setConfirmedTypoEmail] = useState<string | null>(null);
    const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') || '/dashboard';
    const confirmedParam = searchParams.get('confirmed');
    const errorParam = searchParams.get('error');
    const supabase = createClient();

    // Surface confirmation or callback status from URL query params
    useEffect(() => {
        if (confirmedParam === '1' || confirmedParam === 'true') {
            setMode('login');
            setMessage('Your beta email has been confirmed! Please sign in below to access the Beta Portal.');
        } else if (errorParam === 'callback_failed') {
            setError('Confirmation link expired or was already used. Please sign in below, or request a new confirmation link.');
        }
    }, [confirmedParam, errorParam]);

    // Countdown timer for Resend Confirmation Email button
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

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

    const handleResendConfirmation = async () => {
        const targetEmail = (pendingConfirmEmail || email).trim().toLowerCase();
        if (!targetEmail || resendCooldown > 0 || resending) return;

        setResending(true);
        setError(null);
        try {
            const redirectToUrl = `${window.location.origin}/auth/callback?next=/auth/beta`;
            const { error: resendErr } = await supabase.auth.resend({
                type: 'signup',
                email: targetEmail,
                options: { emailRedirectTo: redirectToUrl },
            });
            if (resendErr) throw resendErr;

            setResendCooldown(60);
            setMessage(`A fresh confirmation link has been sent to ${targetEmail}. Please check your inbox and Spam/Junk folder.`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Failed to resend confirmation email.';
            setError(errMsg);
        } finally {
            setResending(false);
        }
    };

    const handleForgotPassword = async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
            setError('Please enter your email address first, then click Forgot Password.');
            return;
        }
        setResettingPassword(true);
        setError(null);
        setMessage(null);
        try {
            const redirectToUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings')}`;
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: redirectToUrl,
            });
            if (resetErr) throw resetErr;
            setMessage(`Password reset instructions have been sent to ${cleanEmail}. Check your inbox and Spam/Junk folder.`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Failed to send password reset email.';
            setError(errMsg);
        } finally {
            setResettingPassword(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        setSuggestedEmail(null);

        const cleanEmail = email.trim().toLowerCase();

        // Check for common domain typos on signup (e.g. hotmali.com, gmial.com, gamil.com)
        if (mode === 'signup' && confirmedTypoEmail !== cleanEmail) {
            const typoCheck = checkEmailDomainTypo(cleanEmail);
            if (typoCheck.hasTypo && typoCheck.suggestedEmail) {
                setSuggestedEmail(typoCheck.suggestedEmail);
                setConfirmedTypoEmail(cleanEmail);
                setError(
                    `Possible email typo detected ("@${typoCheck.originalDomain}"). Did you mean ${typoCheck.suggestedEmail}? Click the button below to fix it, or click Initialize Beta Port again to proceed anyway.`
                );
                setLoading(false);
                return;
            }
        }

        const attemptAuth = async (retriesLeft: number): Promise<void> => {
            try {
                const trimmedCode = betaCode.toUpperCase().trim();

                // Beta portal ALWAYS requires a valid beta code for sign up
                if (mode === 'signup') {
                    if (!trimmedCode) {
                        setError('Beta access code is required for registration.');
                        setLoading(false);
                        return;
                    }
                    const tier = VALID_BETA_CODES[trimmedCode];
                    if (!tier) {
                        setError('Invalid beta access code. Please check and try again.');
                        setLoading(false);
                        return;
                    }

                    const redirectToUrl = `${window.location.origin}/auth/callback?next=/auth/beta`;
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: cleanEmail,
                        password,
                        options: {
                            emailRedirectTo: redirectToUrl,
                            data: { display_name: displayName, tier, promo_code: trimmedCode },
                        },
                    });
                    if (signUpError) throw signUpError;

                    // Store tier info so we can set it on first login
                    sessionStorage.setItem('pending_promo_code', trimmedCode);
                    sessionStorage.setItem('pending_tier', tier);

                    // Detect silent duplicate signup: when an email is already confirmed in Supabase,
                    // GoTrue returns HTTP 200 with `user.identities = []` and sends NO confirmation email.
                    const isExistingAccount = Boolean(
                        signUpData?.user &&
                        Array.isArray(signUpData.user.identities) &&
                        signUpData.user.identities.length === 0
                    );

                    if (isExistingAccount) {
                        setMode('login');
                        setPendingConfirmEmail(null);
                        setMessage(
                            `An account for ${cleanEmail} already exists! Switched to Beta Access Sign In — enter your password below and your ${trimmedCode} beta code will be applied automatically.`
                        );
                        return;
                    }

                    if (signUpData?.session) {
                        sessionStorage.setItem('beta-tester-mode', 'true');
                        router.push(redirect);
                        router.refresh();
                        return;
                    }

                    setPendingConfirmEmail(cleanEmail);
                    setResendCooldown(60);
                    setMessage(`Beta registration successful! Check your email (${cleanEmail}) for a confirmation link (including your Spam/Junk folder).`);
                } else {
                    // For Login, check if they entered a code
                    let tier = '';
                    if (trimmedCode) {
                        const matched = VALID_BETA_CODES[trimmedCode];
                        if (!matched) {
                            setError('Invalid beta access code. Enter a valid code or leave blank if already registered.');
                            setLoading(false);
                            return;
                        }
                        tier = matched;
                    }

                    const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: cleanEmail,
                        password,
                    });
                    if (signInError) {
                        if (signInError.message.toLowerCase().includes('email not confirmed')) {
                            setPendingConfirmEmail(cleanEmail);
                        }
                        throw signInError;
                    }

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
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setSuggestedEmail(null);
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <div className={styles.fieldLabelRow}>
                                <label className={styles.fieldLabel} htmlFor="password" style={{ marginBottom: 0 }}>
                                    Password
                                </label>
                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        className={styles.inlineLinkBtn}
                                        onClick={handleForgotPassword}
                                        disabled={resettingPassword}
                                    >
                                        {resettingPassword ? 'SENDING...' : 'FORGOT PASSWORD?'}
                                    </button>
                                )}
                            </div>
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

                        {error && (
                            <div className={styles.error}>
                                <div>{error}</div>
                                {suggestedEmail && (
                                    <button
                                        type="button"
                                        className={styles.actionAuxBtn}
                                        onClick={() => {
                                            setEmail(suggestedEmail);
                                            setSuggestedEmail(null);
                                            setConfirmedTypoEmail(null);
                                            setError(null);
                                        }}
                                    >
                                        USE {suggestedEmail.toUpperCase()} →
                                    </button>
                                )}
                            </div>
                        )}

                        {message && (
                            <div className={styles.success}>
                                <div>{message}</div>
                            </div>
                        )}

                        {pendingConfirmEmail && (
                            <button
                                type="button"
                                className={styles.resendBtn}
                                onClick={handleResendConfirmation}
                                disabled={resending || resendCooldown > 0}
                            >
                                <RefreshCw size={13} />
                                {resending
                                    ? 'SENDING CONFIRMATION...'
                                    : resendCooldown > 0
                                        ? `RESEND CONFIRMATION EMAIL (${resendCooldown}S)`
                                        : 'RESEND CONFIRMATION EMAIL'}
                            </button>
                        )}

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
                                setSuggestedEmail(null);
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
