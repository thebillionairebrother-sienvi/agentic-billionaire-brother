'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditCard, User, LogOut, TestTube2, Zap, Tag, DollarSign, TrendingUp, Save, RotateCcw, AlertTriangle, X } from 'lucide-react';

interface UsageStatus {
    tier: string;
    promptsUsed: number;
    promptCap: number;
    promptPct: number;
    costPct: number;
    regensUsed: number;
    regenCap: number;
    isDegradeMode: boolean;
    isHardStop: boolean;
    resetDate: string;
}

interface RevenueData {
    baseline_monthly_revenue: number | null;
    current_monthly_revenue: number | null;
    revenue_platform: string | null;
    revenue_updated_at: string | null;
    current_revenue_range: string | null;
}

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './settings.module.css';

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="skeleton" style={{ width: '100%', height: '300px', marginTop: 'var(--space-8)' }} />}>
            <SettingsInner />
        </Suspense>
    );
}

function SettingsInner() {
    const [userProfile, setUserProfile] = useState<{ display_name: string; email: string; subscription_status: string; tier?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [billingMessage, setBillingMessage] = useState<string | null>(null);
    const [usage, setUsage] = useState<UsageStatus | null>(null);
    const [settingsPromoCode, setSettingsPromoCode] = useState('');
    const [settingsPromoStatus, setSettingsPromoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [settingsPromoMessage, setSettingsPromoMessage] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
    const [revenueCurrentInput, setRevenueCurrentInput] = useState('');
    const [revenuePlatformInput, setRevenuePlatformInput] = useState('');
    const [revenueSaving, setRevenueSaving] = useState(false);
    const [revenueSaved, setRevenueSaved] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resettingAccount, setResettingAccount] = useState(false);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleAccountReset = async () => {
        setResettingAccount(true);
        try {
            const res = await fetch('/api/reset-strategy', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to reset account data');
            try {
                localStorage.removeItem('derek_interview_history');
                localStorage.removeItem('derek_interview_complete');
                localStorage.removeItem('derek_interview_extracted');
                localStorage.removeItem('bb_checklist_pos');
                localStorage.removeItem('bb_checklist_dismissed');
            } catch {
                // ignore
            }
            setToast({ message: 'Account data reset successfully! Redirecting...', type: 'success' });
            setTimeout(() => {
                router.push('/onboard');
                router.refresh();
            }, 800);
        } catch (err) {
            setToast({ message: err instanceof Error ? err.message : 'Reset failed', type: 'error' });
            setResettingAccount(false);
            setShowResetModal(false);
        }
    };

    useEffect(() => {
        loadProfile();
        fetchUsage();
        fetchRevenue();
        // Check for test mode billing redirect
        if (searchParams.get('billing') === 'test') {
            setBillingMessage('Payments are currently disabled while we configure the billing portal. Please check back later or contact support.');
        }
    }, [searchParams]);

    // Dismiss toast automatically after 5 seconds
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const fetchUsage = async () => {
        try {
            const res = await fetch('/api/usage/status');
            if (res.ok) {
                setUsage(await res.json());
            }
        } catch {
            // Silently ignore usage fetch errors
        }
    };

    const fetchRevenue = async () => {
        try {
            const res = await fetch('/api/revenue-tracking');
            if (res.ok) {
                const data = await res.json();
                if (data.revenue) {
                    setRevenueData(data.revenue);
                    setRevenueCurrentInput(data.revenue.current_monthly_revenue?.toString() || '');
                    setRevenuePlatformInput(data.revenue.revenue_platform || '');
                }
            }
        } catch {
            // Silently ignore revenue fetch errors
        }
    };

    const handleRevenueSave = async () => {
        setRevenueSaving(true);
        setRevenueSaved(false);
        try {
            const res = await fetch('/api/revenue-tracking', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_monthly_revenue: revenueCurrentInput ? parseInt(revenueCurrentInput, 10) : null,
                    revenue_platform: revenuePlatformInput || null,
                }),
            });
            if (res.ok) {
                setRevenueSaved(true);
                setTimeout(() => setRevenueSaved(false), 3000);
                await fetchRevenue();
            }
        } catch {
            // ignore
        } finally {
            setRevenueSaving(false);
        }
    };

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
            if (data) setUserProfile(data);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    const handleBillingPortal = async () => {
        if (isTestMode) {
            router.push('/upgrade');
            return;
        }
        const res = await fetch('/api/billing/portal', { method: 'POST' });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    const handleSettingsPromoApply = async () => {
        if (!settingsPromoCode.trim()) return;
        setSettingsPromoStatus('loading');
        setSettingsPromoMessage(null);
        try {
            const res = await fetch('/api/auth/set-tier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promoCode: settingsPromoCode.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setSettingsPromoStatus('error');
                const errMsg = data.error || 'Invalid promo code. Please check and try again.';
                setSettingsPromoMessage(errMsg);
                setToast({ message: errMsg, type: 'error' });
            } else {
                setSettingsPromoStatus('success');
                const successMsg = `🎉 Access unlocked! You're now on the ${data.tier === 'brother' ? 'Brother' : 'Team'} plan.`;
                setSettingsPromoMessage(successMsg);
                setToast({ message: successMsg, type: 'success' });
                // Refresh usage to reflect updated tier
                await fetchUsage();
                await loadProfile();
            }
        } catch {
            setSettingsPromoStatus('error');
            const errMsg = 'Something went wrong. Please try again.';
            setSettingsPromoMessage(errMsg);
            setToast({ message: errMsg, type: 'error' });
        }
    };

    if (loading) {
        return <div className="skeleton" style={{ width: '100%', height: '300px', marginTop: 'var(--space-8)' }} />;
    }

    const isTestMode = !userProfile?.subscription_status || userProfile.subscription_status === 'none';

    return (
        <div className={styles.page}>
            <h1 className="heading-lg" style={{ marginBottom: 'var(--space-8)' }}>Settings</h1>

            <div className={`card ${styles.section}`}>
                <h3 className="heading-md">
                    <User size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Profile
                </h3>
                <div className={styles.row}>
                    <span className="text-secondary">Name</span>
                    <span>{userProfile?.display_name || 'Not set'}</span>
                </div>
                <div className={styles.row}>
                    <span className="text-secondary">Email</span>
                    <span>{userProfile?.email}</span>
                </div>
            </div>

            {/* Revenue Tracking */}
            <div className={`card ${styles.section}`}>
                <h3 className="heading-md">
                    <DollarSign size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> My Revenue
                </h3>
                <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                    Track your monthly revenue so we can measure your growth over time. This data is private and never shared.
                </p>
                {revenueData?.current_revenue_range && (
                    <div className={styles.row}>
                        <span className="text-secondary">Revenue Range (from onboarding)</span>
                        <span className="badge badge-gold">{revenueData.current_revenue_range}</span>
                    </div>
                )}
                {revenueData?.baseline_monthly_revenue != null && (
                    <div className={styles.row}>
                        <span className="text-secondary">Baseline at Signup</span>
                        <span style={{ fontWeight: 600 }}>${revenueData.baseline_monthly_revenue.toLocaleString()}/mo</span>
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <label className="label" htmlFor="settings-revenue-current">
                        <TrendingUp size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                        Current Monthly Revenue (USD)
                    </label>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: 'var(--text-sm)', pointerEvents: 'none' }}>$</span>
                        <input
                            id="settings-revenue-current"
                            type="number"
                            className="input"
                            style={{ paddingLeft: '26px' }}
                            placeholder="e.g. 5000"
                            value={revenueCurrentInput}
                            onChange={(e) => { setRevenueCurrentInput(e.target.value); setRevenueSaved(false); }}
                            min="0"
                            step="100"
                        />
                    </div>
                    <label className="label" htmlFor="settings-revenue-platform">Platform</label>
                    <select
                        id="settings-revenue-platform"
                        className="input"
                        style={{ cursor: 'pointer' }}
                        value={revenuePlatformInput}
                        onChange={(e) => { setRevenuePlatformInput(e.target.value); setRevenueSaved(false); }}
                    >
                        <option value="">Select platform...</option>
                        <option value="stripe">Stripe</option>
                        <option value="paypal">PayPal</option>
                        <option value="gumroad">Gumroad</option>
                        <option value="shopify">Shopify</option>
                        <option value="other">Other</option>
                    </select>
                    <button
                        id="settings-save-revenue-btn"
                        className="btn btn-secondary"
                        onClick={handleRevenueSave}
                        disabled={revenueSaving}
                        style={{ alignSelf: 'flex-start', marginTop: 'var(--space-2)' }}
                    >
                        {revenueSaving ? 'Saving...' : revenueSaved ? (<><Save size={14} /> Saved!</>) : (<><Save size={14} /> Save Revenue</>)}
                    </button>
                    {revenueSaved && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-green)', fontWeight: 600 }}>✓ Revenue updated successfully</p>
                    )}
                </div>
            </div>

            <div className={`card ${styles.section}`}>
                <h3 className="heading-md">
                    <Zap size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> Token Usage & Budget
                </h3>
                {usage ? (
                    <>
                        <div className={styles.row}>
                            <span className="text-secondary">Token Budget Consumed</span>
                            <span style={{ fontWeight: 600, color: usage.isHardStop ? 'var(--red-500)' : usage.isDegradeMode ? 'var(--amber-500)' : 'inherit' }}>
                                {usage.costPct}%
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-border)', borderRadius: '4px', overflow: 'hidden', marginBottom: 'var(--space-2)' }}>
                            <div 
                                style={{ 
                                    height: '100%', 
                                    width: `${Math.min(usage.costPct, 100)}%`,
                                    backgroundColor: usage.isHardStop ? 'var(--red-500)' : usage.isDegradeMode ? 'var(--amber-500)' : 'var(--blue-500)',
                                    transition: 'width 0.3s ease'
                                }} 
                            />
                        </div>
                        <div className={styles.row}>
                            <span className="text-secondary">Prompts Used</span>
                            <span>{usage.promptsUsed} / {usage.promptCap}</span>
                        </div>
                        <div className={styles.row}>
                            <span className="text-secondary">Regenerations Used</span>
                            <span>{usage.regensUsed} / {usage.regenCap}</span>
                        </div>
                        <div className={styles.row}>
                            <span className="text-secondary">Status</span>
                            {usage.isHardStop ? (
                                <span className="badge badge-red">Hard Stop (Paused until {usage.resetDate})</span>
                            ) : usage.isDegradeMode ? (
                                <span className="badge badge-gold">Degraded Mode</span>
                            ) : (
                                <span className="badge badge-green">Healthy</span>
                            )}
                        </div>
                        <div className={styles.row}>
                            <span className="text-secondary">Next Reset</span>
                            <span>{usage.resetDate}</span>
                        </div>
                    </>
                ) : (
                    <div className={styles.row}>
                        <span className="text-secondary">Loading usage data...</span>
                    </div>
                )}
            </div>

            {/* Redesigned Premium Billing Card */}
            <div className={`card ${styles.section}`} style={{
                background: (userProfile?.tier || usage?.tier || 'free') === 'brother' 
                    ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.04) 0%, rgba(234, 179, 8, 0.01) 100%)' 
                    : (userProfile?.tier || usage?.tier || 'free') === 'team'
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.04) 0%, rgba(59, 130, 246, 0.01) 100%)'
                    : 'var(--surface-card)',
                border: (userProfile?.tier || usage?.tier || 'free') === 'brother'
                    ? '1px solid rgba(234, 179, 8, 0.15)'
                    : (userProfile?.tier || usage?.tier || 'free') === 'team'
                    ? '1px solid rgba(59, 130, 246, 0.15)'
                    : '1px solid var(--surface-border)',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Glow decorations for premium tiers */}
                {((userProfile?.tier || usage?.tier || 'free') === 'brother' || (userProfile?.tier || usage?.tier || 'free') === 'team') && (
                    <div style={{
                        position: 'absolute',
                        top: '-50px',
                        right: '-50px',
                        width: '150px',
                        height: '150px',
                        background: (userProfile?.tier || usage?.tier || 'free') === 'brother' ? 'var(--gold-500)' : 'var(--blue-500)',
                        opacity: 0.05,
                        filter: 'blur(40px)',
                        borderRadius: '50%',
                        pointerEvents: 'none'
                    }} />
                )}

                <h3 className="heading-md" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--surface-border)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <CreditCard size={18} />
                    <span>Billing & Membership</span>
                </h3>

                <div className={styles.row}>
                    <span className="text-secondary">Current Plan</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(userProfile?.tier || usage?.tier || 'free') === 'brother' ? (
                            <span style={{
                                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                                color: '#1e1b4b',
                                fontWeight: 700,
                                fontSize: 'var(--text-xs)',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                boxShadow: '0 0 12px rgba(234, 179, 8, 0.15)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                👑 Brother Plan
                            </span>
                        ) : (userProfile?.tier || usage?.tier || 'free') === 'team' ? (
                            <span style={{
                                background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: 'var(--text-xs)',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                boxShadow: '0 0 12px rgba(59, 130, 246, 0.15)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                🚀 Team Plan
                            </span>
                        ) : (
                            <span style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                fontSize: 'var(--text-xs)',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                border: '1px solid var(--surface-border)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}>
                                Free Plan
                            </span>
                        )}
                    </span>
                </div>

                {/* Features list based on tier */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.01)',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    margin: 'var(--space-3) 0 var(--space-4) 0',
                }}>
                    <h4 style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
                        Membership Features
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(userProfile?.tier || usage?.tier || 'free') === 'brother' ? (
                            <>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--gold-400)' }}>✓</span> 40 premium AI prompts per day
                                </li>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--gold-400)' }}>✓</span> Detailed decision analysis matrix
                                </li>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--gold-400)' }}>✓</span> Tailored 7-day action templates
                                </li>
                            </>
                        ) : (userProfile?.tier || usage?.tier || 'free') === 'team' ? (
                            <>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--blue-400)' }}>✓</span> 100 premium AI prompts per day
                                </li>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--blue-400)' }}>✓</span> Multi-project support
                                </li>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--blue-400)' }}>✓</span> Team collaboration tools
                                </li>
                            </>
                        ) : (
                            <>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>•</span> 10 daily prompt limit
                                </li>
                                <li style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: 'var(--text-tertiary)' }}>•</span> Standard business strategies
                                </li>
                            </>
                        )}
                    </ul>
                </div>

                {billingMessage && (
                    <div className="disclaimer" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <TestTube2 size={16} />
                        <span>{billingMessage}</span>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                    <button 
                        className="btn btn-primary"
                        onClick={() => router.push('/upgrade')}
                        style={{
                            background: (userProfile?.tier || usage?.tier || 'free') === 'free' 
                                ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
                                : 'rgba(255, 255, 255, 0.06)',
                            color: (userProfile?.tier || usage?.tier || 'free') === 'free' ? '#1e1b4b' : 'var(--text-primary)',
                            border: (userProfile?.tier || usage?.tier || 'free') === 'free' ? 'none' : '1px solid var(--surface-border)',
                            fontWeight: 700,
                            boxShadow: (userProfile?.tier || usage?.tier || 'free') === 'free' ? '0 4px 14px rgba(234, 179, 8, 0.2)' : 'none',
                        }}
                    >
                        {(userProfile?.tier || usage?.tier || 'free') === 'free' ? 'Upgrade Plan 👑' : 'View Plans / Upgrade'}
                    </button>
                    
                    {!(isTestMode && (userProfile?.tier || usage?.tier || 'free') === 'free') && (
                        <button className="btn btn-secondary" onClick={handleBillingPortal}>
                            {isTestMode ? 'Manage Billing (Test)' : 'Manage Billing'}
                        </button>
                    )}
                </div>
            </div>

            {/* Promo Code — only for free tier users */}
            {(userProfile?.tier || usage?.tier || 'free') === 'free' && settingsPromoStatus !== 'success' && (
                <div className={`card ${styles.section}`}>
                    <h3 className="heading-md">
                        <Tag size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} /> Have a Promo Code?
                    </h3>
                    <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                        Got a code from us? Enter it below to unlock the full Brother experience instantly — no payment required.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
                        <input
                            id="settings-promo-code"
                            type="text"
                            className="input"
                            placeholder="Enter your promo code"
                            value={settingsPromoCode}
                            onChange={(e) => { setSettingsPromoCode(e.target.value); setSettingsPromoStatus('idle'); setSettingsPromoMessage(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSettingsPromoApply()}
                            disabled={settingsPromoStatus === 'loading'}
                            style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 'var(--text-sm)' }}
                            aria-label="Promo code"
                        />
                        <button
                            id="settings-apply-promo-btn"
                            className="btn btn-primary"
                            onClick={handleSettingsPromoApply}
                            disabled={settingsPromoStatus === 'loading' || !settingsPromoCode.trim()}
                            style={{ flexShrink: 0 }}
                        >
                            {settingsPromoStatus === 'loading' ? 'Applying...' : 'Apply'}
                        </button>
                    </div>
                    {settingsPromoMessage && (() => {
                        const isErr = settingsPromoStatus === 'error';
                        return (
                            <p style={{
                                marginTop: 'var(--space-3)',
                                fontSize: 'var(--text-sm)',
                                color: isErr ? '#fca5a5' : 'var(--accent-green)',
                                fontWeight: isErr ? 400 : 600,
                            }}>
                                {settingsPromoMessage}
                            </p>
                        );
                    })()}
                </div>
            )}

            {/* Danger Zone: Reset Account Data */}
            <div className={`card ${styles.section}`} style={{
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.03)',
            }}>
                <h3 className="heading-md" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} /> Danger Zone: Reset Account Data
                </h3>
                <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                    Permanently wipe your current strategy, business profile answers, execution contract, deliverables, and daily tasks. Your account will return to the initial onboarding phase so you can start a fresh interview with Derek.
                </p>
                <button
                    id="settings-reset-account-btn"
                    className="btn btn-danger"
                    onClick={() => setShowResetModal(true)}
                    style={{ alignSelf: 'flex-start' }}
                >
                    <RotateCcw size={15} /> Reset Account Data
                </button>
            </div>

            <div className={`card ${styles.section}`}>
                <button className="btn btn-secondary" onClick={handleSignOut} style={{ color: 'var(--text-secondary)' }}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>

            {/* Account Reset Confirmation Modal */}
            {showResetModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(6px)',
                    }}
                    onClick={() => !resettingAccount && setShowResetModal(false)}
                >
                    <div
                        style={{
                            position: 'relative',
                            background: 'var(--surface-card, #1c1c1c)',
                            border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.1))',
                            borderRadius: 'var(--radius-xl, 16px)',
                            padding: 'var(--space-8, 2rem)',
                            maxWidth: '460px',
                            width: '90vw',
                            textAlign: 'center',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-tertiary, #888)',
                                cursor: 'pointer',
                                padding: '4px',
                            }}
                            onClick={() => setShowResetModal(false)}
                            disabled={resettingAccount}
                        >
                            <X size={18} />
                        </button>

                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            marginBottom: '1rem',
                        }}>
                            <AlertTriangle size={30} />
                        </div>

                        <h2 style={{ fontSize: 'var(--text-xl, 1.25rem)', fontWeight: 700, marginBottom: '0.75rem', color: '#fff' }}>
                            Reset Account Data?
                        </h2>
                        <p style={{ fontSize: 'var(--text-sm, 0.875rem)', color: 'var(--text-secondary, #aaa)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                            This will <strong>permanently delete</strong> all active strategies, business profile data, execution contracts, deliverables, and tasks.
                        </p>
                        <p style={{ fontSize: 'var(--text-xs, 0.75rem)', color: '#ef4444', fontWeight: 600, marginBottom: '1.5rem' }}>
                            You will be redirected to the onboarding interview to restart from scratch.
                        </p>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowResetModal(false)}
                                disabled={resettingAccount}
                            >
                                Cancel
                            </button>
                            <button
                                id="settings-confirm-reset-btn"
                                className="btn btn-danger"
                                onClick={handleAccountReset}
                                disabled={resettingAccount}
                                style={{ fontWeight: 600 }}
                            >
                                {resettingAccount ? 'Resetting...' : 'Yes, Reset Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Slide-in/Fade-in Toast Alert Popup Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: '24px',
                    right: '24px',
                    zIndex: 9999,
                    background: toast.type === 'success' 
                        ? 'rgba(16, 185, 129, 0.15)' 
                        : 'rgba(239, 68, 68, 0.15)',
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4) var(--space-6)',
                    color: toast.type === 'success' ? '#34d399' : '#fca5a5',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    boxShadow: toast.type === 'success' 
                        ? '0 10px 30px rgba(16, 185, 129, 0.25)' 
                        : '0 10px 30px rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
                }}>
                    <span style={{ fontSize: '1.2em' }}>{toast.type === 'success' ? '🚀' : '⚠️'}</span>
                    <span style={{ flex: 1 }}>{toast.message}</span>
                    <button 
                        onClick={() => setToast(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            padding: 'var(--space-1)',
                            marginLeft: 'var(--space-2)',
                            opacity: 0.7,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--text-base)',
                        }}
                    >
                        &times;
                    </button>
                </div>
            )}
        </div>
    );
}
