'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CreditCard, User, LogOut, TestTube2 } from 'lucide-react';
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
    const [userProfile, setUserProfile] = useState<{ display_name: string; email: string; subscription_status: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [billingMessage, setBillingMessage] = useState<string | null>(null);
    const supabase = createClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        loadProfile();
        // Check for test mode billing redirect
        if (searchParams.get('billing') === 'test') {
            setBillingMessage('Stripe is in test mode — billing portal is disabled. Configure STRIPE_SECRET_KEY to enable.');
        }
    }, []);

    const loadProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (data) setUserProfile(data);
        setLoading(false);
    };

    const handleBillingPortal = async () => {
        const res = await fetch('/api/billing/portal', { method: 'POST' });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
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

            <div className={`card ${styles.section}`}>
                <h3 className="heading-md">
                    <CreditCard size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Billing
                </h3>
                <div className={styles.row}>
                    <span className="text-secondary">Status</span>
                    {isTestMode ? (
                        <span className="badge badge-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <TestTube2 size={12} /> Test Mode (Active)
                        </span>
                    ) : (
                        <span className={`badge ${userProfile?.subscription_status === 'active' ? 'badge-green' : 'badge-gold'}`}>
                            {userProfile?.subscription_status}
                        </span>
                    )}
                </div>
                <div className={styles.row}>
                    <span className="text-secondary">Plan</span>
                    <span>{isTestMode ? 'Founder (Test) — Free' : 'Founder — $79/mo'}</span>
                </div>

                {billingMessage && (
                    <div className="disclaimer" style={{ marginTop: 'var(--space-4)' }}>
                        <TestTube2 size={16} />
                        <span>{billingMessage}</span>
                    </div>
                )}

                <button className="btn btn-secondary" onClick={handleBillingPortal} style={{ marginTop: 'var(--space-4)' }}>
                    {isTestMode ? 'Manage Billing (Test Mode)' : 'Manage Billing'}
                </button>
            </div>

            <div className={`card ${styles.section}`}>
                <button className="btn btn-danger" onClick={handleSignOut}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </div>
    );
}
