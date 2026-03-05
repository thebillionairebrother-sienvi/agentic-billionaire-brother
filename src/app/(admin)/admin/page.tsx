'use client';

import { useEffect, useState } from 'react';
import { Users, Target, CheckCircle, DollarSign, UserCheck } from 'lucide-react';
import styles from './page.module.css';

interface UserData {
    id: string;
    email: string;
    display_name: string | null;
    onboarding_complete: boolean;
    subscription_status: string;
    created_at: string;
    business_name: string | null;
    industry: string | null;
    business_state: string | null;
    strategy_archetype: string | null;
    strategy_confidence: string | null;
    strategy_thesis: string | null;
    locked_kpi: string | null;
    tasks_total: number;
    tasks_done: number;
    tasks_in_progress: number;
    current_week: number;
    total_weeks: number;
    estimated_cost: number;
}

interface Stats {
    totalUsers: number;
    activeStrategies: number;
    totalTasksDone: number;
    totalCost: number;
    onboardedUsers: number;
}

export default function AdminDashboard() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/users');
                if (!res.ok) throw new Error('Failed to load admin data');
                const data = await res.json();
                setUsers(data.users);
                setStats(data.stats);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.page}>
                <div className={styles.errorState}>
                    <p>Error: {error}</p>
                </div>
            </div>
        );
    }

    const completionRate = stats && stats.totalTasksDone > 0
        ? Math.round((stats.totalTasksDone / users.reduce((s, u) => s + u.tasks_total, 0)) * 100) || 0
        : 0;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className="heading-lg">Admin Dashboard</h1>
                    <p className="text-secondary">
                        Overview of all users and their performance
                    </p>
                </div>
            </header>

            {/* Summary Stats */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                        <Users size={20} style={{ color: 'var(--accent-blue)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>{stats?.totalUsers || 0}</span>
                        <span className={styles.statLabel}>Total Users</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(234, 179, 8, 0.12)' }}>
                        <Target size={20} style={{ color: 'var(--gold-400)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>{stats?.activeStrategies || 0}</span>
                        <span className={styles.statLabel}>Active Strategies</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
                        <CheckCircle size={20} style={{ color: 'var(--accent-green)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>{stats?.totalTasksDone || 0}</span>
                        <span className={styles.statLabel}>Tasks Completed</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
                        <DollarSign size={20} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>${stats?.totalCost?.toFixed(4) || '0.00'}</span>
                        <span className={styles.statLabel}>Est. Total Cost</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
                        <UserCheck size={20} style={{ color: 'var(--accent-green)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>{stats?.onboardedUsers || 0}</span>
                        <span className={styles.statLabel}>Onboarded</span>
                    </div>
                </div>
            </div>

            {/* Performance Overview */}
            <div className={styles.chartSection}>
                <div className={`card ${styles.chartCard}`}>
                    <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>Onboarding Funnel</h3>
                    <div className={styles.funnelBars}>
                        <FunnelBar label="Registered" value={stats?.totalUsers || 0} max={stats?.totalUsers || 1} color="var(--accent-blue)" />
                        <FunnelBar label="Onboarded" value={stats?.onboardedUsers || 0} max={stats?.totalUsers || 1} color="var(--gold-400)" />
                        <FunnelBar label="Has Strategy" value={stats?.activeStrategies || 0} max={stats?.totalUsers || 1} color="var(--accent-green)" />
                    </div>
                </div>

                <div className={`card ${styles.chartCard}`}>
                    <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>Task Completion Rate</h3>
                    <div className={styles.donutContainer}>
                        <svg viewBox="0 0 120 120" className={styles.donut}>
                            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
                            <circle
                                cx="60" cy="60" r="50" fill="none"
                                stroke="var(--accent-green)"
                                strokeWidth="10"
                                strokeDasharray={`${(completionRate / 100) * 314} 314`}
                                strokeLinecap="round"
                                transform="rotate(-90 60 60)"
                                style={{ transition: 'stroke-dasharray 0.8s ease' }}
                            />
                            <text x="60" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="24" fontWeight="700" fontFamily="var(--font-mono)">
                                {completionRate}%
                            </text>
                            <text x="60" y="74" textAnchor="middle" fill="var(--text-tertiary)" fontSize="10">
                                completion
                            </text>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className={`card ${styles.tableCard}`}>
                <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>All Users</h3>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Business</th>
                                <th>Strategy</th>
                                <th>Tasks</th>
                                <th>Week</th>
                                <th>Est. Cost</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <>
                                    <tr
                                        key={u.id}
                                        className={styles.tableRow}
                                        onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                                    >
                                        <td>
                                            <div className={styles.userCell}>
                                                <div className={styles.userAvatar}>
                                                    {u.display_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className={styles.userName}>{u.display_name || 'No name'}</div>
                                                    <div className={styles.userEmail}>{u.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className={styles.businessCell}>
                                                <span>{u.business_name || '—'}</span>
                                                {u.industry && <span className={styles.subText}>{u.industry}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            {u.strategy_archetype ? (
                                                <span className={`badge ${u.strategy_confidence === 'high' ? 'badge-green' : u.strategy_confidence === 'medium' ? 'badge-gold' : 'badge-red'}`}>
                                                    {u.strategy_archetype}
                                                </span>
                                            ) : (
                                                <span className="text-tertiary">—</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className={styles.taskCell}>
                                                <span>{u.tasks_done}/{u.tasks_total}</span>
                                                {u.tasks_total > 0 && (
                                                    <div className={styles.miniBar}>
                                                        <div
                                                            className={styles.miniBarFill}
                                                            style={{ width: `${(u.tasks_done / u.tasks_total) * 100}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="font-mono">{u.current_week || '—'}</span>
                                        </td>
                                        <td>
                                            <span className="font-mono">${u.estimated_cost.toFixed(4)}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${u.onboarding_complete ? 'badge-green' : 'badge-gold'}`}>
                                                {u.onboarding_complete ? 'Active' : 'Onboarding'}
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedUser === u.id && (
                                        <tr key={`${u.id}-detail`} className={styles.expandedRow}>
                                            <td colSpan={7}>
                                                <div className={styles.expandedContent}>
                                                    <div className={styles.detailGrid}>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Strategy</span>
                                                            <span>{u.strategy_archetype || 'No strategy yet'}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Thesis</span>
                                                            <span>{u.strategy_thesis || '—'}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Locked KPI</span>
                                                            <span>{u.locked_kpi || '—'}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Business State</span>
                                                            <span>{u.business_state || '—'}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Tasks In Progress</span>
                                                            <span>{u.tasks_in_progress}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Total Weeks</span>
                                                            <span>{u.total_weeks}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Joined</span>
                                                            <span>{new Date(u.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className={styles.detailItem}>
                                                            <span className={styles.detailLabel}>Subscription</span>
                                                            <span className={`badge ${u.subscription_status === 'active' ? 'badge-green' : 'badge-red'}`}>
                                                                {u.subscription_status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="disclaimer" style={{ marginTop: 'var(--space-6)' }}>
                <span>⚠️</span>
                <span>
                    API cost estimates are heuristic-based approximations using Gemini 2.0 Flash pricing. Actual costs may vary.
                </span>
            </div>
        </div>
    );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className={styles.funnelItem}>
            <div className={styles.funnelLabel}>
                <span>{label}</span>
                <span className="font-mono">{value}</span>
            </div>
            <div className={styles.funnelTrack}>
                <div
                    className={styles.funnelFill}
                    style={{ width: `${pct}%`, background: color, transition: 'width 0.6s ease' }}
                />
            </div>
        </div>
    );
}
