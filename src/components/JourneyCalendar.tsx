'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './JourneyCalendar.module.css';

interface DayData {
    total: number;
    done: number;
}

interface Stats {
    byDate: Record<string, DayData>;
    startDate: string | null;
}

function toDateStr(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function JourneyCalendar() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [viewMonth, setViewMonth] = useState(new Date());
    const router = useRouter();

    useEffect(() => {
        fetch('/api/tasks/stats')
            .then((r) => r.json())
            .then((d) => setStats(d))
            .catch(console.error);
    }, []);

    const today = new Date();
    const todayStr = toDateStr(today);

    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    // Calendar grid
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

    const monthLabel = viewMonth.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const startDate = stats?.startDate ? new Date(stats.startDate) : null;
    const startStr = stats?.startDate || '';

    // Count journey days
    const journeyDays = startDate
        ? Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 0;

    const handleDayClick = (dateStr: string) => {
        router.push(`/ship-pack?date=${dateStr}`);
    };

    const getDayClass = (dateStr: string): string => {
        const classes = [styles.day];
        const dayData = stats?.byDate[dateStr];

        if (dateStr === todayStr) classes.push(styles.today);
        if (dateStr === startStr) classes.push(styles.startDay);

        if (dayData) {
            if (dayData.done === dayData.total) {
                classes.push(styles.allDone);
            } else if (dayData.done > 0) {
                classes.push(styles.partial);
            } else {
                classes.push(styles.hasTasks);
            }
        }

        // Future days
        if (dateStr > todayStr) classes.push(styles.future);

        return classes.join(' ');
    };

    if (!stats) {
        return (
            <div className={`card ${styles.card}`}>
                <div className={styles.skeleton} />
            </div>
        );
    }

    return (
        <div className={`card ${styles.card}`}>
            <div className={styles.headerRow}>
                <h3 className="heading-sm">Your Journey</h3>
                {journeyDays > 0 && (
                    <span className={styles.journeyBadge}>Day {journeyDays}</span>
                )}
            </div>

            {/* Month nav */}
            <div className={styles.monthNav}>
                <button onClick={prevMonth} className={styles.navBtn}>
                    <ChevronLeft size={16} />
                </button>
                <span className={styles.monthLabel}>{monthLabel}</span>
                <button onClick={nextMonth} className={styles.navBtn}>
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Calendar grid */}
            <div className={styles.grid}>
                {dayLabels.map((dl) => (
                    <div key={dl} className={styles.dayLabel}>
                        {dl}
                    </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className={styles.emptySlot} />
                ))}

                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const d = new Date(year, month, dayNum);
                    const dateStr = toDateStr(d);
                    const dayData = stats?.byDate[dateStr];

                    return (
                        <button
                            key={dayNum}
                            className={getDayClass(dateStr)}
                            onClick={() => handleDayClick(dateStr)}
                            title={
                                dayData
                                    ? `${dayData.done}/${dayData.total} tasks done`
                                    : dateStr
                            }
                        >
                            <span className={styles.dayNum}>{dayNum}</span>
                            {dayData && (
                                <span className={styles.dayDot} />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className={styles.legend}>
                <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.allDone}`} />
                    <span>All done</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.partial}`} />
                    <span>In progress</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.hasTasks}`} />
                    <span>Pending</span>
                </div>
            </div>
        </div>
    );
}
