'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Send, Trophy, TrendingUp, Target, Zap, Quote,
    ArrowRight, X, Check, Sparkles, RefreshCw, Calendar,
    Clock, ChevronRight, Eye
} from 'lucide-react';
import { GifBubble } from '@/components/GifBubble';
import styles from './board-meeting.module.css';

interface Message {
    role: 'user' | 'derek';
    content: string;
    reaction?: string;
}

interface Summary {
    weekNumber: number;
    strategy: string;
    kpiTarget: string;
    kpiActual: string;
    kpiVerdict: string;
    tasksCompleted: number;
    tasksTotal: number;
    topWins: string[];
    killList: string[];
    keepList: string[];
    doubleDownList: string[];
    weeklyInsight: string;
    derekVerdict: string;
    motivationalQuote: string;
    nextWeekFocus: string;
}

interface PastCheckin {
    id: string;
    weekNumber: number;
    summary: Summary;
    completedAt: string;
}

interface CheckinStatus {
    checkinAvailable: boolean;
    daysUntilCheckin: number;
    daysSinceCreation: number;
    currentWeekNumber: number;
    pastSummaries: PastCheckin[];
}

export default function WeeklyCheckinPage() {
    const [phase, setPhase] = useState<'loading' | 'not-ready' | 'interview' | 'generating' | 'summary' | 'past-view'>('loading');
    const [status, setStatus] = useState<CheckinStatus | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [threadId, setThreadId] = useState<string | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [started, setStarted] = useState(false);
    const [selectedPast, setSelectedPast] = useState<PastCheckin | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load status on mount
    useEffect(() => {
        fetch('/api/weekly-checkin/status')
            .then(r => r.json())
            .then((data: CheckinStatus) => {
                setStatus(data);
                if (data.checkinAvailable) {
                    setPhase('interview');
                } else {
                    setPhase('not-ready');
                }
            })
            .catch(() => setPhase('not-ready'));
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, phase]);

    const startCheckin = async () => {
        setStarted(true);
        setChatLoading(true);
        try {
            const res = await fetch('/api/weekly-checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.response) {
                setMessages([{
                    role: 'derek',
                    content: data.response,
                    reaction: data.reaction,
                }]);
                setThreadId(data.threadId);
            }
        } catch (err) {
            console.error(err);
        }
        setChatLoading(false);
    };

    const sendMessage = async () => {
        if (!input.trim() || chatLoading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatLoading(true);

        try {
            const res = await fetch('/api/weekly-checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg, threadId }),
            });
            const data = await res.json();
            if (data.response) {
                setMessages(prev => [...prev, {
                    role: 'derek',
                    content: data.response,
                    reaction: data.reaction,
                }]);
                if (data.threadId) setThreadId(data.threadId);

                if (data.isComplete) {
                    setTimeout(() => generateSummary(data.threadId || threadId), 1500);
                }
            }
        } catch (err) {
            console.error(err);
        }
        setChatLoading(false);
    };

    const generateSummary = async (tid: string | null) => {
        if (!tid) return;
        setPhase('generating');

        try {
            const res = await fetch('/api/weekly-checkin/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threadId: tid }),
            });
            const data = await res.json();
            if (data.summary) {
                setSummary(data.summary);
                setPhase('summary');
            }
        } catch (err) {
            console.error(err);
            setPhase('interview');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const viewPastSummary = (past: PastCheckin) => {
        setSelectedPast(past);
        setSummary(past.summary);
        setPhase('past-view');
    };

    const backToList = () => {
        setSelectedPast(null);
        setSummary(null);
        setPhase('not-ready');
    };

    const verdictColor = (v: string) => {
        if (v === 'BEAT') return 'var(--accent-green)';
        if (v === 'MISSED') return '#ef4444';
        return 'var(--gold-400)';
    };

    const formatPastDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
        });
    };

    // ─── Loading ───
    if (phase === 'loading') {
        return (
            <div className={styles.page}>
                <div className="skeleton" style={{ width: '100%', height: 400, borderRadius: 'var(--radius-lg)' }} />
            </div>
        );
    }

    // ─── Not Ready / Past Summaries View ───
    if (phase === 'not-ready') {
        const hasPast = status?.pastSummaries && status.pastSummaries.length > 0;

        return (
            <div className={styles.page}>
                {/* Status Banner */}
                <div className={styles.statusBanner}>
                    <div className={styles.statusIcon}>
                        <Clock size={24} />
                    </div>
                    <div className={styles.statusContent}>
                        <h2 className={styles.statusTitle}>
                            {status && status.daysSinceCreation < 7
                                ? 'Building Your First Week'
                                : 'Next Check-in Coming Soon'}
                        </h2>
                        <p className={styles.statusText}>
                            {status && status.daysSinceCreation < 7
                                ? `Your first check-in will be available in ${7 - status.daysSinceCreation} day${7 - status.daysSinceCreation !== 1 ? 's' : ''}. Focus on your tasks until then!`
                                : status?.daysUntilCheckin
                                    ? `Your next weekly check-in is in ${status.daysUntilCheckin} day${status.daysUntilCheckin !== 1 ? 's' : ''}. Keep shipping!`
                                    : 'Keep working on your tasks. Your check-in will be available soon.'}
                        </p>
                    </div>
                    <div className={styles.countdownBadge}>
                        <Calendar size={14} />
                        <span>{status?.daysUntilCheckin || '—'} days</span>
                    </div>
                </div>

                {/* Past Check-ins */}
                {hasPast && (
                    <div className={styles.pastSection}>
                        <h3 className={styles.pastTitle}>Past Check-ins</h3>
                        <div className={styles.pastList}>
                            {status!.pastSummaries.map((past) => (
                                <button
                                    key={past.id}
                                    className={styles.pastCard}
                                    onClick={() => viewPastSummary(past)}
                                >
                                    <div className={styles.pastCardLeft}>
                                        <span className={styles.pastWeek}>Week {past.weekNumber}</span>
                                        <span className={styles.pastDate}>
                                            {past.completedAt ? formatPastDate(past.completedAt) : '—'}
                                        </span>
                                    </div>
                                    <div className={styles.pastCardMid}>
                                        {past.summary?.strategy && (
                                            <span className={styles.pastStrategy}>{past.summary.strategy}</span>
                                        )}
                                        {past.summary?.kpiVerdict && (
                                            <span
                                                className={styles.pastVerdict}
                                                style={{ color: verdictColor(past.summary.kpiVerdict) }}
                                            >
                                                KPI {past.summary.kpiVerdict}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.pastCardRight}>
                                        <Eye size={16} />
                                        <ChevronRight size={16} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!hasPast && (
                    <div className={styles.emptyPast}>
                        <div className={styles.emptyIcon}>📊</div>
                        <h3>No Check-ins Yet</h3>
                        <p className="text-secondary">
                            Complete your first week and your check-in presentations will appear here.
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // ─── Summary Presentation (current or past) ───
    if ((phase === 'summary' || phase === 'past-view') && summary) {
        return (
            <div className={styles.page}>
                <div className={styles.summaryContainer}>
                    {/* Back button for past views */}
                    {phase === 'past-view' && (
                        <button className={styles.backBtn} onClick={backToList}>
                            ← Back to check-ins
                        </button>
                    )}

                    {/* Hero Card */}
                    <div className={styles.heroCard}>
                        <div className={styles.heroWeek}>Week {summary.weekNumber}</div>
                        <h1 className={styles.heroTitle}>
                            {phase === 'past-view' ? 'Weekly Summary' : 'Weekly Check-in Complete'}
                        </h1>
                        <p className={styles.heroStrategy}>{summary.strategy}</p>
                    </div>

                    {/* KPI Card */}
                    <div className={styles.slideCard}>
                        <div className={styles.slideIcon}>
                            <TrendingUp size={20} />
                        </div>
                        <h3 className={styles.slideTitle}>KPI Report</h3>
                        <div className={styles.kpiGrid}>
                            <div className={styles.kpiBox}>
                                <span className={styles.kpiBoxLabel}>Target</span>
                                <span className={styles.kpiBoxValue}>{summary.kpiTarget}</span>
                            </div>
                            <div className={styles.kpiBox}>
                                <span className={styles.kpiBoxLabel}>Actual</span>
                                <span className={styles.kpiBoxValue}>{summary.kpiActual}</span>
                            </div>
                        </div>
                        <div
                            className={styles.verdictBadge}
                            style={{ background: verdictColor(summary.kpiVerdict) + '18', color: verdictColor(summary.kpiVerdict) }}
                        >
                            {summary.kpiVerdict === 'BEAT' && <Trophy size={14} />}
                            {summary.kpiVerdict === 'MET' && <Check size={14} />}
                            {summary.kpiVerdict === 'MISSED' && <Target size={14} />}
                            KPI {summary.kpiVerdict}
                        </div>
                    </div>

                    {/* Tasks Card */}
                    <div className={styles.slideCard}>
                        <div className={styles.slideIcon}>
                            <Check size={20} />
                        </div>
                        <h3 className={styles.slideTitle}>Tasks Progress</h3>
                        <div className={styles.taskProgress}>
                            <span className={styles.taskProgressNum}>
                                {summary.tasksCompleted}/{summary.tasksTotal}
                            </span>
                            <span className={styles.taskProgressLabel}>tasks completed</span>
                        </div>
                        <div className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{ width: `${summary.tasksTotal > 0 ? (summary.tasksCompleted / summary.tasksTotal) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Top Wins */}
                    {summary.topWins && summary.topWins.length > 0 && (
                        <div className={styles.slideCard}>
                            <div className={`${styles.slideIcon} ${styles.iconWins}`}>
                                <Trophy size={20} />
                            </div>
                            <h3 className={styles.slideTitle}>Top Wins 🏆</h3>
                            <ul className={styles.winsList}>
                                {summary.topWins.map((win, i) => (
                                    <li key={i}>{win}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Kill / Keep / Double */}
                    <div className={styles.kkdGrid}>
                        {summary.killList && summary.killList.length > 0 && (
                            <div className={`${styles.kkdCard} ${styles.killCard}`}>
                                <h4><X size={14} /> Kill</h4>
                                <ul>{summary.killList.map((item, i) => <li key={i}>{item}</li>)}</ul>
                            </div>
                        )}
                        {summary.keepList && summary.keepList.length > 0 && (
                            <div className={`${styles.kkdCard} ${styles.keepCard}`}>
                                <h4><Check size={14} /> Keep</h4>
                                <ul>{summary.keepList.map((item, i) => <li key={i}>{item}</li>)}</ul>
                            </div>
                        )}
                        {summary.doubleDownList && summary.doubleDownList.length > 0 && (
                            <div className={`${styles.kkdCard} ${styles.doubleCard}`}>
                                <h4><Zap size={14} /> Double Down</h4>
                                <ul>{summary.doubleDownList.map((item, i) => <li key={i}>{item}</li>)}</ul>
                            </div>
                        )}
                    </div>

                    {/* Derek's Verdict */}
                    <div className={styles.verdictCard}>
                        <div className={styles.verdictAvatar}>D</div>
                        <div>
                            <h4 className={styles.verdictLabel}>Derek&apos;s Verdict</h4>
                            <p className={styles.verdictText}>{summary.derekVerdict}</p>
                        </div>
                    </div>

                    {/* Weekly Insight */}
                    {summary.weeklyInsight && (
                        <div className={styles.insightCard}>
                            <Sparkles size={16} style={{ color: 'var(--gold-400)' }} />
                            <p className={styles.insightText}>{summary.weeklyInsight}</p>
                        </div>
                    )}

                    {/* Motivational Quote */}
                    {summary.motivationalQuote && (
                        <div className={styles.quoteCard}>
                            <Quote size={24} className={styles.quoteIcon} />
                            <p className={styles.quoteText}>{summary.motivationalQuote}</p>
                        </div>
                    )}

                    {/* Next Week Focus */}
                    {summary.nextWeekFocus && (
                        <div className={styles.nextWeekCard}>
                            <ArrowRight size={16} />
                            <div>
                                <h4>Next Week Focus</h4>
                                <p>{summary.nextWeekFocus}</p>
                            </div>
                        </div>
                    )}

                    <a href="/dashboard" className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
                        Back to Dashboard
                    </a>
                </div>
            </div>
        );
    }

    // ─── Generating State ───
    if (phase === 'generating') {
        return (
            <div className={styles.page}>
                <div className={styles.generatingState}>
                    <RefreshCw size={32} className={styles.spinning} />
                    <h2>Generating Your Weekly Summary</h2>
                    <p className="text-secondary">Derek is putting together your presentation...</p>
                </div>
            </div>
        );
    }

    // ─── Interview Phase ───
    return (
        <div className={styles.page}>
            <div className={styles.chatContainer}>
                {/* Header */}
                <div className={styles.chatHeader}>
                    <div className={styles.chatHeaderAvatar}>D</div>
                    <div>
                        <h2 className={styles.chatHeaderTitle}>Weekly Check-in</h2>
                        <p className={styles.chatHeaderSub}>
                            {started ? 'Derek is reviewing your week' : 'Ready to review your week with Derek?'}
                        </p>
                    </div>
                </div>

                {/* Messages */}
                <div className={styles.chatMessages}>
                    {!started ? (
                        <div className={styles.startState}>
                            <div className={styles.startIcon}>📊</div>
                            <h3>Weekly Check-in</h3>
                            <p className="text-secondary">
                                Derek will interview you about your KPIs, task performance, and what to focus on next week.
                                Takes about 3-5 minutes.
                            </p>
                            <button className="btn btn-primary btn-lg" onClick={startCheckin}>
                                <Sparkles size={16} /> Start Check-in
                            </button>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.derekMessage}`}
                                >
                                    {msg.role === 'derek' && (
                                        <div className={styles.msgAvatar}>D</div>
                                    )}
                                    <div className={styles.msgColumn}>
                                        {msg.role === 'derek' && msg.reaction && (
                                            <div className={styles.gifWrapper}>
                                                <GifBubble reaction={msg.reaction} />
                                            </div>
                                        )}
                                        <div className={`${styles.msgBubble} ${msg.role === 'user' ? styles.userBubble : styles.derekBubble}`}>
                                            <p>{msg.content}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className={`${styles.message} ${styles.derekMessage}`}>
                                    <div className={styles.msgAvatar}>D</div>
                                    <div className={styles.msgBubble}>
                                        <div className={styles.typing}>
                                            <span /><span /><span />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                {started && (
                    <div className={styles.chatInput}>
                        <input
                            type="text"
                            className="input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Share your thoughts..."
                            disabled={chatLoading}
                        />
                        <button
                            className={styles.sendBtn}
                            onClick={sendMessage}
                            disabled={chatLoading || !input.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
