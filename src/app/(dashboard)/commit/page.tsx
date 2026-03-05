'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { Check, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { ScoreBreakdownPopup } from '@/components/ScoreBreakdownPopup';
import type { StrategyOption } from '@/lib/types';
import styles from './commit.module.css';

/** Pick a hero image based on strategy archetype keywords */
function getStrategyImage(archetype: string): string {
    const a = archetype.toLowerCase();
    if (/launch|start|build|create|mvp|validate|idea|new/.test(a)) return '/images/strategies/strategy-launch.png';
    if (/monetiz|revenue|income|profit|cash|sell|convert|earn/.test(a)) return '/images/strategies/strategy-monetize.png';
    // Default to growth for scaling, expand, grow, etc.
    return '/images/strategies/strategy-growth.png';
}

export default function CommitPage() {
    const [strategy, setStrategy] = useState<StrategyOption | null>(null);
    const [lockedKpi, setLockedKpi] = useState('');
    const [weeklyDeliverable, setWeeklyDeliverable] = useState('');
    const [calendarBlocks, setCalendarBlocks] = useState(6);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    const searchParams = useSearchParams();
    const decisionId = searchParams.get('decision');
    const strategyId = searchParams.get('strategy');
    const supabase = createClient();

    useEffect(() => {
        if (strategyId) loadStrategy();
    }, [strategyId]);

    const loadStrategy = async () => {
        const { data } = await supabase
            .from('strategy_options')
            .select('*')
            .eq('id', strategyId)
            .single();

        if (data) {
            setStrategy(data);
            // Pre-fill suggested KPI
            if (data.kpis && (data.kpis as string[]).length > 0) {
                setLockedKpi((data.kpis as string[])[0]);
            }
        }
    };

    const handleCommit = async () => {
        if (!agreed || !lockedKpi || !weeklyDeliverable) return;
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    decision_id: decisionId,
                    strategy_option_id: strategyId,
                    locked_kpi: lockedKpi,
                    weekly_deliverable: weeklyDeliverable,
                    calendar_blocks: calendarBlocks,
                }),
            });

            if (!res.ok) {
                const body = await res.json();
                throw new Error(body.error || 'Failed to commit');
            }

            router.push('/dashboard');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!strategy) {
        return (
            <div className={styles.loading}>
                <div className="skeleton" style={{ width: '100%', height: '400px' }} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className="heading-lg">Lock Your Strategy</h1>
                <p className="text-secondary">
                    You&apos;re committing to <strong>{strategy.archetype}</strong>. This locks your KPI, deliverable, and calendar blocks.
                </p>
            </header>

            {/* Strategy Visual + Summary */}
            <div className={`card ${styles.summaryCard}`}>
                <div className={styles.heroBanner}>
                    <Image
                        src={getStrategyImage(strategy.archetype)}
                        alt={`${strategy.archetype} strategy visual`}
                        fill
                        className={styles.heroImage}
                        priority
                    />
                    <div className={styles.heroOverlay}>
                        <ScoreBreakdownPopup breakdown={strategy.score_breakdown} totalScore={strategy.decision_score}>
                            <div className={`score-badge score-${strategy.decision_score >= 70 ? 'high' : strategy.decision_score >= 45 ? 'medium' : 'low'}`}>
                                {strategy.decision_score}
                            </div>
                        </ScoreBreakdownPopup>
                    </div>
                </div>
                <div className={styles.summaryContent}>
                    <h2 className={styles.archetype}>{strategy.archetype}</h2>
                    <p className="text-secondary">{strategy.thesis}</p>
                </div>
            </div>

            {/* Contract Form */}
            <div className={`card ${styles.contractCard}`}>
                <h3 className="heading-md" style={{ marginBottom: 'var(--space-6)' }}>
                    <Lock size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Execution Contract
                </h3>

                <div className={styles.fields}>
                    <div>
                        <label className="label">Locked KPI</label>
                        <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }}>
                            The ONE metric you&apos;ll track. Suggested from your strategy:
                        </p>
                        <select
                            className="input"
                            value={lockedKpi}
                            onChange={(e) => setLockedKpi(e.target.value)}
                        >
                            <option value="">Select a KPI...</option>
                            {(strategy.kpis as string[])?.map((kpi) => (
                                <option key={kpi} value={kpi}>{kpi}</option>
                            ))}
                            <option value="custom">Custom...</option>
                        </select>
                        {lockedKpi === 'custom' && (
                            <input
                                className="input"
                                style={{ marginTop: 'var(--space-2)' }}
                                placeholder="Enter your custom KPI..."
                                onChange={(e) => setLockedKpi(e.target.value)}
                            />
                        )}
                    </div>

                    <div>
                        <label className="label">Weekly Deliverable</label>
                        <p className="text-tertiary" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-2)' }}>
                            What you commit to shipping every week.
                        </p>
                        <input
                            className="input"
                            placeholder="e.g. 1 pillar post + 3 repurposed pieces"
                            value={weeklyDeliverable}
                            onChange={(e) => setWeeklyDeliverable(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="label">
                            Calendar Blocks Per Week: <strong>{calendarBlocks}</strong>
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={20}
                            value={calendarBlocks}
                            onChange={(e) => setCalendarBlocks(parseInt(e.target.value))}
                            className={styles.slider}
                        />
                        <div className={styles.sliderLabels}>
                            <span>1 block</span>
                            <span>20 blocks</span>
                        </div>
                    </div>
                </div>

                <div className="divider" />

                {/* Agreement */}
                <label className={styles.agreement}>
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>
                        I understand that the Decision Score is a model-based estimate, not a guarantee.
                        I commit to tracking my locked KPI and shipping my weekly deliverable.
                    </span>
                </label>

                {error && (
                    <div className={styles.error}>
                        <AlertTriangle size={16} />
                        {error}
                    </div>
                )}

                <button
                    className="btn btn-primary btn-lg"
                    style={{ width: '100%', marginTop: 'var(--space-6)' }}
                    disabled={!agreed || !lockedKpi || !weeklyDeliverable || loading}
                    onClick={handleCommit}
                >
                    {loading ? 'Locking Strategy...' : 'Lock Strategy & Generate Ship Pack'}
                    {!loading && <ArrowRight size={18} />}
                </button>
            </div>
        </div>
    );
}
