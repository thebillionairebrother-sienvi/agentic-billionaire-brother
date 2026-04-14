'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ChevronUp, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './OnboardingChecklist.module.css';

const DISMISSED_KEY = 'bb_checklist_dismissed';
const POSITION_KEY = 'bb_checklist_pos';

interface DragPos { x: number; y: number; }

interface ChecklistStep {
    id: string;
    title: string;
    description: string;
    href: string;
    complete: boolean;
}

interface ChecklistProgress {
    onboardingComplete: boolean;
    hasStrategy: boolean;
    hasSprint: boolean;
    hasCompletedCheckin: boolean;
    hasChatted: boolean;
}

async function fetchProgress(userId: string): Promise<ChecklistProgress> {
    const supabase = createClient();

    const [
        { data: userRow },
        { data: contracts },
        { data: cycles },
        { data: completedCycles },
        { data: conversations },
    ] = await Promise.all([
        supabase.from('users').select('onboarding_complete').eq('id', userId).single(),
        supabase.from('execution_contracts').select('id').eq('user_id', userId).limit(1),
        supabase.from('weekly_cycles').select('id').eq('user_id', userId).limit(1),
        supabase.from('weekly_cycles').select('id').eq('user_id', userId).eq('status', 'completed').limit(1),
        supabase.from('chat_conversations').select('id').eq('user_id', userId).limit(1),
    ]);

    let hasChatted = false;
    if (conversations && conversations.length > 0) {
        const { count } = await supabase
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conversations[0].id);
        hasChatted = (count ?? 0) > 0;
    }

    return {
        onboardingComplete: userRow?.onboarding_complete ?? false,
        hasStrategy: (contracts?.length ?? 0) > 0,
        hasSprint: (cycles?.length ?? 0) > 0,
        hasCompletedCheckin: (completedCycles?.length ?? 0) > 0,
        hasChatted,
    };
}

/** Clamp a value between min and max */
function clamp(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
}

/** Returns a safe default position: bottom-center of the viewport, clear of the sidebar */
function defaultPos(): DragPos {
    if (typeof window === 'undefined') return { x: 400, y: 700 };
    return {
        x: Math.round(window.innerWidth / 2 - 80),
        y: window.innerHeight - 68,
    };
}

/** Load saved position from localStorage, falling back to defaultPos */
function loadPos(): DragPos {
    try {
        const raw = localStorage.getItem(POSITION_KEY);
        if (raw) {
            const p = JSON.parse(raw) as DragPos;
            // Clamp against current viewport in case screen size changed
            return {
                x: clamp(p.x, 0, window.innerWidth - 160),
                y: clamp(p.y, 0, window.innerHeight - 48),
            };
        }
    } catch { /* ignore */ }
    return defaultPos();
}

interface Props {
    userId: string;
}

