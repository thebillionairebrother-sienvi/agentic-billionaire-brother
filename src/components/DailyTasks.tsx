'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Circle, RefreshCw, Sparkles, Clock, Calendar, ChevronRight } from 'lucide-react';
import styles from './DailyTasks.module.css';

interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    sort_order: number;
}

interface ParsedMeta {
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
    if (!desc) return { category: 'execute', time_mins: 0 };
    try {
        const parsed = JSON.parse(desc);
        return { category: parsed.category || 'execute', time_mins: parsed.time_mins || 0 };
    } catch {
        return { category: 'execute', time_mins: 0 };
    }
}

function getDateStr(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
}

function getDayLabel(offset: number): string {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getShortDay(offset: number): string {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tmrw';
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDayNumber(offset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getDate().toString();
}

const DAY_OFFSETS = [0, 1, 2];

export function DailyTasks() {
    const [selectedDay, setSelectedDay] = useState(0);
    const [tasksByDay, setTasksByDay] = useState<Record<string, Task[]>>({});
    const [loadingDay, setLoadingDay] = useState<string | null>(null);
    const [generatingDay, setGeneratingDay] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const dateStr = getDateStr(selectedDay);
    const tasks = tasksByDay[dateStr] || [];

    const fetchTasksForDate = useCallback(async (date: string) => {
        try {
            const res = await fetch(`/api/tasks?date=${date}`);
            const data = await res.json();
            const fetched = data.tasks || [];
            setTasksByDay((prev) => ({ ...prev, [date]: fetched }));
            return fetched;
        } catch {
            setError('Failed to load tasks');
            return [];
        }
    }, []);

    const generateTasksForDate = useCallback(async (date: string) => {
        setGeneratingDay(date);
        setError(null);
        try {
            const res = await fetch('/api/tasks/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date }),
            });
            if (!res.ok) {
                const body = await res.json();
                if (res.status === 409) {
                    await fetchTasksForDate(date);
                    return;
                }
                throw new Error(body.error || 'Generation failed');
            }
            const data = await res.json();
            setTasksByDay((prev) => ({ ...prev, [date]: data.tasks || [] }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate tasks');
        } finally {
            setGeneratingDay(null);
        }
    }, [fetchTasksForDate]);

    const toggleTask = async (e: React.MouseEvent, taskId: string, currentStatus: string) => {
        e.stopPropagation();
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';

        setTasksByDay((prev) => ({
            ...prev,
            [dateStr]: (prev[dateStr] || []).map((t) =>
                t.id === taskId ? { ...t, status: newStatus } : t
            ),
        }));

        try {
            await fetch('/api/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, status: newStatus }),
            });
        } catch {
            setTasksByDay((prev) => ({
                ...prev,
                [dateStr]: (prev[dateStr] || []).map((t) =>
                    t.id === taskId ? { ...t, status: currentStatus } : t
                ),
            }));
        }
    };

    useEffect(() => {
        const init = async () => {
            const todayStr = getDateStr(0);
            setLoadingDay(todayStr);
            const existing = await fetchTasksForDate(todayStr);
            if (existing.length === 0) {
                await generateTasksForDate(todayStr);
            }
            setLoadingDay(null);
        };
        init();
    }, [fetchTasksForDate, generateTasksForDate]);

    const handleDayChange = async (offset: number) => {
        setSelectedDay(offset);
        setError(null);
        const date = getDateStr(offset);
        if (!tasksByDay[date]) {
            setLoadingDay(date);
            const existing = await fetchTasksForDate(date);
            if (existing.length === 0) {
                await generateTasksForDate(date);
            }
            setLoadingDay(null);
        }
    };

    const isLoading = loadingDay === dateStr;
    const isGenerating = generatingDay === dateStr;
    const completedCount = tasks.filter((t) => t.status === 'done').length;
    const totalCount = tasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className={`card ${styles.card}`}>
            {/* Header */}
            <div className={styles.cardHeader}>
                <div className={styles.titleRow}>
                    <Calendar size={18} className={styles.calIcon} />
                    <h3 className="heading-sm">{getDayLabel(selectedDay)}&apos;s Plan</h3>
                </div>
                <div className={styles.headerRight}>
                    {totalCount > 0 && (
                        <span className={styles.progress}>
                            {completedCount}/{totalCount}
                        </span>
                    )}
                    <button
                        className={styles.refreshBtn}
                        onClick={() => generateTasksForDate(dateStr)}
                        disabled={isGenerating || isLoading}
                        title="Regenerate tasks"
                    >
                        <RefreshCw size={14} className={isGenerating ? styles.spinning : ''} />
                    </button>
                </div>
            </div>

            {/* Day Tabs */}
            <div className={styles.dayTabs}>
                {DAY_OFFSETS.map((offset) => {
                    const dayDate = getDateStr(offset);
                    const dayTasks = tasksByDay[dayDate] || [];
                    const dayDone = dayTasks.filter((t) => t.status === 'done').length;
                    const dayTotal = dayTasks.length;
                    const isActive = selectedDay === offset;

                    return (
                        <button
                            key={offset}
                            className={`${styles.dayTab} ${isActive ? styles.activeTab : ''}`}
                            onClick={() => handleDayChange(offset)}
                        >
                            <span className={styles.dayNumber}>{getDayNumber(offset)}</span>
                            <span className={styles.dayName}>{getShortDay(offset)}</span>
                            {dayTotal > 0 && (
                                <span className={`${styles.dayDot} ${dayDone === dayTotal ? styles.dayDotDone : ''}`} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {/* Error */}
            {error && <div className={styles.error}>{error}</div>}

            {/* Content */}
            {isLoading || isGenerating ? (
                <div className={styles.generating}>
                    <div className={styles.spinner}>
                        <Sparkles size={20} />
                    </div>
                    <p>{isGenerating ? 'Planning your day...' : 'Loading...'}</p>
                </div>
            ) : tasks.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>No tasks yet.</p>
                    <button
                        className="btn btn-secondary"
                        onClick={() => generateTasksForDate(dateStr)}
                    >
                        <Sparkles size={14} /> Generate Tasks
                    </button>
                </div>
            ) : (
                <ul className={styles.taskList}>
                    {tasks.map((task) => {
                        const meta = parseMeta(task.description);
                        const cat = CATEGORY_CONFIG[meta.category] || CATEGORY_CONFIG.execute;

                        return (
                            <li
                                key={task.id}
                                className={`${styles.taskItem} ${task.status === 'done' ? styles.done : ''}`}
                                onClick={() => router.push(`/tasks/${task.id}`)}
                            >
                                <button
                                    className={styles.checkbox}
                                    onClick={(e) => toggleTask(e, task.id, task.status)}
                                >
                                    {task.status === 'done' ? (
                                        <CheckCircle size={20} style={{ color: cat.color }} />
                                    ) : (
                                        <Circle size={20} />
                                    )}
                                </button>
                                <div className={styles.taskContent}>
                                    <span className={styles.taskTitle}>{task.title}</span>
                                    <div className={styles.taskMeta}>
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
                                <ChevronRight size={16} className={styles.taskChevron} />
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
