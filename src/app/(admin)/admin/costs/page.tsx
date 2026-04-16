'use client';

import { useEffect, useState } from 'react';
import { DollarSign, Users, Activity, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import styles from './page.module.css';

interface Summary {
    totalAISpend: number;
    avgCostPerUser: number;
    activeUsers: number;
    totalUsers: number;
    projectedMargin: number;
    estimatedMonthlyRevenue: number;
    alertCount: number;
}

interface UserCost {
    userId: string;
    email: string;
    displayName: string | null;
    tier: string;
    monthlyCost: number;
    capPct: number;
    cap: number;
}

interface EndpointCost {
    endpoint: string;
    cost: number;
    count: number;
    inputTokens: number;
    outputTokens: number;
}

interface Alert {
    id: string;
    userId: string;
    alertType: string;
    thresholdPct: number;
    currentValue: number;
    capValue: number;
    createdAt: string;
    email: string;
}

interface CostData {
    month: string;
    summary: Summary;
    perUserCosts: UserCost[];
    perEndpoint: EndpointCost[];
    tierTotals: Record<string, { cost: number; count: number; users: number }>;
    alerts: Alert[];
    thresholds: {
        warningPct: number;
        degradePct: number;
        hardStopPct: number;
        perUserAlert: number;
        targetMargin: number;
    };
}

export default function CostDashboard() {
    const [data, setData] = useState<CostData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/costs');
                if (!res.ok) throw new Error('Failed to load cost data');
                const json = await res.json();
                setData(json);
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
                    <p>Loading cost dashboard...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={styles.page}>
                <div className={styles.errorState}>
                    <p>Error: {error}</p>
                </div>
            </div>
        );
    }

    const { summary, perUserCosts, perEndpoint, tierTotals, alerts, thresholds } = data;

    // Tier donut data
    const tierEntries = Object.entries(tierTotals);
    const totalTierCost = tierEntries.reduce((s, [, v]) => s + v.cost, 0);
    const fallbackColors = [
        'var(--accent-green)',
        'var(--gold-400)',
        '#ef4444',
        '#f97316',
        '#06b6d4',
    ];
    const getTierColor = (tier: string, index: number) => {
        const tierColors: Record<string, string> = {
            brother: 'var(--accent-blue)',
            team: 'var(--accent-purple)',
        };
        return tierColors[tier] || fallbackColors[index % fallbackColors.length];
    };

    // Max endpoint cost for bar scaling
    const maxEndpointCost = perEndpoint.length > 0 ? perEndpoint[0].cost : 1;

    // Margin color
    const marginClass = summary.projectedMargin >= thresholds.targetMargin
        ? styles.marginGood
        : summary.projectedMargin >= 70
            ? styles.marginWarn
            : styles.marginBad;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className="heading-lg">Cost Monitor</h1>
                    <div className={styles.headerMeta}>
                        <span className="text-secondary">
                            Month: <strong style={{ fontFamily: 'var(--font-mono)' }}>{data.month}</strong>
                        </span>
                    </div>
                </div>
            </header>

            {/* Summary Stats */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(139, 92, 246, 0.12)' }}>
                        <DollarSign size={20} style={{ color: 'var(--accent-purple)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>${summary.totalAISpend.toFixed(4)}</span>
                        <span className={styles.statLabel}>Total AI Spend</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                        <Users size={20} style={{ color: 'var(--accent-blue)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>${summary.avgCostPerUser.toFixed(4)}</span>
                        <span className={styles.statLabel}>Avg Cost / User</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
                        <TrendingUp size={20} style={{ color: 'var(--accent-green)' }} />
                    </div>
                    <div>
                        <span className={`${styles.statValue} ${marginClass}`}>
                            {summary.projectedMargin.toFixed(1)}%
                        </span>
                        <span className={styles.statLabel}>Projected Margin</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon} style={{ background: alerts.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(234, 179, 8, 0.12)' }}>
                        <AlertTriangle size={20} style={{ color: alerts.length > 0 ? '#ef4444' : 'var(--gold-400)' }} />
                    </div>
                    <div>
                        <span className={styles.statValue}>{alerts.length}</span>
                        <span className={styles.statLabel}>Active Alerts</span>
                    </div>
                </div>
            </div>

            {/* Margin Projection */}
            <div className={`card ${styles.marginCard}`}>
                <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>Margin Projection</h3>
                <div className={styles.marginGrid}>
                    <div className={styles.marginItem}>
                        <span className={styles.marginLabel}>Est. Monthly Revenue</span>
                        <span className={`${styles.marginValue}`}>
                            ${summary.estimatedMonthlyRevenue.toLocaleString()}
                        </span>
                    </div>
                    <div className={styles.marginItem}>
                        <span className={styles.marginLabel}>Variable AI Cost</span>
                        <span className={styles.marginValue}>
                            ${summary.totalAISpend.toFixed(2)}
                        </span>
                    </div>
                    <div className={styles.marginItem}>
                        <span className={styles.marginLabel}>Gross Margin</span>
                        <span className={`${styles.marginValue} ${marginClass}`}>
                            {summary.projectedMargin.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts: Tier Breakdown + Endpoint Costs */}
            <div className={styles.chartSection}>
                <div className={`card ${styles.chartCard}`}>
                    <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>Cost by Tier</h3>
                    {tierEntries.length > 0 ? (
                        <div className={styles.donutContainer}>
                            <svg viewBox="0 0 120 120" className={styles.donut}>
                                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
                                {(() => {
                                    let offset = 0;
                                    return tierEntries.map(([tier, val], index) => {
                                        const pct = totalTierCost > 0 ? val.cost / totalTierCost : 0;
                                        const dashLen = pct * 314;
                                        const el = (
                                            <circle
                                                key={tier}
                                                cx="60" cy="60" r="50" fill="none"
                                                stroke={getTierColor(tier, index)}
                                                strokeWidth="10"
                                                strokeDasharray={`${dashLen} 314`}
                                                strokeDashoffset={-offset}
                                                strokeLinecap="round"
                                                transform="rotate(-90 60 60)"
                                                style={{ transition: 'stroke-dasharray 0.8s ease' }}
                                            />
                                        );
                                        offset += dashLen;
                                        return el;
                                    });
                                })()}
                                <text x="60" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="16" fontWeight="700" fontFamily="var(--font-mono)">
                                    ${totalTierCost.toFixed(2)}
                                </text>
                                <text x="60" y="72" textAnchor="middle" fill="var(--text-tertiary)" fontSize="9">
                                    total spend
                                </text>
                            </svg>
                            <div className={styles.legendList}>
                                {tierEntries.map(([tier, val], index) => (
                                    <div key={tier} className={styles.legendItem}>
                                        <span className={styles.legendDot} style={{ background: getTierColor(tier, index) }} />
                                        <span style={{ textTransform: 'capitalize' }}>{tier}</span>
                                        <span className={styles.legendValue}>${val.cost.toFixed(4)}</span>
                                        <span className="text-tertiary">({val.users} users)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.emptyAlerts}>No usage data yet this month</div>
                    )}
                </div>

                <div className={`card ${styles.chartCard}`}>
                    <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>Cost by Endpoint</h3>
                    <div className={styles.barList}>
                        {perEndpoint.slice(0, 8).map(ep => (
                            <div key={ep.endpoint} className={styles.barItem}>
                                <div className={styles.barLabel}>
                                    <span className={styles.barLabelName}>{ep.endpoint}</span>
                                    <span className={styles.barLabelValue}>${ep.cost.toFixed(4)} ({ep.count})</span>
                                </div>
                                <div className={styles.barTrack}>
                                    <div
                                        className={styles.barFill}
                                        style={{ width: `${(ep.cost / maxEndpointCost) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {perEndpoint.length === 0 && (
                            <div className={styles.emptyAlerts}>No requests logged this month</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cost Alerts */}
            <div className={`card ${styles.alertsCard}`}>
                <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>
                    <AlertTriangle size={16} style={{ display: 'inline', marginRight: 'var(--space-2)', verticalAlign: 'middle' }} />
                    Cost Alerts
                </h3>
                {alerts.length > 0 ? (
                    <div className={styles.alertsList}>
                        {alerts.map(alert => (
                            <div
                                key={alert.id}
                                className={`${styles.alertItem} ${alert.alertType === 'hard_stop' ? styles.alertHardStop
                                        : alert.alertType === 'degrade' ? styles.alertDegrade
                                            : styles.alertWarning
                                    }`}
                            >
                                <Zap size={16} style={{
                                    color: alert.alertType === 'hard_stop' ? '#ef4444'
                                        : alert.alertType === 'degrade' ? '#f97316'
                                            : 'var(--gold-400)',
                                    flexShrink: 0,
                                }} />
                                <div className={styles.alertMeta}>
                                    <span className={styles.alertEmail}>{alert.email}</span>
                                    <span className={styles.alertDetail}>
                                        {alert.alertType.toUpperCase()} — ${alert.currentValue.toFixed(4)} / ${alert.capValue.toFixed(2)} ({alert.thresholdPct}%)
                                    </span>
                                </div>
                                <span className="text-tertiary" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                                    {new Date(alert.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyAlerts}>
                        ✅ No active alerts — all users within budget
                    </div>
                )}
            </div>

            {/* Top Users Table */}
            <div className={`card ${styles.tableCard}`}>
                <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>Top Users by Cost</h3>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Tier</th>
                                <th>Monthly Cost</th>
                                <th>Budget Used</th>
                                <th>Cap</th>
                            </tr>
                        </thead>
                        <tbody>
                            {perUserCosts.filter(u => u.monthlyCost > 0).map(u => {
                                const fillColor = u.capPct >= 100 ? '#ef4444'
                                    : u.capPct >= 80 ? '#f97316'
                                        : u.capPct >= 60 ? 'var(--gold-400)'
                                            : 'var(--accent-green)';
                                return (
                                    <tr key={u.userId} className={styles.tableRow}>
                                        <td>
                                            <div>
                                                <div style={{ fontWeight: 500 }}>{u.displayName || 'No name'}</div>
                                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{u.email}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${u.tier === 'team' ? 'badge-purple' : 'badge-blue'}`} style={{ textTransform: 'capitalize' }}>
                                                {u.tier}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="font-mono">${u.monthlyCost.toFixed(4)}</span>
                                        </td>
                                        <td>
                                            <div className={styles.usageBar}>
                                                <div className={styles.usageTrack}>
                                                    <div
                                                        className={styles.usageFill}
                                                        style={{
                                                            width: `${Math.min(u.capPct, 100)}%`,
                                                            background: fillColor,
                                                        }}
                                                    />
                                                </div>
                                                <span className={styles.usagePct} style={{ color: fillColor }}>
                                                    {u.capPct}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="font-mono">${u.cap.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {perUserCosts.filter(u => u.monthlyCost > 0).length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 'var(--space-6)' }}>
                                        No usage recorded this month
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="disclaimer" style={{ marginTop: 'var(--space-6)' }}>
                <span>💰</span>
                <span>
                    Costs shown use budgeted pricing (2.5× safety margin). Actual costs are lower.
                    Target gross margin: {thresholds.targetMargin}%.
                </span>
            </div>
        </div>
    );
}
