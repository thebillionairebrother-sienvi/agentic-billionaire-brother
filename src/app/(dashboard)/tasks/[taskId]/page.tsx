'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Circle, Clock, Lightbulb, ChevronRight, Sparkles, Download, Bot, Lock, Zap, X, Check, Users } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import styles from './task-detail.module.css';

interface TaskDetail {
    id: string;
    title: string;
    description: string;
    status: string;
    due_date: string;
}

interface ParsedDetail {
    summary: string;
    category: string;
    time_mins: number;
    steps: string[];
    tips: string;
    ai_doable?: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    learn: { label: 'Learn', color: '#60a5fa', emoji: '📚' },
    create: { label: 'Create', color: '#c084fc', emoji: '🎨' },
    outreach: { label: 'Outreach', color: '#fb923c', emoji: '📣' },
    plan: { label: 'Plan', color: '#34d399', emoji: '📋' },
    execute: { label: 'Execute', color: '#fbbf24', emoji: '⚡' },
    review: { label: 'Review', color: '#f472b6', emoji: '🔍' },
};

function parseDescription(desc: string): ParsedDetail {
    try {
        return JSON.parse(desc);
    } catch {
        return { summary: desc, category: 'execute', time_mins: 0, steps: [], tips: '' };
    }
}



export default function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
    const [task, setTask] = useState<TaskDetail | null>(null);
    const [tier, setTier] = useState<string>('free');
    const [loading, setLoading] = useState(true);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [derekWorking, setDerekWorking] = useState(false);
    const [derekOutput, setDerekOutput] = useState<string | null>(null);
    const [derekError, setDerekError] = useState<string | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [promoInput, setPromoInput] = useState('');
    const [promoApplying, setPromoApplying] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [promoSuccess, setPromoSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const load = async () => {
            const { taskId } = await params;
            const res = await fetch(`/api/tasks/${taskId}`);
            if (res.ok) {
                const data = await res.json();
                setTask(data.task);
                setTier(data.tier || 'free');
            }
            setLoading(false);
        };
        load();
    }, [params]);

    const toggleTaskStatus = async () => {
        if (!task) return;
        const newStatus = task.status === 'done' ? 'todo' : 'done';
        setTask({ ...task, status: newStatus });
        await fetch('/api/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: task.id, status: newStatus }),
        });
    };

    const toggleStep = (idx: number) => {
        setCompletedSteps((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const handleDerekDoIt = async () => {
        if (!task) return;
        setDerekWorking(true);
        setDerekError(null);
        setDerekOutput(null);
        try {
            const res = await fetch(`/api/tasks/${task.id}/derek`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!res.ok) {
                setDerekError(data.error || 'Something went wrong');
            } else {
                setDerekOutput(data.output);
                setTask({ ...task, status: 'done' });
            }
        } catch {
            setDerekError('Failed to reach Derek. Try again later.');
        }
        setDerekWorking(false);
    };

    const handleApplyPromo = async () => {
        if (!promoInput.trim()) return;
        setPromoApplying(true);
        setPromoError(null);
        try {
            const res = await fetch('/api/auth/set-tier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promoCode: promoInput.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setPromoError(data.error || 'Invalid promo code. Please check and try again.');
            } else {
                setPromoSuccess(true);
                setTier(data.tier);
                setTimeout(() => {
                    setShowUpgradeModal(false);
                    setPromoSuccess(false);
                    setPromoInput('');
                }, 1500);
            }
        } catch {
            setPromoError('Something went wrong. Please try again.');
        }
        setPromoApplying(false);
    };

    const downloadMarkdown = () => {
        if (!derekOutput || !task) return;
        const blob = new Blob([derekOutput], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} style={{ height: 120 }} />
                <div className={styles.skeleton} style={{ height: 200 }} />
            </div>
        );
    }

    if (!task) {
        return (
            <div className={styles.page}>
                <p>Task not found.</p>
                <button className="btn btn-secondary" onClick={() => router.back()}>Go Back</button>
            </div>
        );
    }

    const detail = parseDescription(task.description);
    const cat = CATEGORY_CONFIG[detail.category] || CATEGORY_CONFIG.execute;
    const stepsTotal = detail.steps.length;
    const stepsDone = completedSteps.size;

    return (
        <div className={styles.page}>
            {/* Back button */}
            <button className={styles.backBtn} onClick={() => router.back()}>
                <ArrowLeft size={18} />
                <span>Back to Tasks</span>
            </button>

            {/* Task header */}
            <div className={styles.header}>
                <div className={styles.categoryBadge} style={{ background: cat.color + '20', color: cat.color }}>
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                </div>
                <h1 className={styles.title}>{task.title}</h1>
                <p className={styles.summary}>{detail.summary}</p>

                <div className={styles.meta}>
                    {detail.time_mins > 0 && (
                        <div className={styles.metaItem}>
                            <Clock size={14} />
                            <span>{detail.time_mins} min</span>
                        </div>
                    )}
                    <div className={styles.metaItem}>
                        <span className={styles.dateBadge}>{task.due_date}</span>
                    </div>
                </div>
            </div>

            {/* Steps */}
            {detail.steps.length > 0 && (
                <div className={styles.stepsCard}>
                    <div className={styles.stepsHeader}>
                        <h2>How to do it</h2>
                        {stepsTotal > 0 && (
                            <span className={styles.stepsProgress}>{stepsDone}/{stepsTotal}</span>
                        )}
                    </div>
                    <ul className={styles.stepsList}>
                        {detail.steps.map((step, i) => (
                            <li
                                key={i}
                                className={`${styles.stepItem} ${completedSteps.has(i) ? styles.stepDone : ''}`}
                                onClick={() => toggleStep(i)}
                            >
                                <div className={styles.stepCheck}>
                                    {completedSteps.has(i) ? (
                                        <CheckCircle size={18} />
                                    ) : (
                                        <Circle size={18} />
                                    )}
                                </div>
                                <span className={styles.stepText}>{step}</span>
                                <ChevronRight size={14} className={styles.stepChevron} />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Tip */}
            {detail.tips && (
                <div className={styles.tipCard}>
                    <Lightbulb size={18} />
                    <div>
                        <strong>Pro Tip</strong>
                        <p>{detail.tips}</p>
                    </div>
                </div>
            )}

            {/* Have Derek Do It */}
            {detail.ai_doable !== false && task.status !== 'done' && !derekOutput && (
                <button
                    className={`${styles.derekBtn} ${tier === 'free' ? styles.derekBtnLocked : ''}`}
                    onClick={tier === 'free' ? () => setShowUpgradeModal(true) : handleDerekDoIt}
                    disabled={derekWorking}
                >
                    {derekWorking ? (
                        <>
                            <Sparkles size={18} className={styles.spinning} />
                            Derek is working on it...
                        </>
                    ) : (
                        <>
                            <Bot size={18} />
                            Have Derek Do It
                            {tier === 'free' && <Lock size={14} className={styles.lockIcon} />}
                        </>
                    )}
                </button>
            )}

            {/* Upgrade Modal */}
            {showUpgradeModal && (
                <div className={styles.modalOverlay} onClick={() => setShowUpgradeModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.modalClose} onClick={() => setShowUpgradeModal(false)}>
                            <X size={18} />
                        </button>

                        <div className={styles.modalHeader}>
                            <div className={styles.modalIcon}>
                                <Zap size={28} />
                            </div>
                            <h2 className={styles.modalTitle}>Unlock Derek&apos;s Full Potential</h2>
                            <p className={styles.modalSubtitle}>
                                Let Derek autonomously complete tasks for you — research, drafts, strategy, and more.
                            </p>
                        </div>

                        <div className={styles.planComparison}>
                            {/* Free Plan */}
                            <div className={styles.planCard}>
                                <div className={styles.planName}>Free</div>
                                <div className={styles.planPrice}><span>$0</span><span className={styles.planPer}>/mo</span></div>
                                <ul className={styles.planFeatures}>
                                    <li className={styles.featureIncluded}><Check size={14} /> Daily task generation</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> Strategy roadmap</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> 10 AI prompts / day</li>
                                    <li className={styles.featureExcluded}><Lock size={14} /> Have Derek Do It</li>
                                    <li className={styles.featureExcluded}><Lock size={14} /> AI deliverables</li>
                                    <li className={styles.featureExcluded}><Lock size={14} /> Team seats</li>
                                </ul>
                            </div>

                            {/* Brother (Pro) Plan */}
                            <div className={`${styles.planCard} ${styles.planCardPro}`}>
                                <div className={styles.planBadge}>Most Popular</div>
                                <div className={styles.planName}>Brother</div>
                                <div className={styles.planPrice}><span>$99.99</span><span className={styles.planPer}>/mo</span></div>
                                <ul className={styles.planFeatures}>
                                    <li className={styles.featureIncluded}><Check size={14} /> Daily task generation</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> Strategy roadmap</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> 40 AI prompts / day</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> Have Derek Do It</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> AI deliverables</li>
                                    <li className={styles.featureExcluded}><Lock size={14} /> Team seats</li>
                                </ul>
                            </div>

                            {/* Team Plan */}
                            <div className={`${styles.planCard} ${styles.planCardTeam}`}>
                                <div className={`${styles.planBadge} ${styles.planBadgeTeam}`}><Users size={10} /> Team</div>
                                <div className={styles.planName}>Team</div>
                                <div className={styles.planPrice}><span>$199</span><span className={styles.planPer}>/mo</span></div>
                                <ul className={styles.planFeatures}>
                                    <li className={styles.featureIncluded}><Check size={14} /> Daily task generation</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> Strategy roadmap</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> 100 AI prompts / day</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> Have Derek Do It</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> AI deliverables</li>
                                    <li className={styles.featureIncluded}><Check size={14} /> Team seats</li>
                                </ul>
                            </div>
                        </div>

                        {/* Promo Code Entry */}
                        <div className={styles.promoSection}>
                            <p className={styles.promoLabel}>
                                Have a promo code? Enter it below to unlock instantly — no payment needed.
                            </p>
                            <div className={styles.promoInputRow}>
                                <input
                                    id="upgrade-promo-code"
                                    type="text"
                                    className={`input ${styles.promoInput}`}
                                    placeholder="e.g. BILLIONAIREBROTHER2026"
                                    value={promoInput}
                                    onChange={(e) => { setPromoInput(e.target.value); setPromoError(null); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                                    style={{ textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}
                                    disabled={promoApplying || promoSuccess}
                                    aria-label="Promo code"
                                />
                                <button
                                    id="upgrade-apply-promo-btn"
                                    className={`btn btn-primary ${styles.promoApplyBtn}`}
                                    onClick={handleApplyPromo}
                                    disabled={promoApplying || promoSuccess || !promoInput.trim()}
                                >
                                    {promoSuccess ? <><Check size={16} /> Unlocked!</> : promoApplying ? 'Applying...' : 'Apply & Unlock'}
                                </button>
                            </div>
                            {promoError && <p className={styles.promoError}>{promoError}</p>}
                            {promoSuccess && <p className={styles.promoSuccessMsg}>🎉 Access unlocked! Redirecting...</p>}
                        </div>

                        <div className={styles.modalDivider}><span>or</span></div>

                        <a href="/settings" className={styles.upgradeBtn}>
                            <Zap size={16} />
                            View Billing Options
                        </a>
                        <p className={styles.modalDisclaimer}>Cancel anytime. No hidden fees.</p>
                    </div>
                </div>
            )}

            {derekError && (
                <div className={styles.derekError}>
                    <span>⚠️</span>
                    <span>{derekError}</span>
                </div>
            )}

            {/* Derek's Output */}
            {derekOutput && (
                <div className={styles.derekOutputCard}>
                    <div className={styles.derekOutputHeader}>
                        <div className={styles.derekOutputTitle}>
                            <Bot size={16} />
                            <span>Derek&apos;s Deliverable</span>
                        </div>
                        <button className={styles.downloadBtn} onClick={downloadMarkdown}>
                            <Download size={14} />
                            Download .md
                        </button>
                    </div>
                    <div className={styles.derekOutputBody}>
                        <ReactMarkdown>{derekOutput}</ReactMarkdown>
                    </div>
                </div>
            )}

            {/* Complete / Undo button */}
            <button
                className={`${styles.completeBtn} ${task.status === 'done' ? styles.undoBtn : ''}`}
                onClick={toggleTaskStatus}
            >
                {task.status === 'done' ? (
                    <>
                        <CheckCircle size={18} />
                        Completed — Tap to Undo
                    </>
                ) : (
                    <>
                        <Circle size={18} />
                        Mark as Done
                    </>
                )}
            </button>
        </div>
    );
}