export function OnboardingChecklist({ userId }: Props) {
    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [steps, setSteps] = useState<ChecklistStep[]>([]);
    const [loaded, setLoaded] = useState(false);

    // ── Drag state ──
    const [pos, setPos] = useState<DragPos | null>(null); // null until mounted
    const [isDragging, setIsDragging] = useState(false);
    const [hasDragged, setHasDragged] = useState(false); // distinguish click vs drag
    const dragOffset = useRef<DragPos>({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Initialise position after mount (needs window)
    useEffect(() => {
        setPos(loadPos());
    }, []);

    // Save position whenever it changes (and we're not in the middle of dragging)
    const savePos = useCallback((p: DragPos) => {
        try { localStorage.setItem(POSITION_KEY, JSON.stringify(p)); } catch { /* ignore */ }
    }, []);

    // ── Mouse drag ──
    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setIsDragging(true);
        setHasDragged(false);
        e.preventDefault();
    };

    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: MouseEvent) => {
            setHasDragged(true);
            setPos({
                x: clamp(e.clientX - dragOffset.current.x, 0, window.innerWidth - 160),
                y: clamp(e.clientY - dragOffset.current.y, 0, window.innerHeight - 48),
            });
        };

        const onUp = () => {
            setIsDragging(false);
            setPos(prev => {
                if (prev) savePos(prev);
                return prev;
            });
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [isDragging, savePos]);

    // ── Touch drag ──
    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (!triggerRef.current) return;
        const touch = e.touches[0];
        const rect = triggerRef.current.getBoundingClientRect();
        dragOffset.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        setIsDragging(true);
        setHasDragged(false);
    };

    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: TouchEvent) => {
            const touch = e.touches[0];
            setHasDragged(true);
            setPos({
                x: clamp(touch.clientX - dragOffset.current.x, 0, window.innerWidth - 160),
                y: clamp(touch.clientY - dragOffset.current.y, 0, window.innerHeight - 48),
            });
        };

        const onEnd = () => {
            setIsDragging(false);
            setPos(prev => {
                if (prev) savePos(prev);
                return prev;
            });
        };

        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd);
        return () => {
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };
    }, [isDragging, savePos]);

    // ── Data ──
    useEffect(() => {
        try {
            if (localStorage.getItem(DISMISSED_KEY) === 'true') setDismissed(true);
        } catch { /* ignore */ }

        fetchProgress(userId).then((progress) => {
            const built: ChecklistStep[] = [
                {
                    id: 'account',
                    title: 'Create your account',
                    description: "You're in. Welcome to the family.",
                    href: '/dashboard',
                    complete: true,
                },
                {
                    id: 'interview',
                    title: 'Complete your profile interview',
                    description: "Let Derek understand your business so he can build the right strategy.",
                    href: '/onboard',
                    complete: progress.onboardingComplete,
                },
                {
                    id: 'strategy',
                    title: 'Pick your business strategy',
                    description: "Review your 3 ranked strategy paths and commit to one.",
                    href: '/strategies',
                    complete: progress.hasStrategy,
                },
                {
                    id: 'sprint',
                    title: 'Launch your first sprint',
                    description: "Kick off Week 1 and get your action steps ready to execute.",
                    href: '/ship-pack',
                    complete: progress.hasSprint,
                },
                {
                    id: 'checkin',
                    title: 'Complete a weekly check-in',
                    description: "Hold yourself accountable. What worked? What didn't?",
                    href: '/board-meeting',
                    complete: progress.hasCompletedCheckin,
                },
                {
                    id: 'chat',
                    title: 'Chat with your Brother',
                    description: "Ask Derek anything about your business or strategy.",
                    href: '/chat',
                    complete: progress.hasChatted,
                },
            ];
            setSteps(built);
            setLoaded(true);

            const allDone = built.every(s => s.complete);
            const wasDismissed = (() => {
                try { return localStorage.getItem(DISMISSED_KEY) === 'true'; } catch { return false; }
            })();
            if (!allDone && !wasDismissed) setOpen(true);
        });
    }, [userId]);

    const completedCount = steps.filter(s => s.complete).length;
    const totalCount = steps.length;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const allDone = completedCount === totalCount;

    const handleDismiss = () => {
        setDismissed(true);
        setOpen(false);
        try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch { /* ignore */ }
    };

    // Don't render until position is known (avoids flash at wrong location)
    if (!loaded || pos === null) return null;

    const triggerStyle: React.CSSProperties = {
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: 800,
    };

    // Panel anchors just above the trigger
    const panelStyle: React.CSSProperties = {
        position: 'fixed',
        left: Math.min(pos.x, window.innerWidth - 360),
        top: Math.max(8, pos.y - 460),
        zIndex: 801,
    };

    // ── Dismissed: tiny trophy circle ──
    if (dismissed && !open) {
        return (
            <button
                ref={triggerRef}
                className={styles.miniTrigger}
                style={triggerStyle}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={() => {
                    if (!hasDragged) {
                        setDismissed(false);
                        setOpen(true);
                    }
                }}
                title="View getting started guide"
                aria-label="Open getting started checklist"
            >
                <Trophy size={16} />
                <div className={styles.miniProgress} style={{ width: `${percent}%` }} />
            </button>
        );
    }

    // ── Minimised bar ──
    if (!open) {
        return (
            <button
                ref={triggerRef}
                className={styles.trigger}
                style={triggerStyle}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={() => { if (!hasDragged) setOpen(true); }}
                aria-label="Open getting started checklist"
            >
                <span className={styles.triggerLeft}>
                    <Trophy size={16} />
                    <span>Get started</span>
                </span>
                <span className={styles.triggerBadge}>{completedCount}/{totalCount}</span>
                <ChevronUp size={14} className={styles.triggerChevron} />
            </button>
        );
    }

    // ── Expanded panel ──
    return (
        <>
            {/* Minimised trigger stays as drag anchor when panel is open */}
            <button
                ref={triggerRef}
                className={styles.trigger}
                style={{ ...triggerStyle, zIndex: 802 }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={() => { if (!hasDragged) setOpen(false); }}
                aria-label="Minimise checklist"
            >
                <span className={styles.triggerLeft}>
                    <Trophy size={16} />
                    <span>Get started</span>
                </span>
                <span className={styles.triggerBadge}>{completedCount}/{totalCount}</span>
                <ChevronUp size={14} />
            </button>

            <div className={styles.panel} style={panelStyle} role="dialog" aria-label="Getting started checklist">
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <Trophy size={18} className={styles.trophyIcon} />
                        <div>
                            <div className={styles.title}>
                                {allDone ? "🎉 You're all set!" : 'Get started with Billionaire Brother'}
                            </div>
                            <div className={styles.subtitle}>
                                {allDone
                                    ? "You've completed the getting started guide."
                                    : `${completedCount} of ${totalCount} steps completed`}
                            </div>
                        </div>
                    </div>
                    <button
                        className={styles.closeBtn}
                        onClick={() => setOpen(false)}
                        aria-label="Minimise checklist"
                    >
                        <ChevronUp size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                </div>

                {/* Progress bar */}
                <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${percent}%` }} />
                    <span className={styles.progressLabel}>{percent}%</span>
                </div>

                {/* Steps */}
                <ul className={styles.steps}>
                    {steps.map((step) => {
                        const nextIncomplete = steps.find(s => !s.complete);
                        const isNext = !step.complete && step.id === nextIncomplete?.id;
                        return (
                            <li
                                key={step.id}
                                className={`${styles.step} ${step.complete ? styles.stepDone : ''} ${isNext ? styles.stepNext : ''}`}
                            >
                                <div className={styles.stepIcon}>
                                    {step.complete ? (
                                        <CheckCircle2 size={20} className={styles.checkIcon} />
                                    ) : (
                                        <Circle size={20} className={styles.circleIcon} />
                                    )}
                                </div>
                                <div className={styles.stepBody}>
                                    <Link
                                        href={step.href}
                                        className={styles.stepTitle}
                                        onClick={() => setOpen(false)}
                                    >
                                        {step.title}
                                    </Link>
                                    <div className={styles.stepDesc}>{step.description}</div>
                                </div>
                                {isNext && (
                                    <Link
                                        href={step.href}
                                        className={styles.goBtn}
                                        onClick={() => setOpen(false)}
                                        aria-label={`Go to ${step.title}`}
                                    >
                                        Go →
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {/* Footer */}
                <div className={styles.footer}>
                    <button className={styles.dismissBtn} onClick={handleDismiss}>
                        Dismiss checklist
                    </button>
                </div>
            </div>
        </>
    );
}
