import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Crown, Plus, Lock, Target, TrendingUp, Calendar } from 'lucide-react';
import { ScoreBreakdownPopup } from '@/components/ScoreBreakdownPopup';
import styles from './office.module.css';

export default async function OfficePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/auth');

    // Fetch user tier
    const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    const userTier = subData?.tier || 'free';
    const isFreeTier = userTier === 'free';

    // Fetch all execution contracts with their strategies and latest cycle
    const { data: contracts } = await supabase
        .from('execution_contracts')
        .select(`
            *,
            strategy:strategy_options(*),
            decision:decisions(*)
        `)
        .eq('user_id', user.id)
        .order('signed_at', { ascending: false });

    // Get the latest cycle for each contract
    const contractsWithCycles = await Promise.all(
        (contracts || []).map(async (contract) => {
            const { data: cycle } = await supabase
                .from('weekly_cycles')
                .select('week_number, status')
                .eq('execution_contract_id', contract.id)
                .order('week_number', { ascending: false })
                .limit(1)
                .single();

            return { ...contract, currentCycle: cycle };
        })
    );

    const canCreateNew = !isFreeTier || contractsWithCycles.length === 0;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className="heading-lg">Your Office</h1>
                    <p className="text-secondary">
                        {contractsWithCycles.length === 0
                            ? 'No active strategies yet. Generate your first one to get started.'
                            : `You have ${contractsWithCycles.length} active strateg${contractsWithCycles.length === 1 ? 'y' : 'ies'}`}
                    </p>
                </div>
                {canCreateNew ? (
                    <Link href="/strategies" className="btn btn-primary">
                        <Plus size={16} /> New Strategy
                    </Link>
                ) : (
                    <div className={styles.upgradeCta}>
                        <Lock size={14} />
                        <span>Upgrade to create multiple strategies</span>
                    </div>
                )}
            </header>

            {contractsWithCycles.length === 0 ? (
                <div className={styles.empty}>
                    <Crown size={48} className={styles.emptyIcon} />
                    <h2 className="heading-md">No strategies yet</h2>
                    <p className="text-secondary">
                        Complete the questionnaire and choose a strategy to begin your journey.
                    </p>
                    <Link href="/onboard" className="btn btn-primary btn-lg">
                        Start Questionnaire
                    </Link>
                </div>
            ) : (
                <div className={styles.grid}>
                    {contractsWithCycles.map((contract, idx) => (
                        <Link
                            key={contract.id}
                            href={`/dashboard?strategy=${contract.id}`}
                            className={`card ${styles.strategyCard}`}
                        >
                            {idx === 0 && (
                                <div className={styles.activeBadge}>Active</div>
                            )}

                            <div className={styles.cardTop}>
                                <div className={styles.rankBadge}>
                                    <Crown size={16} />
                                </div>
                                <ScoreBreakdownPopup breakdown={contract.strategy?.score_breakdown} totalScore={contract.strategy?.decision_score || 0}>
                                    <div className={`score-badge score-${(contract.strategy?.decision_score || 0) >= 70 ? 'high' : (contract.strategy?.decision_score || 0) >= 45 ? 'medium' : 'low'}`}>
                                        {contract.strategy?.decision_score || '—'}
                                    </div>
                                </ScoreBreakdownPopup>
                            </div>

                            <h3 className={styles.archetype}>
                                {contract.strategy?.archetype || 'Strategy'}
                            </h3>
                            <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
                                {contract.strategy?.thesis || ''}
                            </p>

                            <div className={styles.meta}>
                                <div className={styles.metaItem}>
                                    <Target size={14} />
                                    <span>{contract.locked_kpi}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <TrendingUp size={14} />
                                    <span>{contract.weekly_deliverable}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <Calendar size={14} />
                                    <span>
                                        Week {contract.currentCycle?.week_number || 1}
                                        {' · '}
                                        Started {new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.confidence}>
                                <span className={`badge badge-${contract.strategy?.confidence === 'high' ? 'green' : contract.strategy?.confidence === 'medium' ? 'gold' : 'red'}`}>
                                    {contract.strategy?.confidence} confidence
                                </span>
                            </div>
                        </Link>
                    ))}

                    {/* New Strategy Placeholder */}
                    {canCreateNew && (
                        <Link href="/strategies" className={`card ${styles.newCard}`}>
                            <Plus size={32} className={styles.newIcon} />
                            <span className={styles.newLabel}>Start a New Strategy</span>
                            <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)', textAlign: 'center' }}>
                                Run another business idea in parallel
                            </p>
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
