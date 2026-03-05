import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { Target, Clock, TrendingUp, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { ScoreBreakdownPopup } from '@/components/ScoreBreakdownPopup';
import styles from './brief.module.css';

function getStrategyImage(archetype: string): string {
    const a = (archetype || '').toLowerCase();
    if (/launch|start|build|create|mvp|validate|idea|new/.test(a)) return '/images/strategies/strategy-launch.png';
    if (/monetiz|revenue|income|profit|cash|sell|convert|earn/.test(a)) return '/images/strategies/strategy-monetize.png';
    return '/images/strategies/strategy-growth.png';
}

export default async function BriefPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/auth');

    // Get active execution contract with strategy data
    const { data: contract } = await supabase
        .from('execution_contracts')
        .select(`
            *,
            strategy:strategy_options(*)
        `)
        .eq('user_id', user.id)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single();

    const { data: currentCycle } = await supabase
        .from('weekly_cycles')
        .select('*')
        .eq('user_id', user.id)
        .order('week_number', { ascending: false })
        .limit(1)
        .single();

    if (!contract || !contract.strategy) {
        return (
            <div className={styles.page}>
                <div className={styles.emptyState}>
                    <Zap size={48} className={styles.emptyIcon} />
                    <h2 className="heading-lg">No Strategy Locked Yet</h2>
                    <p className="text-secondary">
                        Complete the questionnaire and pick a strategy to see your brief.
                    </p>
                    <a href="/strategies" className="btn btn-primary btn-lg">
                        View Strategies
                    </a>
                </div>
            </div>
        );
    }

    const strategy = contract.strategy;
    const channelFocus = (strategy.channel_focus as string[]) || [];
    const kpis = (strategy.kpis as string[]) || [];
    const risks = (strategy.risks as string[]) || [];
    const phases = (strategy.phases as { name: string; weeks: string; focus: string }[]) || [];
    const firstWeekPlan = (strategy.first_7_day_plan as { day: string; task: string; time_mins: number }[]) || [];

    return (
        <div className={styles.page}>
            {/* Hero Banner */}
            <div className={styles.heroBanner}>
                <Image
                    src={getStrategyImage(strategy.archetype)}
                    alt={`${strategy.archetype} strategy`}
                    fill
                    className={styles.heroImage}
                    priority
                />
                <div className={styles.heroOverlay}>
                    <div className={styles.heroContent}>
                        <span className={styles.heroBadge}>STRATEGY BRIEF</span>
                        <h1 className={styles.heroTitle}>{strategy.archetype}</h1>
                        <p className={styles.heroThesis}>{strategy.thesis}</p>
                    </div>
                    <ScoreBreakdownPopup breakdown={strategy.score_breakdown} totalScore={strategy.decision_score}>
                        <div className={`score-badge score-${strategy.decision_score >= 70 ? 'high' : strategy.decision_score >= 45 ? 'medium' : 'low'} ${styles.heroScore}`}>
                            {strategy.decision_score}
                        </div>
                    </ScoreBreakdownPopup>
                </div>
            </div>

            {/* Contract Info */}
            <div className={styles.contractRow}>
                <div className={styles.contractItem}>
                    <Target size={16} />
                    <div>
                        <span className={styles.itemLabel}>Locked KPI</span>
                        <span className={styles.itemValue}>{contract.locked_kpi}</span>
                    </div>
                </div>
                <div className={styles.contractItem}>
                    <TrendingUp size={16} />
                    <div>
                        <span className={styles.itemLabel}>Weekly Deliverable</span>
                        <span className={styles.itemValue}>{contract.weekly_deliverable}</span>
                    </div>
                </div>
                <div className={styles.contractItem}>
                    <Clock size={16} />
                    <div>
                        <span className={styles.itemLabel}>Current Week</span>
                        <span className={styles.itemValue}>Week {currentCycle?.week_number || 1}</span>
                    </div>
                </div>
            </div>

            <div className={styles.grid}>
                {/* Key Details */}
                <div className={`card ${styles.detailCard}`}>
                    <h3 className="heading-sm">Strategy Details</h3>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Offer Shape</span>
                            <span>{strategy.offer_shape}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Channel Focus</span>
                            <span>{channelFocus.join(', ') || '—'}</span>
                        </div>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Confidence</span>
                            <span className={`badge badge-${strategy.confidence === 'high' ? 'green' : strategy.confidence === 'medium' ? 'gold' : 'red'}`}>
                                {strategy.confidence}
                            </span>
                        </div>
                        <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Calendar Blocks</span>
                            <span>{contract.calendar_blocks}/week</span>
                        </div>
                    </div>

                    {kpis.length > 0 && (
                        <>
                            <h4 className={styles.subHeading}>KPIs</h4>
                            <ul className={styles.kpiList}>
                                {kpis.map((kpi, i) => (
                                    <li key={i}>
                                        <CheckCircle size={14} className={styles.checkIcon} />
                                        {kpi}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>

                {/* Risks */}
                {risks.length > 0 && (
                    <div className={`card ${styles.riskCard}`}>
                        <h3 className="heading-sm">
                            <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Risks
                        </h3>
                        <ul className={styles.riskList}>
                            {risks.map((risk, i) => (
                                <li key={i}>{risk}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Phases */}
                {phases.length > 0 && (
                    <div className={`card ${styles.phasesCard}`}>
                        <h3 className="heading-sm">Execution Phases</h3>
                        <div className={styles.phaseTimeline}>
                            {phases.map((phase, i) => (
                                <div key={i} className={styles.phaseItem}>
                                    <div className={styles.phaseDot} />
                                    <div>
                                        <div className={styles.phaseName}>{phase.name}</div>
                                        <div className={styles.phaseWeeks}>{phase.weeks}</div>
                                        <div className="text-secondary" style={{ fontSize: 'var(--text-sm)' }}>{phase.focus}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* First 7-Day Plan */}
                {firstWeekPlan.length > 0 && (
                    <div className={`card ${styles.weekPlanCard}`}>
                        <h3 className="heading-sm">First 7-Day Plan</h3>
                        <div className={styles.dayList}>
                            {firstWeekPlan.map((day, i) => (
                                <div key={i} className={styles.dayItem}>
                                    <span className={styles.dayLabel}>{day.day}</span>
                                    <span className={styles.dayTask}>{day.task}</span>
                                    <span className={styles.dayTime}>{day.time_mins}m</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="disclaimer" style={{ marginTop: 'var(--space-8)' }}>
                <span>⚠️</span>
                <span>
                    Decision Scores are model-based estimates, not guarantees. Results depend on execution quality and market conditions.
                </span>
            </div>
        </div>
    );
}
