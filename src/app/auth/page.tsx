'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, Crown, Tag, RefreshCw } from 'lucide-react';
import { checkEmailDomainTypo } from '@/lib/auth/email-validation';
import styles from './auth.module.css';

export default function AuthPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#131313' }} />}>
            <AuthPageInner />
        </Suspense>
    );
}

const VALID_PROMO_CODES: Record<string, string> = {
    'BILLIONAIREBROTHER2026': 'brother',
    'BILLIONAIRETEAM2026': 'team',
};

function AuthPageInner() {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [promoCode, setPromoCode] = useState('');
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
    // NOTE: createBrowserClient is designed to be called once per component mount
    const supabase = createClient();

    // Surface confirmation or callback status from URL query params
    useEffect(() => {
        if (confirmedParam === '1' || confirmedParam === 'true') {
            setMode('login');
            setMessage('Your email has been confirmed! Please sign in below to access your account.');
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
                router.push(redirect);
            }
        };
        checkSession();
    }, [supabase, router, redirect]);

    const handleResendConfirmation = async () => {
        const targetEmail = (pendingConfirmEmail || email).trim().toLowerCase();
        if (!targetEmail || resendCooldown > 0 || resending) return;

        setResending(true);
        setError(null);
        try {
            const redirectToUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`;
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
                    `Possible email typo detected ("@${typoCheck.originalDomain}"). Did you mean ${typoCheck.suggestedEmail}? Click the button below to fix it, or click Initialize Account again to proceed anyway.`
                );
                setLoading(false);
                return;
            }
        }

        const attemptAuth = async (retriesLeft: number): Promise<void> => {
            try {
                const trimmedPromo = promoCode.toUpperCase().trim();

                if (mode === 'signup') {
                    // Validate promo code if provided (optional field)
                    let tier = 'free';

                    if (trimmedPromo) {
                        const matchedTier = VALID_PROMO_CODES[trimmedPromo];
                        if (!matchedTier) {
                            setError('Invalid promo code. Please check and try again.');
                            setLoading(false);
                            return;
                        }
                        tier = matchedTier;
                    }

                    const redirectToUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`;
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: cleanEmail,
                        password,
                        options: {
                            emailRedirectTo: redirectToUrl,
                            data: { display_name: displayName, tier, promo_code: trimmedPromo || null },
                        },
                    });
                    if (signUpError) throw signUpError;

                    // Store tier info so we can set it on first login
                    if (trimmedPromo) {
                        sessionStorage.setItem('pending_promo_code', trimmedPromo);
                    }
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
                            trimmedPromo
                                ? `An account for ${cleanEmail} already exists! Switched to Sign In — enter your password below and your ${trimmedPromo} code will be applied automatically.`
                                : `An account for ${cleanEmail} already exists! Switched to Sign In — please enter your password below (or use Forgot Password).`
                        );
                        return;
                    }

                    // If auto-confirmed or session immediately returned
                    if (signUpData?.session) {
                        router.push(redirect);
                        router.refresh();
                        return;
                    }

                    setPendingConfirmEmail(cleanEmail);
                    setResendCooldown(60);
                    setMessage(`Check your email (${cleanEmail}) for a confirmation link! Please also check your Spam or Junk folder.`);
                } else {
                    // Validate promo code if entered during login
                    let loginTier = '';
                    if (trimmedPromo) {
                        const matchedTier = VALID_PROMO_CODES[trimmedPromo];
                        if (!matchedTier) {
                            setError('Invalid promo code. Enter a valid code or leave blank.');
                            setLoading(false);
                            return;
                        }
                        loginTier = matchedTier;
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

                    // Apply promo/tier if supplied during login or queued from signup
                    const activePromo = trimmedPromo || sessionStorage.getItem('pending_promo_code');
                    const activeTier = loginTier || sessionStorage.getItem('pending_tier');
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
                            // Non-blocking — tier can be set later
                        }
                    }

                    router.push(redirect);
                    router.refresh();
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'An error occurred';
                const lower = errMsg.toLowerCase();
                const isTransientError = lower.includes('failed to fetch')
                    || lower.includes('load failed')
                    || lower.includes('networkerror')
                    || lower.includes('504')
                    || lower.includes('522')
                    || lower.includes('502')
                    || lower.includes('gateway time')
                    || lower.includes('timed out')
                    || lower.includes('<!doctype');

                // Auto-retry for transient network/gateway errors
                if (isTransientError && retriesLeft > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    return attemptAuth(retriesLeft - 1);
                }

                if (isTransientError) {
                    setError('Authentication server is temporarily busy (Gateway Timeout). Please wait a few seconds and click Sign In again.');
                } else {
                    setError(errMsg);
                }
            }
        };

        await attemptAuth(2);
        setLoading(false);
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

                        {(mode === 'signup' || promoCode.trim().length > 0) && (
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
                                setSuggestedEmail(null);
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
