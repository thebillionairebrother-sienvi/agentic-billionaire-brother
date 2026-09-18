'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, Mail, ArrowRight, CheckCircle, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import styles from './DerekLeadCapturePopup.module.css';

const DEFAULT_STORE_URL = 'https://chromewebstore.google.com/detail/billionaire-brother-execu/ofaehbeohogfjnfbfjpnceihhnegamnh';

// Excluded routes where popup should never trigger
const EXCLUDED_ROUTES = [
    '/auth',
    '/questionnaire',
    '/billing',
    '/pricing',
    '/dashboard',
    '/admin',
    '/office',
    '/brief',
    '/commit',
    '/board-meeting',
    '/tasks',
    '/data-usage',
    '/delete-account',
    '/privacy',
    '/terms',
    '/refunds',
    '/beta',
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

type TriggerType = 'timer' | 'scroll' | 'exit_intent' | 'force_test';
type VariantType = 'A' | 'B';

interface WindowWithAnalytics extends Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
}

export function DerekLeadCapturePopup() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [variant, setVariant] = useState<VariantType>('A');
    const [isExitIntent, setIsExitIntent] = useState<boolean>(false);
    const [triggerType, setTriggerType] = useState<TriggerType>('timer');

    const [email, setEmail] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [storeUrl, setStoreUrl] = useState<string>(
        process.env.NEXT_PUBLIC_CHROME_STORE_URL || DEFAULT_STORE_URL
    );

    const hasTriggeredRef = useRef<boolean>(false);
    const dwellStartRef = useRef<number>(Date.now());
    const emailInputRef = useRef<HTMLInputElement>(null);

    // ── Zero-PII Analytics Tracker ──
    const trackAnalytics = useCallback((eventName: string, properties: Record<string, unknown> = {}) => {
        try {
            if (typeof window !== 'undefined') {
                const cleanProperties = { ...properties };
                delete cleanProperties.email;
                delete cleanProperties.name;

                const win = window as WindowWithAnalytics;
                if (Array.isArray(win.dataLayer)) {
                    win.dataLayer.push({ event: eventName, ...cleanProperties });
                }

                if (typeof win.gtag === 'function') {
                    win.gtag('event', eventName, cleanProperties);
                }
            }
        } catch {
            // Silently swallow tracking errors
        }
    }, []);

    // ── Check Suppression Rules ──
    const isSuppressed = useCallback(() => {
        if (typeof window === 'undefined') return true;

        // 1. Check permanent subscription
        const subscribed = localStorage.getItem('derek_lead_subscribed');
        if (subscribed === 'true') return true;

        // 2. Check 7-day dismissal cooldown
        const dismissedUntil = localStorage.getItem('derek_lead_dismissed_until');
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
            return true;
        }

        // 3. Check session frequency (1 impression per browser session)
        const shownInSession = sessionStorage.getItem('derek_lead_shown_session');
        if (shownInSession === 'true') return true;

        return false;
    }, []);

    // ── Trigger Popup ──
    const triggerPopup = useCallback((type: TriggerType, forceVariant?: VariantType, forceExit?: boolean) => {
        if (hasTriggeredRef.current) return;
        hasTriggeredRef.current = true;

        const effectiveVariant = forceVariant || variant;
        const effectiveExit = forceExit !== undefined ? forceExit : (type === 'exit_intent');

        setTriggerType(type);
        if (forceVariant) setVariant(forceVariant);
        setIsExitIntent(effectiveExit);
        setIsOpen(true);

        try {
            sessionStorage.setItem('derek_lead_shown_session', 'true');
        } catch {
            // Ignore storage quota errors
        }

        trackAnalytics('derek_popup_viewed', {
            variant: effectiveVariant,
            device_type: isMobile ? 'mobile' : 'desktop',
            trigger_type: type,
            page_path: pathname,
        });

        setTimeout(() => {
            emailInputRef.current?.focus();
        }, 100);
    }, [variant, isMobile, pathname, trackAnalytics]);

    // ── Dismiss Popup ──
    const handleDismiss = useCallback(() => {
        setIsOpen(false);
        try {
            // Suppress for 7 days upon explicit dismissal
            localStorage.setItem('derek_lead_dismissed_until', (Date.now() + SEVEN_DAYS_MS).toString());
        } catch {
            // Ignore storage errors
        }
    }, []);

    // ── Initialize Device, Variant & Trigger Listeners ──
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Route exclusion check
        const isExcludedRoute = EXCLUDED_ROUTES.some((route) =>
            pathname === route || pathname.startsWith(`${route}/`)
        );
        if (isExcludedRoute) return;

        // Device detection
        const mobileCheck = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        setIsMobile(mobileCheck);

        // Variant Assignment: 50/50 split persisted in session
        let assignedVariant: VariantType = 'A';
        const savedVariant = sessionStorage.getItem('derek_popup_variant') as VariantType | null;
        if (savedVariant === 'A' || savedVariant === 'B') {
            assignedVariant = savedVariant;
        } else {
            assignedVariant = Math.random() < 0.5 ? 'A' : 'B';
            try {
                sessionStorage.setItem('derek_popup_variant', assignedVariant);
            } catch {
                // Ignore storage errors
            }
        }
        setVariant(assignedVariant);

        // ── Developer / QA Query Param Overrides ──
        const searchParams = new URLSearchParams(window.location.search);
        const forceTrigger = searchParams.get('derek_popup_force') === 'true';
        const paramVariant = searchParams.get('derek_popup_variant') as VariantType | null;
        const paramState = searchParams.get('derek_popup_state');

        if (forceTrigger) {
            triggerPopup(
                'force_test',
                paramVariant === 'A' || paramVariant === 'B' ? paramVariant : assignedVariant,
                paramState === 'exit'
            );
            if (paramState === 'success') {
                setIsSuccess(true);
            }
            return;
        }

        // Check suppression
        if (isSuppressed()) return;

        dwellStartRef.current = Date.now();

        // 1. Dwell Timer Trigger (Desktop: 40s, Mobile: 50s)
        const timerMs = mobileCheck ? 50000 : 40000;
        const timerId = setTimeout(() => {
            triggerPopup('timer');
        }, timerMs);

        // 2. Scroll Depth Trigger (Desktop: 50%, Mobile: 60%)
        const scrollThreshold = mobileCheck ? 0.6 : 0.5;
        const handleScroll = () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight > 0 && scrollTop / docHeight >= scrollThreshold) {
                triggerPopup('scroll');
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        // 3. Desktop Exit Intent Trigger (after >= 10 seconds dwell time)
        let handleMouseOut: ((e: MouseEvent) => void) | null = null;
        if (!mobileCheck) {
            handleMouseOut = (e: MouseEvent) => {
                const dwellSeconds = (Date.now() - dwellStartRef.current) / 1000;
                if (dwellSeconds >= 10 && e.clientY <= 0) {
                    triggerPopup('exit_intent', undefined, true);
                }
            };
            document.addEventListener('mouseleave', handleMouseOut);
        }

        return () => {
            clearTimeout(timerId);
            window.removeEventListener('scroll', handleScroll);
            if (handleMouseOut) {
                document.removeEventListener('mouseleave', handleMouseOut);
            }
        };
    }, [pathname, isSuppressed, triggerPopup]);

    // ── Form Submission Handler ──
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
            setErrorMessage('Enter a valid email where Derek can send access.');
            return;
        }

        setIsSubmitting(true);
        trackAnalytics('derek_popup_cta_clicked', {
            variant: isExitIntent ? 'exit_intent' : variant,
            page_path: pathname,
        });

        try {
            const searchParams = new URLSearchParams(window.location.search);
            const res = await fetch('/api/leads/voluntary-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: cleanEmail,
                    variant: isExitIntent ? 'exit_intent' : variant,
                    trigger_type: triggerType,
                    device_type: isMobile ? 'mobile' : 'desktop',
                    page_path: pathname,
                    utm_source: searchParams.get('utm_source'),
                    utm_medium: searchParams.get('utm_medium'),
                    utm_campaign: searchParams.get('utm_campaign'),
                    utm_content: searchParams.get('utm_content'),
                    utm_term: searchParams.get('utm_term'),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                const errText = data.error || 'Unable to subscribe. Please try again.';
                setErrorMessage(errText);
                trackAnalytics('derek_lead_failed', {
                    variant: isExitIntent ? 'exit_intent' : variant,
                    error_type: 'server_error',
                });
                setIsSubmitting(false);
                return;
            }

            if (data.storeUrl) {
                setStoreUrl(data.storeUrl);
            }

            // Mark as permanently subscribed in localStorage
            try {
                localStorage.setItem('derek_lead_subscribed', 'true');
            } catch {
                // Ignore storage errors
            }

            trackAnalytics('derek_lead_submitted', {
                variant: isExitIntent ? 'exit_intent' : variant,
                lead_source: 'website_popup',
                campaign_id: 'derek_extension',
            });

            setIsSuccess(true);
        } catch {
            setErrorMessage('Network issue. You can still install Derek directly from the Chrome Web Store.');
            trackAnalytics('derek_lead_failed', {
                variant: isExitIntent ? 'exit_intent' : variant,
                error_type: 'network_error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStoreClick = () => {
        trackAnalytics('derek_store_clicked', {
            variant: isExitIntent ? 'exit_intent' : variant,
            device_type: isMobile ? 'mobile' : 'desktop',
            campaign_id: 'derek_extension',
        });
    };

    if (!isOpen) return null;

    // Determine copy based on state/variant
    let badgeLabel = 'DEREK FOR YOUR BROWSER';
    let headline = 'Your next bad decision wants you to close this.';
    let bodyText = 'Put Derek, your Billionaire Brother, in your web browser extension. Get the blunt second opinion before you spend, hire, pivot, or ship.';
    let buttonText = 'SEND DEREK TO MY BROWSER';
    let dismissText = 'I prefer expensive mistakes';

    if (isMobile) {
        badgeLabel = 'DEREK FOR DESKTOP';
        headline = 'Derek belongs on your desktop.';
        bodyText = 'Chrome extensions install on desktop. Leave your email and Derek will be waiting when you get back to your computer.';
        buttonText = 'SEND THE DESKTOP LINK';
        dismissText = 'I prefer expensive mistakes';
    } else if (isExitIntent) {
        badgeLabel = 'BEFORE YOU LEAVE';
        headline = 'Leaving does not fix the decision.';
        bodyText = 'Install Derek to your browser. Put the move in front of me before it costs you another week.';
        buttonText = "GET DEREK'S VERDICT";
        dismissText = 'I prefer expensive mistakes';
    } else if (variant === 'B') {
        badgeLabel = 'DEREK FOR YOUR BROWSER';
        headline = 'Put your Billionaire Brother in the browser.';
        bodyText = 'Before you burn a week on the wrong move, run it past Derek.';
        buttonText = 'GET DEREK NOW';
        dismissText = 'Maybe later';
    }

    return (
        <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && handleDismiss()}>
            <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="derek-popup-title">
                {/* Accessible Close Button */}
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={handleDismiss}
                    aria-label="Close dialog"
                >
                    <X size={18} />
                </button>

                {!isSuccess ? (
                    <>
                        <div className={styles.badgeContainer}>
                            <span className={styles.productBadge}>
                                <Sparkles size={13} />
                                {badgeLabel}
                            </span>
                        </div>

                        <h2 id="derek-popup-title" className={styles.headline}>
                            {headline}
                        </h2>

                        <p className={styles.bodyText}>
                            {bodyText}
                        </p>

                        <form className={styles.form} onSubmit={handleSubmit} noValidate>
                            {errorMessage && (
                                <div className={styles.errorMessage} role="alert">
                                    {errorMessage}
                                </div>
                            )}

                            <div className={styles.inputGroup}>
                                <label htmlFor="derek-lead-email" className={styles.inputLabel}>
                                    Where should Derek send access?
                                </label>
                                <div className={styles.inputWrapper}>
                                    <Mail size={16} className={styles.inputIcon} />
                                    <input
                                        ref={emailInputRef}
                                        id="derek-lead-email"
                                        type="email"
                                        className={styles.input}
                                        placeholder="you@company.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className={styles.ctaButton}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    'SECURING YOUR SEAT...'
                                ) : (
                                    <>
                                        {buttonText}
                                        <ArrowRight size={17} />
                                    </>
                                )}
                            </button>

                            <p className={styles.microcopy}>
                                <ShieldCheck size={14} />
                                Free to install. No credit card. No motivational speeches.
                            </p>

                            <p className={styles.consentNotice}>
                                By requesting access, you agree to receive Derek for Chrome, business strategy briefs, and assessment reports from The Billionaire Brother. Unsubscribe anytime in 1 click. View our{' '}
                                <a href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.legalLink}>
                                    Privacy Policy
                                </a>.
                            </p>

                            <button
                                type="button"
                                className={styles.dismissButton}
                                onClick={handleDismiss}
                            >
                                {dismissText}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className={styles.successContainer}>
                        <div className={styles.successIconBadge}>
                            <CheckCircle size={28} />
                        </div>

                        <h2 id="derek-popup-title" className={styles.headline}>
                            Good. One less excuse.
                        </h2>

                        <p className={styles.bodyText}>
                            {isMobile
                                ? 'Done. Check your inbox when you are back at your desk. Derek will be waiting.'
                                : 'Your access is ready. Install Derek, then put your next real decision on the table.'}
                        </p>

                        <a
                            href={storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.storeLinkButton}
                            onClick={handleStoreClick}
                        >
                            INSTALL MY BILLIONAIRE BROTHER
                            <ExternalLink size={16} />
                        </a>

                        <button
                            type="button"
                            className={styles.dismissButton}
                            onClick={handleDismiss}
                            style={{ marginTop: '1.25rem' }}
                        >
                            Close this window
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
