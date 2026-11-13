import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DegradeBanner } from '@/components/DegradeBanner';
import { PlanStatusBar, type PlanStatus } from '@/components/PlanStatusBar';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { checkIsAdmin } from '@/lib/auth/admin';
import { formatMoney, formatPst, offerWindowState } from '@/lib/billing/config';
import styles from './dashboard.module.css';

async function resolvePlanStatus(userId: string, tier: string, isAdmin: boolean): Promise<{ status: PlanStatus; label: string }> {
    if (isAdmin) return { status: { kind: 'admin' }, label: 'Admin mode' };

    const admin = await createServiceClient();
    const { data: sub } = await admin
        .from('subscriptions')
        .select('status, tier, trial_end, cancel_at_period_end, stripe_subscription_id')
        .eq('user_id', userId)
        .not('stripe_subscription_id', 'is', null)
        .in('status', ['trialing', 'active', 'past_due'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (sub?.status === 'trialing' && sub.trial_end) {
        const { data: enrollment } = await admin
            .from('trial_enrollments')
            .select('price_amount, currency')
            .eq('stripe_subscription_id', sub.stripe_subscription_id)
            .maybeSingle();
        const end = new Date(sub.trial_end);
        const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));
        return {
            status: {
                kind: 'trial',
                daysLeft,
                endsLabel: formatPst(end, { withTime: false }),
                priceLabel: enrollment ? formatMoney(enrollment.price_amount, enrollment.currency) : '',
                cancelled: Boolean(sub.cancel_at_period_end),
            },
            label: sub.cancel_at_period_end ? 'Trial ending' : 'Brother trial',
        };
    }
    if (sub?.status === 'past_due') return { status: { kind: 'past_due' }, label: 'Payment failed' };

    if (tier === 'brother' || tier === 'team') {
        return { status: { kind: 'plan', tier }, label: tier === 'team' ? 'Team Plan' : 'Brother Plan' };
    }
    return {
        status: { kind: 'free', showOffer: offerWindowState(new Date()) === 'open' },
        label: 'Free Plan',
    };
}

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth');
    }

    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    const isAdmin = await checkIsAdmin();
    const plan = await resolvePlanStatus(user.id, profile?.tier || 'free', isAdmin);

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <PlanStatusBar status={plan.status} />
            <DegradeBanner />
            <div className={styles.shell}>
                <DashboardSidebar user={profile} isAdmin={isAdmin} planLabel={plan.label} />
                <main className={styles.main}>
                    <OnboardingChecklist userId={user.id} />
                    <div className={styles.content}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
