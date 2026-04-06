'use client';

import { useEffect, useState } from 'react';
import { Target, Zap, CheckCircle2, TrendingUp, Trophy } from 'lucide-react';
import styles from './UserRealityLayer.module.css';

interface UserMetrics {
    currentStrategy: { thesis: string; archetype: string } | null;
    shipStreak: number;
    sprintCompletionPercentage: number;
    kpiMovement: { previous: string | null; current: string | null; target: string | null };
    revenueEventAchieved: boolean;
}

export function UserRealityLayer() {
    const [metrics, setMetrics] = useState<UserMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/dashboard/user-metrics')
            .then((res) => res.json())
            .then((res) => {
                if (isMounted && res.success) {
                    setMetrics(res.data);
                }
            })
            .catch(console.error)
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, []);

    if (loading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (!metrics) return null;

    return (
        <div className={styles.realityLayer}>
            <div className={styles.layerHeader}>
                <h2 className="heading-summary">Your Performance Layer</h2>
                <div className={styles.revenueBadge} data-achieved={metrics.revenueEventAchieved}>
                    <Trophy size={16} />
                    {metrics.revenueEventAchieved ? 'Revenue Event Achieved' : 'Revenue Event Pending'}
                </div>
            </div>

            <div className={styles.metricsGrid}>
                {/* North Star KPI */}
                <div className={`${styles.metricCard} ${styles.glareCard}`}>
                    <div className={styles.cardIcon}>
                        <Target size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>North Star KPI Movement</span>
                        <div className={styles.kpiFlex}>
                            <div className={styles.kpiCurrent}>
                                {metrics.kpiMovement.current || '0'}
                                <span className={styles.targetLabel}>/ {metrics.kpiMovement.target || 'TBD'}</span>
                            </div>
                            {metrics.kpiMovement.previous && metrics.kpiMovement.current && (
                                <div className={styles.trendUp}>
                                    <TrendingUp size={14} />
                                    <span>Updating</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ship Streak */}
                <div className={`${styles.metricCard} ${styles.streakCard}`}>
                    <div className={styles.streakFlame}>
                        🔥
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.cardLabel}>Current Ship Streak</span>
                        <div className={styles.streakValue}>
                            {metrics.shipStreak} <span className={styles.streakSub}>weeks</span>
                        </div>
                    </div>
                </div>

                {/* Sprint Adherence */}
                <div className={styles.metricCard}>
                    <div className={styles.cardIcon}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <div className={styles.flexBetween}>
                            <span className={styles.cardLabel}>Sprint Adherence</span>
                            <span className={styles.percentageText}>{metrics.sprintCompletionPercentage}%</span>
                        </div>
                        <div className={styles.progressBarBg}>
                            <div 
                                className={styles.progressBarFill} 
                                style={{ width: `${metrics.sprintCompletionPercentage}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
