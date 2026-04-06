'use client';

import { useEffect, useState } from 'react';
import {
    DollarSign, UserPlus, UserMinus, Rocket,
    Clock, Cpu, Settings, CheckCircle2, Mail
} from 'lucide-react';
import styles from './ExecutiveMetricsGrid.module.css';

interface ExecutiveMetrics {
    mrr: number;
    newPaidToday: number;
    churnToday: number;
    activationRate: number;
    timeToRevenueAvgDays: number;
    aiCostPerUser: number;
    sprintCompletionPercentage: number;
    grossMargin: number;
    emailToPaidPercentage: number;
}

export function ExecutiveMetricsGrid() {
    const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/admin/metrics')
            .then(res => res.json())
            .then(res => {
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
        <div className={styles.metricsContainer}>
            <h2 className="heading-summary" style={{ marginBottom: '1rem' }}>Executive Dashboard</h2>
            <div className={styles.grid}>
                {/* 1. MRR */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>MRR</span>
                        <div className={styles.value}>${metrics.mrr.toLocaleString()}</div>
                    </div>
                </div>

                {/* 2. New Paid Today */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                        <UserPlus size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>New Paid Today</span>
                        <div className={styles.value}>{metrics.newPaidToday}</div>
                    </div>
                </div>

                {/* 3. Churn Today */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                        <UserMinus size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>Churn Today</span>
                        <div className={styles.value}>{metrics.churnToday}</div>
                    </div>
                </div>

                {/* 4. Activation Rate (7-day) */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                        <Rocket size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>Activation Rate (7d)</span>
                        <div className={styles.value}>{metrics.activationRate}%</div>
                    </div>
                </div>

                {/* 5. Time to Revenue Event (North Star) */}
                <div className={`${styles.card} ${styles.northStarCard}`}>
                    <div className={styles.northStarGlow}></div>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(212, 175, 55, 0.2)', color: '#d4af37' }}>
                        <Clock size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>Avg Time to Revenue</span>
                        <div className={styles.value} style={{ color: '#d4af37' }}>
                            {metrics.timeToRevenueAvgDays} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>days</span>
                        </div>
                    </div>
                </div>

                {/* 6. AI Cost Per User */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                        <Cpu size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>AI Cost Per User</span>
                        <div className={styles.value}>${metrics.aiCostPerUser.toFixed(2)}</div>
                    </div>
                </div>

                {/* 7. Gross Margin */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(34, 211, 238, 0.15)', color: '#22d3ee' }}>
                        <Settings size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>Gross Margin</span>
                        <div className={styles.value}>{metrics.grossMargin}%</div>
                    </div>
                </div>

                {/* 8. Sprint Completion % */}
                <div className={styles.card}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                        <CheckCircle2 size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>Sprint Completion</span>
                        <div className={styles.value}>{metrics.sprintCompletionPercentage}%</div>
                    </div>
                </div>

                {/* 9. Email-to-Paid % (Sienvi) */}
                <div className={styles.card} style={{ opacity: 0.8, borderStyle: 'dashed' }}>
                    <div className={styles.iconWrapper} style={{ background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' }}>
                        <Mail size={20} />
                    </div>
                    <div className={styles.cardContent}>
                        <span className={styles.label}>Email-to-Paid (Sienvi)</span>
                        <div className={styles.value}>{metrics.emailToPaidPercentage}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
