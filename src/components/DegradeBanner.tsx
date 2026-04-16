'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Flame, Zap } from 'lucide-react';
import styles from './DegradeBanner.module.css';

interface UsageStatus {
    tier: string;
    promptsUsed: number;
    promptCap: number;
    promptPct: number;
    costPct: number;
    regensUsed: number;
    regenCap: number;
    isDegradeMode: boolean;
    isHardStop: boolean;
    resetDate: string;
}

export function DegradeBanner() {
    const [status, setStatus] = useState<UsageStatus | null>(null);
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        const stored = sessionStorage.getItem('degrade-banner-dismissed');
        if (stored === 'true') return;

        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/usage/status');
                if (!res.ok) return;
                const data: UsageStatus = await res.json();

                // Only show if at 80%+ usage
                if (data.isDegradeMode || data.isHardStop) {
                    setStatus(data);
                    setDismissed(false);
                }
            } catch {
                // Silently fail — this is a UI enhancement, not critical
            }
        };

        fetchStatus();
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        sessionStorage.setItem('degrade-banner-dismissed', 'true');
    };

    if (dismissed || !status) return null;

    // Determine severity
    const isHardStop = status.isHardStop;
    const isCritical = status.costPct >= 95 || status.promptPct >= 95;
    const bannerClass = isHardStop
        ? styles.bannerHardStop
        : isCritical
            ? styles.bannerCritical
            : styles.bannerWarning;

    const Icon = isHardStop ? Flame : isCritical ? Zap : AlertTriangle;

    const message = isHardStop
        ? `Sprint budget reached. Responses paused until ${status.resetDate}. Focus on execution.`
        : isCritical
            ? "Sprint budget almost reached. Responses will be simplified."
            : "You're approaching your sprint budget. Focus on execution.";

    return (
        <div className={`${styles.banner} ${bannerClass}`}>
            <Icon size={16} className={styles.icon} />
            <span className={styles.text}>{message}</span>

            {!isHardStop && (
                <button className={styles.closeBtn} onClick={handleDismiss} aria-label="Dismiss usage warning">
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
