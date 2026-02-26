'use client';

import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { ScoreBreakdown } from '@/lib/types';
import styles from './ScoreBreakdownPopup.module.css';

function formatCategory(category: string): string {
    return category.replace(/_/g, ' ');
}

function scoreLevel(score: number): 'High' | 'Medium' | 'Low' {
    return score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';
}

interface ScoreBreakdownPopupProps {
    breakdown: ScoreBreakdown;
    totalScore: number;
    children: ReactNode;
}

export function ScoreBreakdownPopup({ breakdown, totalScore, children }: ScoreBreakdownPopupProps) {
    const [visible, setVisible] = useState(false);
    const level = scoreLevel(totalScore);

    return (
        <div
            className={styles.wrapper}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}

            {visible && breakdown?.breakdown && (
                <div className={styles.popup}>
                    {/* Header */}
                    <div className={styles.popupHeader}>
                        <span className={styles.popupTitle}>Score Breakdown</span>
                        <span className={`${styles.totalScore} ${styles[`totalScore${level}`]}`}>
                            {totalScore}/100
                        </span>
                    </div>

                    {/* Category rows */}
                    <div className={styles.categories}>
                        {breakdown.breakdown.map((cat) => {
                            const catLevel = scoreLevel(cat.score);
                            return (
                                <div key={cat.category} className={styles.categoryRow}>
                                    <div className={styles.categoryTop}>
                                        <span className={styles.categoryName}>
                                            {formatCategory(cat.category)}
                                        </span>
                                        <span className={styles.categoryWeight}>
                                            ×{(cat.weight * 100).toFixed(0)}%
                                        </span>
                                        <span className={`${styles.categoryScore} ${styles[`categoryScore${catLevel}`]}`}>
                                            {cat.score}
                                        </span>
                                    </div>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={`${styles.barFill} ${styles[`barFill${catLevel}`]}`}
                                            style={{ width: `${cat.score}%` }}
                                        />
                                    </div>
                                    {cat.rationale && (
                                        <div className={styles.rationale}>{cat.rationale}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Disclaimer */}
                    {breakdown.disclaimer && (
                        <div className={styles.disclaimer}>
                            <Info size={10} className={styles.disclaimerIcon} />
                            <span>{breakdown.disclaimer}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
