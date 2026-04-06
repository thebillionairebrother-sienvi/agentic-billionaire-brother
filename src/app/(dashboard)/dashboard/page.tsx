import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ProgressChart } from '@/components/ProgressChart';
import { ResetStrategyButton } from '@/components/ResetStrategyButton';
import { JourneyCalendar } from '@/components/JourneyCalendar';
import { StrategyGantt } from '@/components/StrategyGantt';
import { UserRealityLayer } from '@/components/dashboard/UserRealityLayer';
import { Briefcase } from 'lucide-react';
import styles from './page.module.css';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ strategy?: string }>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/auth');

    // Check onboarding status
    const { data: profile } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();

    if (profile && !profile.onboarding_complete) {
        redirect('/onboard');
    }

    const params = await searchParams;
    const strategyParam = params.strategy;

    // Get execution contract — specific one if param provided, or latest
    let contractQuery = supabase
        .from('execution_contracts')
        .select(`
      *,
      strategy:strategy_options(*),
      decision:decisions(*)
    `)
        .eq('user_id', user.id);

    if (strategyParam) {
        contractQuery = contractQuery.eq('id', strategyParam);
    } else {
        contractQuery = contractQuery.order('signed_at', { ascending: false }).limit(1);
    }

    const { data: contract } = await contractQuery.single();

    // Get total contracts count
    const { count: totalContracts } = await supabase
        .from('execution_contracts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

    const { data: currentCycle } = await supabase
        .from('weekly_cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('execution_contract_id', contract?.id || '')
        .order('week_number', { ascending: false })
        .limit(1)
        .single();

    const hasStrategy = !!contract;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className="heading-lg">Dashboard</h1>
                    <p className="text-secondary">
                        {hasStrategy
                            ? `Week ${currentCycle?.week_number || 1} — ${contract?.strategy?.archetype}`
                            : 'Welcome to The Billionaire Brother'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {(totalContracts || 0) > 1 && (
                        <Link href="/office" className="btn btn-ghost btn-sm">
                            <Briefcase size={14} /> Switch Strategy
                        </Link>
                    )}
                    {currentCycle && (
                        <div className={styles.weekBadge}>
                            <span>Week {currentCycle.week_number}</span>
                        </div>
                    )}
                </div>
            </header>

            {!hasStrategy ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🚀</div>
                    <h2 className="heading-md">Ready to build your strategy?</h2>
                    <p className="text-secondary">
                        Complete the questionnaire so your Billionaire Brother can generate 3 ranked strategy paths for your business.
                    </p>
                    <a href="/onboard" className="btn btn-primary btn-lg">
                        Start Questionnaire
                    </a>
                </div>
            ) : (
                <>
                    <UserRealityLayer />
                    <div className={styles.grid}>
                        {/* Strategy Overview — full width */}
                    <div className={`card ${styles.strategyCard}`}>
                        <div className={styles.cardHeader}>
                            <h3 className="heading-sm">Active Strategy</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <span className="badge badge-gold">
                                    {contract?.strategy?.confidence} confidence
                                </span>
                                <ResetStrategyButton />
                            </div>
                        </div>
                        <h2 className={styles.archetype}>{contract?.strategy?.archetype}</h2>
                        <p className="text-secondary" style={{ marginTop: '0.5rem' }}>
                            {contract?.strategy?.thesis}
                        </p>
                        <div className={styles.kpiRow}>
                            <div>
                                <span className={styles.kpiLabel}>Locked KPI</span>
                                <span className={styles.kpiValue}>{contract?.locked_kpi}</span>
                            </div>
                            <div>
                                <span className={styles.kpiLabel}>Weekly Deliverable</span>
                                <span className={styles.kpiValue}>{contract?.weekly_deliverable}</span>
                            </div>
                        </div>
                    </div>

                    {/* Strategy Gantt Chart — full width */}
                    <StrategyGantt
                        phases={contract?.strategy?.phases}
                        currentWeek={currentCycle?.week_number || 1}
                    />

                    {/* Progress Chart */}
                    <ProgressChart />

                    {/* Journey Calendar */}
                    <JourneyCalendar />
                </div>
                </>
            )}

            <div className="disclaimer" style={{ marginTop: 'var(--space-8)' }}>
                <span>⚠️</span>
                <span>
                    Decision Scores are model-based estimates, not guarantees. Results depend on execution quality and market conditions.
                </span>
            </div>
        </div>
    );
}

