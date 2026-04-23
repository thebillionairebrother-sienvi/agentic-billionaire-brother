import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { BetaBanner } from '@/components/BetaBanner';
import { DegradeBanner } from '@/components/DegradeBanner';
import { TierBanner } from '@/components/TierBanner';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { checkIsAdmin } from '@/lib/auth/admin';
import styles from './dashboard.module.css';

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

    return (
        <>
            <TierBanner tier={profile?.tier || 'free'} />
            <BetaBanner />
            <DegradeBanner />
            <div className={styles.shell}>
                <DashboardSidebar user={profile} isAdmin={isAdmin} />
                <main className={styles.main}>
                    <OnboardingChecklist userId={user.id} />
                    <div className={styles.content}>
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}
