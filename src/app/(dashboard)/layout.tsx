import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { BetaBanner } from '@/components/BetaBanner';
import { DegradeBanner } from '@/components/DegradeBanner';
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

    // Get user profile
    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    return (
        <>
            <BetaBanner />
            <DegradeBanner />
            <div className={styles.shell}>
                <DashboardSidebar user={profile} />
                <main className={styles.main}>
                    <div className={styles.content}>
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}
