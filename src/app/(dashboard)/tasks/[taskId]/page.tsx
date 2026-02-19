'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, Circle, Clock, Lightbulb, ChevronRight } from 'lucide-react';
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
    const [loading, setLoading] = useState(true);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const router = useRouter();

    useEffect(() => {
        const load = async () => {
            const { taskId } = await params;
            const res = await fetch(`/api/tasks/${taskId}`);
            if (res.ok) {
                const data = await res.json();
                setTask(data.task);
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
