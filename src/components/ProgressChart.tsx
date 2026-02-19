'use client';

import { useEffect, useState } from 'react';
import styles from './ProgressChart.module.css';

interface Stats {
    total: number;
    done: number;
    skipped: number;
    pending: number;
    streak: number;
}

export function ProgressChart() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        fetch('/api/tasks/stats')
            .then((r) => r.json())
            .then((d) => setStats(d))
            .catch(console.error);
    }, []);

    if (!stats) {
        return (
            <div className={`card ${styles.card}`}>
                <div className={styles.skeleton} />
            </div>
        );
    }

    const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (pct / 100) * circumference;

    return (
        <div className={`card ${styles.card}`}>
            <h3 className="heading-sm">Your Progress</h3>

            <div className={styles.chartRow}>
                {/* Donut */}
                <div className={styles.donut}>
                    <svg viewBox="0 0 100 100" className={styles.svg}>
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-tertiary)" strokeWidth="8" />
                        <circle
                            cx="50" cy="50" r="42"
                            fill="none"
                            stroke="url(#gold-grad)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            transform="rotate(-90 50 50)"
                            className={styles.progressRing}
                        />
                        <defs>
                            <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="var(--gold-400)" />
                                <stop offset="100%" stopColor="var(--accent-green)" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className={styles.donutCenter}>
                        <span className={styles.pctNum}>{pct}</span>
                        <span className={styles.pctSign}>%</span>
                    </div>
                </div>

                {/* Stats */}
                <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                        <span className={styles.statNum}>{stats.done}</span>
                        <span className={styles.statLabel}>Done</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNum}>{stats.pending}</span>
                        <span className={styles.statLabel}>Pending</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNum}>{stats.total}</span>
                        <span className={styles.statLabel}>Total</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={`${styles.statNum} ${styles.streakNum}`}>{stats.streak}</span>
                        <span className={styles.statLabel}>🔥 Streak</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
