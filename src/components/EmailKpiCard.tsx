'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Eye, MousePointerClick, UserMinus, TrendingUp } from 'lucide-react';
import styles from './EmailKpiCard.module.css';

interface EmailKpiCardProps {
    userId: string;
    lockedKpi: string;
}

interface EmailKpiStats {
    totalSent: number;
    openedCount: number;
    clickedCount: number;
    unsubscribeCount: number;
}

function pct(numerator: number, denominator: number, decimals = 1): string {
    if (denominator === 0) return '—';
    return ((numerator / denominator) * 100).toFixed(decimals) + '%';
}

export function EmailKpiCard({ userId, lockedKpi }: EmailKpiCardProps) {
    const [stats, setStats] = useState<EmailKpiStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchEmailKpis() {
            const supabase = createClient();

            try {
                // Fetch all sends for this user from the shared supabase instance
                const { data: sends, error } = await supabase
                    .from('email_sends')
                    .select('opened, clicked')
                    .eq('user_id', userId);

                if (error) throw error;

                const totalSent = sends?.length ?? 0;
                const openedCount = sends?.filter(s => s.opened).length ?? 0;
                const clickedCount = sends?.filter(s => s.clicked).length ?? 0;

                // Fetch unsubscribes
                const { count: unsubCount } = await supabase
                    .from('suppressions')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('reason', 'unsubscribe');

                setStats({
                    totalSent,
                    openedCount,
                    clickedCount,
                    unsubscribeCount: unsubCount ?? 0,
                });
            } catch (err) {
                console.error('[EmailKpiCard] Failed to fetch email KPIs:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchEmailKpis();
    }, [userId]);

    if (loading) {
        return (
            <div className={`card ${styles.card}`}>
                <div className={styles.header}>
                    <Mail size={16} className={styles.headerIcon} />
                    <span className={styles.headerTitle}>Email KPIs</span>
                </div>
                <div className={styles.skeletonGrid}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`skeleton ${styles.skeletonItem}`} />
                    ))}
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const metrics = [
        {
            icon: <Mail size={18} />,
            label: 'Total Sent',
            value: stats.totalSent.toLocaleString(),
            sub: 'all campaigns',
            colorClass: styles.colorGold,
        },
        {
            icon: <Eye size={18} />,
            label: 'Open Rate',
            value: pct(stats.openedCount, stats.totalSent),
            sub: `${stats.openedCount.toLocaleString()} opens`,
            colorClass: styles.colorBlue,
        },
        {
            icon: <MousePointerClick size={18} />,
            label: 'Click-Through Rate',
            value: pct(stats.clickedCount, stats.totalSent),
            sub: `${stats.clickedCount.toLocaleString()} clicks`,
            colorClass: styles.colorPurple,
        },
        {
            icon: <UserMinus size={18} />,
            label: 'Unsubscribe Rate',
            value: pct(stats.unsubscribeCount, stats.totalSent, 2),
            sub: `${stats.unsubscribeCount.toLocaleString()} total`,
            colorClass: styles.colorRed,
        },
    ];

    return (
        <div className={`card ${styles.card}`}>
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <TrendingUp size={16} className={styles.headerIcon} />
                    <span className={styles.headerTitle}>Email KPIs</span>
                </div>
                <span className={styles.kpiPill}>{lockedKpi}</span>
            </div>

            <div className={styles.grid}>
                {metrics.map(m => (
                    <div key={m.label} className={styles.metric}>
                        <div className={`${styles.metricIcon} ${m.colorClass}`}>
                            {m.icon}
                        </div>
                        <div className={styles.metricBody}>
                            <span className={styles.metricValue}>{m.value}</span>
                            <span className={styles.metricLabel}>{m.label}</span>
                            <span className={styles.metricSub}>{m.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            {stats.totalSent === 0 && (
                <p className={styles.emptyNote}>
                    No emails sent yet. Launch a campaign in the emailer to start tracking.
                </p>
            )}
        </div>
    );
}
