'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    Package, CheckCircle, Circle, Clock, Target,
    ChevronLeft, ChevronRight, Sparkles, Calendar
} from 'lucide-react';
import styles from './ship-pack.module.css';

interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string;
    sort_order: number;
}

interface ParsedMeta {
    summary: string;
    category: string;
    time_mins: number;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    learn: { label: 'Learn', color: '#60a5fa', emoji: '📚' },
    create: { label: 'Create', color: '#c084fc', emoji: '🎨' },
    outreach: { label: 'Outreach', color: '#fb923c', emoji: '📣' },
    plan: { label: 'Plan', color: '#34d399', emoji: '📋' },
    execute: { label: 'Execute', color: '#fbbf24', emoji: '⚡' },
    review: { label: 'Review', color: '#f472b6', emoji: '🔍' },
};

function parseMeta(desc: string | null): ParsedMeta {
    if (!desc) return { summary: '', category: 'execute', time_mins: 0 };
    try {
        return JSON.parse(desc);
    } catch {
        return { summary: desc, category: 'execute', time_mins: 0 };
    }
}

function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toLocalDateStr(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getDateStr(offset: number, baseDate: string): string {
    const [y, m, d] = baseDate.split('-').map(Number);
    const date = new Date(y, m - 1, d + offset);
    return toLocalDateStr(date);
}

export default function ShipPackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();

    const initialDate = searchParams.get('date') || toLocalDateStr(new Date());
    const [viewDate, setViewDate] = useState(initialDate);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [strategy, setStrategy] = useState<{ archetype: string; thesis: string } | null>(null);
    const [lockedKpi, setLockedKpi] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get strategy info
        const { data: contract } = await supabase
            .from('execution_contracts')
            .select('*, strategy:strategy_options(*)')
            .eq('user_id', user.id)
            .order('signed_at', { ascending: false })
            .limit(1)
            .single();

        if (contract?.strategy) {
            setStrategy({
                archetype: contract.strategy.archetype,
                thesis: contract.strategy.thesis,
            });
            setLockedKpi(contract.locked_kpi || '');
        }

        // Get all tasks for nearby dates (±3 days for grouping)
        const startDate = getDateStr(-3, viewDate);
        const endDate = getDateStr(3, viewDate);

        const { data: tks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .order('due_date', { ascending: true })
            .order('sort_order', { ascending: true });

        setAllTasks(tks || []);
        setTasks((tks || []).filter(t => t.due_date === viewDate));
        setLoading(false);
    }, [viewDate, supabase]);

    useEffect(() => { loadData(); }, [loadData]);

    const toggleTask = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

        await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    };

    const generateTasks = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/tasks/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: viewDate }),
            });
            if (res.ok) {
                const data = await res.json();
                setTasks(data.tasks || []);
            }
        } catch { /* ignore */ }
        setGenerating(false);
    };

    const prevDay = () => {
        const newDate = getDateStr(-1, viewDate);
        setViewDate(newDate);
        router.push(`/ship-pack?date=${newDate}`, { scroll: false });
    };

    const nextDay = () => {
        const newDate = getDateStr(1, viewDate);
        setViewDate(newDate);
        router.push(`/ship-pack?date=${newDate}`, { scroll: false });
    };

    const goToDetail = (taskId: string) => {
        router.push(`/tasks/${taskId}`);
    };

    const todayStr = toLocalDateStr(new Date());
    const isToday = viewDate === todayStr;
    const completedCount = tasks.filter(t => t.status === 'done').length;

    // Group nearby day tasks for the sidebar timeline
    const nearbyDates = [-2, -1, 0, 1, 2]
        .map(offset => getDateStr(offset, viewDate))
        .filter(d => {
            const dayTasks = allTasks.filter(t => t.due_date === d);
            return dayTasks.length > 0 || d === viewDate;
        });

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} style={{ height: 200 }} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Long-term Goal Header */}
            {strategy && (
                <div className={styles.goalBanner}>
                    <div className={styles.goalIcon}>
                        <Target size={20} />
                    </div>
                    <div className={styles.goalContent}>
                        <h2 className={styles.goalTitle}>{strategy.archetype}</h2>
                        <p className={styles.goalThesis}>{strategy.thesis}</p>
                        {lockedKpi && (
                            <div className={styles.kpiBadge}>
                                <span>🎯 KPI: {lockedKpi}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Day Navigation */}
            <div className={styles.dayNav}>
                <button onClick={prevDay} className={styles.dayNavBtn}>
                    <ChevronLeft size={18} />
                </button>
                <div className={styles.dayNavCenter}>
                    <Calendar size={16} />
                    <span className={styles.dayNavDate}>
                        {isToday ? 'Today' : formatDate(viewDate)}
                    </span>
                    <span className={styles.dayNavFull}>{viewDate}</span>
                </div>
                <button onClick={nextDay} className={styles.dayNavBtn}>
                    <ChevronRight size={18} />
                </button>
            </div>

            {/* Progress summary */}
            {tasks.length > 0 && (
                <div className={styles.daySummary}>
                    <span className={styles.summaryText}>
                        {completedCount}/{tasks.length} tasks completed
                    </span>
                    <div className={styles.summaryBar}>
                        <div
                            className={styles.summaryFill}
                            style={{ width: `${(completedCount / tasks.length) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Tasks for selected day */}
            {tasks.length === 0 ? (
                <div className={styles.emptyDay}>
                    <Package size={32} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
                    <p>No tasks for {isToday ? 'today' : formatDate(viewDate)}</p>
                    <button
                        className="btn btn-secondary"
                        onClick={generateTasks}
                        disabled={generating}
                    >
                        {generating ? (
                            <><Sparkles size={14} className={styles.spinning} /> Generating...</>
                        ) : (
                            <><Sparkles size={14} /> Generate Tasks</>
                        )}
                    </button>
                </div>
            ) : (
                <div className={styles.taskList}>
                    {tasks.map((task) => {
                        const meta = parseMeta(task.description);
                        const cat = CATEGORY_CONFIG[meta.category] || CATEGORY_CONFIG.execute;

                        return (
                            <div
                                key={task.id}
                                className={`${styles.taskCard} ${task.status === 'done' ? styles.taskDone : ''}`}
                            >
                                <button
                                    className={styles.taskCheck}
                                    onClick={() => toggleTask(task.id, task.status)}
                                >
                                    {task.status === 'done' ? (
                                        <CheckCircle size={22} style={{ color: cat.color }} />
                                    ) : (
                                        <Circle size={22} />
                                    )}
                                </button>
                                <div className={styles.taskBody} onClick={() => goToDetail(task.id)}>
                                    <span className={styles.taskTitle}>{task.title}</span>
                                    {meta.summary && (
                                        <span className={styles.taskSummary}>{meta.summary}</span>
                                    )}
                                    <div className={styles.taskTags}>
                                        <span
                                            className={styles.categoryTag}
                                            style={{ background: cat.color + '18', color: cat.color }}
                                        >
                                            {cat.emoji} {cat.label}
                                        </span>
                                        {meta.time_mins > 0 && (
                                            <span className={styles.timeTag}>
                                                <Clock size={11} />
                                                {meta.time_mins}m
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Nearby Days Timeline */}
            {nearbyDates.length > 1 && (
                <div className={styles.timeline}>
                    <h3 className={styles.timelineTitle}>Nearby Days</h3>
                    <div className={styles.timelineDays}>
                        {nearbyDates.map((d) => {
                            const dayTasks = allTasks.filter(t => t.due_date === d);
                            const dayDone = dayTasks.filter(t => t.status === 'done').length;
                            const isActive = d === viewDate;

                            return (
                                <button
                                    key={d}
                                    className={`${styles.timelineDay} ${isActive ? styles.timelineActive : ''}`}
                                    onClick={() => {
                                        setViewDate(d);
                                        router.push(`/ship-pack?date=${d}`, { scroll: false });
                                    }}
                                >
                                    <span className={styles.timelineDateLabel}>
                                        {d === todayStr ? 'Today' : formatDate(d)}
                                    </span>
                                    <span className={styles.timelineCount}>
                                        {dayTasks.length > 0
                                            ? `${dayDone}/${dayTasks.length}`
                                            : '—'
                                        }
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
