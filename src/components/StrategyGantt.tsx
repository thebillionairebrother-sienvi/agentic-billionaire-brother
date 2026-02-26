'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, CheckCircle, Circle, Clock, ChevronDown, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { StrategyPhase } from '@/lib/types';
import styles from './StrategyGantt.module.css';

const PHASE_META: Record<number, { cssClass: string; titleClass: string; color: string }> = {
    1: { cssClass: styles.phaseFoundation, titleClass: styles.milestoneBlockTitleFoundation, color: '#3b82f6' },
    2: { cssClass: styles.phaseGrowth, titleClass: styles.milestoneBlockTitleGrowth, color: '#22c55e' },
    3: { cssClass: styles.phaseScale, titleClass: styles.milestoneBlockTitleScale, color: '#a855f7' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    learn: { label: 'Learn', color: '#60a5fa', emoji: '📚' },
    create: { label: 'Create', color: '#c084fc', emoji: '🎨' },
    outreach: { label: 'Outreach', color: '#fb923c', emoji: '📣' },
    plan: { label: 'Plan', color: '#34d399', emoji: '📋' },
    execute: { label: 'Execute', color: '#fbbf24', emoji: '⚡' },
    review: { label: 'Review', color: '#f472b6', emoji: '🔍' },
};

// Default phases fallback
const DEFAULT_PHASES: StrategyPhase[] = [
    {
        phase_number: 1,
        name: 'Foundation',
        weeks: '1-5',
        goal: 'Validate your idea and build the first version of your offer.',
        milestones: ['Define target customer', 'Launch MVP offer', 'First paying customer', 'Set up analytics'],
        focus_areas: ['Validation', 'Initial launch'],
    },
    {
        phase_number: 2,
        name: 'Growth',
        weeks: '6-10',
        goal: 'Scale what works and kill what does not.',
        milestones: ['Double down on best channel', 'Optimize conversion', 'Build repeatable pipeline', 'Hit revenue milestone'],
        focus_areas: ['Traction', 'Optimization'],
    },
    {
        phase_number: 3,
        name: 'Scale',
        weeks: '11-15',
        goal: 'Systemize, automate, and explore secondary channels.',
        milestones: ['Automate key workflow', 'Launch second channel', 'Hire or delegate', 'Establish brand presence'],
        focus_areas: ['Automation', 'Expansion'],
    },
];

interface TaskData {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string;
}

interface ParsedMeta {
    summary: string;
    category: string;
    difficulty: number;
    time_mins: number;
}

function parseMeta(desc: string | null): ParsedMeta {
    if (!desc) return { summary: '', category: 'execute', difficulty: 1, time_mins: 0 };
    try {
        return JSON.parse(desc);
    } catch {
        return { summary: desc, category: 'execute', difficulty: 1, time_mins: 0 };
    }
}

function parseWeekRange(weeks: string): [number, number] {
    const parts = weeks.split('-').map(Number);
    return [parts[0] || 1, parts[1] || 5];
}

function getPhaseForWeek(week: number, phases: StrategyPhase[]): StrategyPhase | null {
    for (const phase of phases) {
        const [start, end] = parseWeekRange(phase.weeks);
        if (week >= start && week <= end) return phase;
    }
    return null;
}

interface StrategyGanttProps {
    phases?: StrategyPhase[];
    currentWeek: number;
}

export function StrategyGantt({ phases, currentWeek }: StrategyGanttProps) {
    const displayPhases = phases && phases.length === 3 ? phases : DEFAULT_PHASES;
    const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
    const [weekTasks, setWeekTasks] = useState<TaskData[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const supabase = createClient();

    const loadTasksForWeek = useCallback(async (weekNum: number) => {
        setLoadingTasks(true);
        try {
            // Get the weekly cycle for this week number
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: cycle } = await supabase
                .from('weekly_cycles')
                .select('id')
                .eq('user_id', user.id)
                .eq('week_number', weekNum)
                .limit(1)
                .single();

            if (cycle) {
                const { data: tasks } = await supabase
                    .from('tasks')
                    .select('id, title, description, status, due_date')
                    .eq('weekly_cycle_id', cycle.id)
                    .order('due_date', { ascending: true })
                    .order('sort_order', { ascending: true });

                setWeekTasks(tasks || []);
            } else {
                setWeekTasks([]);
            }
        } catch {
            setWeekTasks([]);
        }
        setLoadingTasks(false);
    }, [supabase]);

    useEffect(() => {
        if (expandedWeek !== null) {
            loadTasksForWeek(expandedWeek);
        }
    }, [expandedWeek, loadTasksForWeek]);

    const handleWeekClick = (week: number, inPhase: boolean) => {
        if (!inPhase) return;
        setExpandedWeek(expandedWeek === week ? null : week);
    };

    const expandedPhase = expandedWeek ? getPhaseForWeek(expandedWeek, displayPhases) : null;
    const expandedPhaseMeta = expandedPhase ? PHASE_META[expandedPhase.phase_number] || PHASE_META[1] : null;

    // Group tasks by due_date for the expanded panel
    const tasksByDate: Record<string, TaskData[]> = {};
    for (const t of weekTasks) {
        if (!tasksByDate[t.due_date]) tasksByDate[t.due_date] = [];
        tasksByDate[t.due_date].push(t);
    }
    const sortedDates = Object.keys(tasksByDate).sort();

    // Calculate the min/max dates for the Gantt bar positioning
    const allDates = weekTasks.map(t => t.due_date).filter(Boolean);
    const minDate = allDates.length > 0 ? allDates[0] : '';
    const maxDate = allDates.length > 0 ? allDates[allDates.length - 1] : '';

    function daysBetween(a: string, b: string): number {
        const da = new Date(a + 'T00:00:00');
        const db = new Date(b + 'T00:00:00');
        return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
    }

    const totalDays = minDate && maxDate ? Math.max(daysBetween(minDate, maxDate), 1) : 1;

    function formatDateShort(dateStr: string): string {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    return (
        <div className={`card ${styles.ganttCard}`}>
            {/* Header */}
            <div className={styles.ganttHeader}>
                <span className={styles.ganttTitle}>
                    <BarChart3 size={16} />
                    15-Week Strategy Timeline
                </span>
                <span className={styles.weekLabel}>Week {currentWeek} of 15</span>
            </div>

            {/* Week number labels */}
            <div className={styles.weekNumbers}>
                <span className={styles.weekNumberLabel}>Phase</span>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((w) => (
                    <span
                        key={w}
                        className={`${styles.weekNumberLabel} ${w === currentWeek ? styles.weekNumberCurrent : ''}`}
                    >
                        {w}
                    </span>
                ))}
            </div>

            {/* Phase swim-lanes */}
            <div className={styles.phases}>
                {displayPhases.map((phase) => {
                    const meta = PHASE_META[phase.phase_number] || PHASE_META[1];
                    const [startWeek, endWeek] = parseWeekRange(phase.weeks);

                    return (
                        <div key={phase.phase_number} className={styles.phaseRowWrapper}>
                            <div className={styles.phaseRow}>
                                <div className={styles.phaseLabel}>
                                    <span className={styles.phaseName}>{phase.name}</span>
                                    <span className={styles.phaseWeeks}>Wk {phase.weeks}</span>
                                </div>
                                <div className={styles.phaseTrack}>
                                    {Array.from({ length: 15 }, (_, i) => i + 1).map((w) => {
                                        const inPhase = w >= startWeek && w <= endWeek;
                                        const isCurrent = w === currentWeek && inPhase;
                                        const isCompleted = w < currentWeek && inPhase;
                                        const isExpanded = w === expandedWeek;

                                        let cls = styles.weekCell;
                                        if (!inPhase) {
                                            cls += ` ${styles.weekInactive}`;
                                        } else {
                                            cls += ` ${meta.cssClass}`;
                                            if (isCurrent) cls += ` ${styles.weekCurrent}`;
                                            if (isCompleted) cls += ` ${styles.weekCompleted}`;
                                            if (isExpanded) cls += ` ${styles.weekExpanded}`;
                                            cls += ` ${styles.weekClickable}`;
                                        }

                                        return (
                                            <div
                                                key={w}
                                                className={cls}
                                                onClick={() => handleWeekClick(w, inPhase)}
                                            >
                                                {isExpanded && (
                                                    <ChevronDown size={10} className={styles.expandIcon} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className={styles.phaseGoal}>{phase.goal}</div>
                        </div>
                    );
                })}
            </div>

            {/* Expanded week panel */}
            {expandedWeek !== null && (
                <div className={styles.expandedPanel}>
                    <div className={styles.expandedHeader}>
                        <span className={styles.expandedTitle}>
                            <span
                                className={styles.expandedDot}
                                style={{ background: expandedPhaseMeta?.color || '#eab308' }}
                            />
                            Week {expandedWeek} Tasks
                            {expandedPhase && (
                                <span className={styles.expandedPhase}>— {expandedPhase.name}</span>
                            )}
                        </span>
                        <button
                            className={styles.expandedClose}
                            onClick={() => setExpandedWeek(null)}
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {loadingTasks ? (
                        <div className={styles.expandedLoading}>
                            <div className="skeleton" style={{ width: '100%', height: 32 }} />
                            <div className="skeleton" style={{ width: '80%', height: 32 }} />
                            <div className="skeleton" style={{ width: '60%', height: 32 }} />
                        </div>
                    ) : weekTasks.length === 0 ? (
                        <div className={styles.expandedEmpty}>
                            No tasks generated for Week {expandedWeek} yet.
                        </div>
                    ) : (
                        <div className={styles.taskGantt}>
                            {/* Date header */}
                            <div className={styles.taskGanttDates}>
                                <span className={styles.taskGanttLabel} />
                                {sortedDates.map((d) => {
                                    const offset = daysBetween(minDate, d);
                                    const left = (offset / totalDays) * 100;
                                    return (
                                        <span
                                            key={d}
                                            className={styles.taskGanttDate}
                                            style={{ left: `${left}%` }}
                                        >
                                            {formatDateShort(d)}
                                        </span>
                                    );
                                })}
                            </div>

                            {/* Task bars */}
                            {weekTasks.map((task) => {
                                const meta = parseMeta(task.description);
                                const cat = CATEGORY_CONFIG[meta.category] || CATEGORY_CONFIG.execute;
                                const offset = daysBetween(minDate, task.due_date);
                                const left = (offset / totalDays) * 100;
                                // Bar width based on difficulty (longer tasks = wider bars)
                                const barWidth = Math.max(8, Math.min(50, (meta.difficulty || 1) * 10));
                                const isDone = task.status === 'done';

                                return (
                                    <div key={task.id} className={styles.taskGanttRow}>
                                        <div className={styles.taskGanttRowLabel}>
                                            {isDone ? (
                                                <CheckCircle size={12} style={{ color: cat.color, flexShrink: 0 }} />
                                            ) : (
                                                <Circle size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                                            )}
                                            <span className={`${styles.taskGanttName} ${isDone ? styles.taskGanttNameDone : ''}`}>
                                                {task.title}
                                            </span>
                                        </div>
                                        <div className={styles.taskGanttTrack}>
                                            <div
                                                className={`${styles.taskGanttBar} ${isDone ? styles.taskGanttBarDone : ''}`}
                                                style={{
                                                    left: `${left}%`,
                                                    width: `${barWidth}%`,
                                                    background: isDone
                                                        ? `${cat.color}40`
                                                        : `linear-gradient(90deg, ${cat.color}50, ${cat.color}25)`,
                                                    borderColor: isDone ? `${cat.color}30` : `${cat.color}60`,
                                                }}
                                            >
                                                <span className={styles.taskBarLabel}>
                                                    {cat.emoji} {meta.time_mins}m
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Summary */}
                            <div className={styles.taskGanttSummary}>
                                <span>
                                    {weekTasks.filter(t => t.status === 'done').length}/{weekTasks.length} completed
                                </span>
                                <span>
                                    <Clock size={10} />
                                    {weekTasks.reduce((sum, t) => sum + (parseMeta(t.description).time_mins || 0), 0)} min total
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Milestones */}
            <div className={styles.milestones}>
                {displayPhases.map((phase) => {
                    const meta = PHASE_META[phase.phase_number] || PHASE_META[1];
                    return (
                        <div key={phase.phase_number} className={styles.milestoneBlock}>
                            <span className={`${styles.milestoneBlockTitle} ${meta.titleClass}`}>
                                {phase.name} (Wk {phase.weeks})
                            </span>
                            {phase.milestones.map((m, i) => (
                                <span key={i} className={styles.milestoneItem}>{m}</span>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
