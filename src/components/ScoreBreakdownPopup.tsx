'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { createPortal } from 'react-dom';
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
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const level = scoreLevel(totalScore);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        // Position below the trigger, centered horizontally
        setPosition({
            top: rect.bottom + 12,
            left: rect.left + rect.width / 2,
        });
    }, []);

    useEffect(() => {
        if (!visible) return;
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [visible, updatePosition]);

    // Adjust if popup overflows right edge
    useEffect(() => {
        if (!visible || !popupRef.current || !position) return;
        const popup = popupRef.current;
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        if (popupRect.right > viewportWidth - 16) {
            setPosition(prev => prev ? { ...prev, left: prev.left - (popupRect.right - viewportWidth + 16) } : prev);
        }
        if (popupRect.left < 16) {
            setPosition(prev => prev ? { ...prev, left: prev.left + (16 - popupRect.left) } : prev);
        }
    }, [visible, position]);

    const popupContent = visible && breakdown?.breakdown && position ? (
        <div
            ref={popupRef}
            className={styles.popup}
            style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                transform: 'translateX(-50%)',
            }}
        >
            {/* Arrow */}
            <div className={styles.arrow} />

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
    ) : null;

    return (
        <>
            <div
                ref={triggerRef}
                className={styles.wrapper}
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
            >
                {children}
            </div>
            {popupContent && createPortal(popupContent, document.body)}
        </>
    );
}
