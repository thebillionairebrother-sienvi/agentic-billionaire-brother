'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { Tier } from '@/lib/ai-config';
import { canAccess, PLAN_FEATURES, getUpgradeTier } from '@/lib/plan-gating';
import type { PlanFeatureKey } from '@/lib/plan-gating';
import styles from './UpgradeGate.module.css';

interface UpgradeGateProps {
    feature: PlanFeatureKey;
    userTier: Tier;
    children: ReactNode;
    /** Optional custom fallback instead of the default upgrade prompt */
    fallback?: ReactNode;
}

/**
 * UpgradeGate — wraps gated content.
 * If the user's tier has access, renders children.
 * Otherwise, renders a locked upgrade prompt.
 * 
 * Usage:
 *   <UpgradeGate feature="shipPack" userTier={tier}>
 *     <ShipPackButton />
 *   </UpgradeGate>
 */
export function UpgradeGate({ feature, userTier, children, fallback }: UpgradeGateProps) {
    if (canAccess(userTier, feature)) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    const upgradeTo = getUpgradeTier(userTier);
    const upgradePlan = upgradeTo ? PLAN_FEATURES[upgradeTo] : null;

    return (
        <div className={styles.gate}>
            <div className={styles.lockIcon}>
                <Lock size={20} />
            </div>
            <div className={styles.content}>
                <p className={styles.title}>
                    {upgradePlan ? `${upgradePlan.label} Feature` : 'Premium Feature'}
                </p>
                <p className={styles.description}>
                    {upgradePlan
                        ? `Upgrade to the ${upgradePlan.label} at $${upgradePlan.monthlyPrice}/mo to unlock this.`
                        : 'This feature requires an upgrade.'}
                </p>
                {upgradeTo && (
                    <Link href={`/upgrade?plan=${upgradeTo}`} className={`btn btn-primary btn-sm ${styles.cta}`}>
                        Upgrade Now
                    </Link>
                )}
            </div>
        </div>
    );
}
