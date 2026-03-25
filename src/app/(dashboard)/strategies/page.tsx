'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GenerationProgress } from '@/components/GenerationProgress';
import { Crown, ArrowRight, AlertTriangle, TrendingUp, Clock, Target, RefreshCcw, Lock } from 'lucide-react';
import { ScoreBreakdownPopup } from '@/components/ScoreBreakdownPopup';
import type { StrategyOption, Decision } from '@/lib/types';
import styles from './strategies.module.css';

function ScoreBadge({ score }: { score: number }) {
    const level = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';
    return (
        <div className={`score-badge score-${level}`}>
            {score}
        </div>
    );
}

function StrategyCard({ strategy, onSelect, isLocked }: { strategy: StrategyOption; onSelect: () => void; isLocked: boolean }) {
    return (
        <div className={`card ${styles.strategyCard} ${isLocked ? styles.lockedCard : ''}`}>
            {isLocked && (
                <div className={styles.lockOverlay}>
                    <div className={styles.lockContent}>
                        <Lock size={28} />
                        <span className={styles.lockLabel}>Premium Strategy</span>
                        <p className={styles.lockText}>Upgrade to unlock this higher-ranked strategy path</p>
                        <a href="/billing" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }}>
                            Upgrade Now <ArrowRight size={14} />
                        </a>
                    </div>
                </div>
            )}

            <div className={styles.cardTop}>
                <div className={styles.rankBadge}>#{strategy.rank}</div>
                <ScoreBreakdownPopup breakdown={strategy.score_breakdown} totalScore={strategy.decision_score}>
                    <ScoreBadge score={strategy.decision_score} />
                </ScoreBreakdownPopup>
            </div>

            <h3 className={styles.archetype}>{strategy.archetype}</h3>
            <p className="text-secondary">{strategy.thesis}</p>

            <div className={styles.meta}>
                <div className={styles.metaItem}>
                    <Target size={14} />
                    <span>{strategy.channel_focus?.join(', ')}</span>
                </div>
                <div className={styles.metaItem}>
                    <TrendingUp size={14} />
                    <span>{strategy.offer_shape}</span>
                </div>
                <div className={styles.metaItem}>
                    <Clock size={14} />
                    <span>{strategy.first_7_day_plan?.reduce((sum: number, d: { time_mins: number }) => sum + d.time_mins, 0)} mins in Week 1</span>
                </div>
            </div>

            <div className={styles.confidence}>
                <span className={`badge badge-${strategy.confidence === 'high' ? 'green' : strategy.confidence === 'medium' ? 'gold' : 'red'}`}>
                    {strategy.confidence} confidence
                </span>
            </div>

            {strategy.risks && strategy.risks.length > 0 && (
                <div className={styles.risks}>
                    <AlertTriangle size={14} className={styles.riskIcon} />
                    <span className="text-tertiary">{(strategy.risks as string[])[0]}</span>
                </div>
            )}

            {!isLocked && (
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 'var(--space-4)' }}
                    onClick={onSelect}
                >
                    Choose This Strategy <ArrowRight size={16} />
                </button>
            )}
        </div>
    );
}

