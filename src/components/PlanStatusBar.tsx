import Link from 'next/link';
import { Crown, Users, User, ShieldCheck, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import styles from './PlanStatusBar.module.css';

export type PlanStatus =
    | { kind: 'admin' }
    | { kind: 'trial'; daysLeft: number; endsLabel: string; priceLabel: string; cancelled: boolean }
    | { kind: 'past_due' }
    | { kind: 'plan'; tier: 'brother' | 'team' }
    | { kind: 'free'; showOffer: boolean };

/**
 * One slim bar at the top of the dashboard that always answers
 * "what plan am I on, and what happens next?".
 */
export function PlanStatusBar({ status }: { status: PlanStatus }) {
    switch (status.kind) {
        case 'admin':
            return (
                <div className={`${styles.bar} ${styles.admin}`} role="status">
                    <ShieldCheck size={15} aria-hidden />
                    <span><strong>Admin mode</strong> · full access, not tied to a plan</span>
                </div>
            );

        case 'trial':
            return (
                <div className={`${styles.bar} ${styles.trial}`} role="status">
                    <Clock size={15} aria-hidden />
                    {status.cancelled ? (
                        <span>
                            <strong>Trial cancelled</strong> · full access until {status.endsLabel}, then the free plan. You won&apos;t be charged.
                        </span>
                    ) : (
                        <span>
                            <strong>Free trial · {status.daysLeft} {status.daysLeft === 1 ? 'day' : 'days'} left</strong>
                            <span className={styles.muted}> · first charge {status.priceLabel} on {status.endsLabel}</span>
                        </span>
                    )}
                    <Link href="/settings#billing" className={styles.action}>
                        {status.cancelled ? 'Manage' : 'Manage or cancel'}
                    </Link>
                </div>
            );

        case 'past_due':
            return (
                <div className={`${styles.bar} ${styles.warning}`} role="alert">
                    <AlertTriangle size={15} aria-hidden />
                    <span><strong>Payment failed.</strong> Update your card to keep your plan.</span>
                    <Link href="/settings#billing" className={styles.action}>Update card</Link>
                </div>
            );

        case 'plan':
            return (
                <div className={`${styles.bar} ${styles.plan}`} role="status">
                    {status.tier === 'team' ? <Users size={15} aria-hidden /> : <Crown size={15} aria-hidden />}
                    <span>You&apos;re on the <strong>{status.tier === 'team' ? 'Team' : 'Brother'} Plan</strong></span>
                </div>
            );

        case 'free':
            return (
                <div className={`${styles.bar} ${styles.free}`} role="status">
                    {status.showOffer ? <Sparkles size={15} aria-hidden /> : <User size={15} aria-hidden />}
                    {status.showOffer ? (
                        <>
                            <span><strong>Black Friday:</strong> try the Brother Plan free for one month.</span>
                            <Link href="/offer" className={styles.action}>See the offer</Link>
                        </>
                    ) : (
                        <>
                            <span>You&apos;re on the <strong>Free Plan</strong></span>
                            <Link href="/upgrade" className={styles.action}>Upgrade</Link>
                        </>
                    )}
                </div>
            );
    }
}