export default function StrategiesPage() {
    const [decision, setDecision] = useState<Decision | null>(null);
    const [strategies, setStrategies] = useState<StrategyOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [jobId, setJobId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [userTier, setUserTier] = useState<string>('free');
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        loadStrategies();
    }, []);

    const loadStrategies = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user tier
        const { data: subData } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (subData?.tier) {
            setUserTier(subData.tier);
        }

        // Check for pending generation job
        const { data: pendingJob } = await supabase
            .from('generation_jobs')
            .select('*')
            .eq('user_id', user.id)
            .eq('job_type', 'strategies')
            .in('status', ['queued', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (pendingJob) {
            // If the job is older than 2 minutes, it's stale — mark it failed
            const jobAge = Date.now() - new Date(pendingJob.created_at).getTime();
            const TWO_MINUTES = 2 * 60 * 1000;

            if (jobAge > TWO_MINUTES) {
                console.warn('[strategies] Stale job detected:', pendingJob.id, `(${Math.round(jobAge / 1000)}s old). Marking as timed_out.`);
                await supabase
                    .from('generation_jobs')
                    .update({
                        status: 'failed',
                        error_message: 'Generation timed out. Please try again.',
                        completed_at: new Date().toISOString(),
                    })
                    .eq('id', pendingJob.id);
                // Fall through to load strategies or show empty state
            } else {
                setJobId(pendingJob.id);
                setGenerating(true);
                setLoading(false);
                return;
            }
        }

        // Load latest decision with strategies
        const { data: latestDecision } = await supabase
            .from('decisions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'ready')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (latestDecision) {
            setDecision(latestDecision);

            const { data: strats } = await supabase
                .from('strategy_options')
                .select('*')
                .eq('decision_id', latestDecision.id)
                .order('rank', { ascending: true });

            setStrategies(strats || []);
        }

        setLoading(false);
    };

    const handleSelect = (strategy: StrategyOption) => {
        router.push(`/commit?decision=${decision?.id}&strategy=${strategy.id}`);
    };

    const isFreeTier = userTier === 'free';

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className="skeleton" style={{ width: '100%', height: '200px' }} />
                <div className="skeleton" style={{ width: '100%', height: '200px' }} />
                <div className="skeleton" style={{ width: '100%', height: '200px' }} />
            </div>
        );
    }

    if (generating && jobId) {
        return (
            <GenerationProgress
                jobId={jobId}
                onComplete={() => {
                    setGenerating(false);
                    setJobId(null);
                    setLoading(true);
                    loadStrategies();
                }}
                title="Generating Your Strategies"
            />
        );
    }

    if (strategies.length === 0) {
        return (
            <div className={styles.empty}>
                <Crown size={48} className={styles.emptyIcon} />
                <h2 className="heading-lg">No strategies yet</h2>
                <p className="text-secondary">Complete the questionnaire to generate your 3 ranked strategy paths.</p>
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'column', alignItems: 'center' }}>
                    <a href="/onboard" className="btn btn-primary btn-lg">Start Questionnaire</a>
                    <button
                        className="btn btn-secondary"
                        disabled={regenerating}
                        onClick={async () => {
                            setRegenerating(true);
                            try {
                                const res = await fetch('/api/strategies/generate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({}),
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    if (data.jobId) {
                                        setJobId(data.jobId);
                                        setGenerating(true);
                                    }
                                }
                            } catch (err) {
                                console.error('Regenerate failed:', err);
                            } finally {
                                setRegenerating(false);
                            }
                        }}
                    >
                        <RefreshCcw size={16} />
                        {regenerating ? 'Starting...' : 'Regenerate Strategies'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className="heading-lg">Your 3 Ranked Strategies</h1>
                <p className="text-secondary">
                    Pick the path that fits your constraints. Each strategy has a transparent Decision Score showing exactly how we scored it.
                </p>
                {isFreeTier && (
                    <div className={styles.upgradeBanner}>
                        <Lock size={16} />
                        <span>You&apos;re on the <strong>Free</strong> plan. Upgrade to unlock all strategies.</span>
                        <a href="/billing" className="btn btn-primary btn-sm">Upgrade</a>
                    </div>
                )}
            </header>

            <div className={styles.grid}>
                {strategies.map((strategy) => (
                    <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onSelect={() => handleSelect(strategy)}
                        isLocked={isFreeTier && strategy.rank <= 2}
                    />
                ))}
            </div>

            <div className="disclaimer" style={{ marginTop: 'var(--space-8)' }}>
                <span>⚠️</span>
                <span>
                    Decision Scores are model-based estimates, not guarantees. Scores reflect pattern matching against your stated inputs
                    and documented assumptions. Results depend on your execution quality and market conditions.
                </span>
            </div>
        </div>
    );
}

