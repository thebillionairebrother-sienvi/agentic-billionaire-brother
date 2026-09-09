'use client';

import React, { useEffect, useState } from 'react';
import {
    Activity, Globe, Users, ShieldAlert, FileText,
    ExternalLink, RefreshCw, ChevronDown, ChevronUp, Layers, CheckCircle2, AlertTriangle,
    Search, X
} from 'lucide-react';
import type { ExtensionStatsData, ExtensionAuditSummary } from '@/app/api/admin/extension-stats/route';
import styles from './ExtensionAnalytics.module.css';

export function ExtensionAnalytics() {
    const [data, setData] = useState<ExtensionStatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleCount, setVisibleCount] = useState(5);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/extension-stats');
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to load extension analytics');
            }
            setData(json.data);
            setLastRefreshed(new Date());
        } catch (err: any) {
            setError(err.message || 'Error fetching extension analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleAudit = (id: string) => {
        setExpandedAuditId(prev => (prev === id ? null : id));
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getRiskBadgeClass = (risk?: string) => {
        const r = (risk || '').toLowerCase();
        if (r.includes('high')) return 'badge-red';
        if (r.includes('med')) return 'badge-gold';
        return 'badge-green';
    };

    const getScopeBadgeClass = (scope: string) => {
        if (scope === 'domain') return 'badge-purple';
        if (scope === 'subpath') return 'badge-blue';
        return 'badge-gold';
    };

    const totalActions = (data?.telemetryCounts.sidepanelOpens || 0) +
        (data?.telemetryCounts.pdfExports || 0) +
        (data?.telemetryCounts.textCopies || 0);

    const filteredAudits = (data?.recentAudits || []).filter(audit => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const userMatch = audit.userEmail.toLowerCase().includes(q) || audit.userName.toLowerCase().includes(q);
        const scopeMatch = audit.scope.toLowerCase().includes(q);
        const domainMatch = audit.domain.toLowerCase().includes(q) || audit.url.toLowerCase().includes(q);
        const riskMatch = audit.complianceRisk.toLowerCase().includes(q);
        return userMatch || scopeMatch || domainMatch || riskMatch;
    });

    const displayedAudits = filteredAudits.slice(0, visibleCount);
    const hasMore = visibleCount < filteredAudits.length;

    return (
        <section className={styles.section}>
            {/* Header */}
            <div className={styles.sectionHeader}>
                <div className={styles.headerTitleWrap}>
                    <div className={styles.titleRow}>
                        <h2 className="heading-sm">Chrome Extension Analytics</h2>
                        <span className={styles.liveBadge}>
                            <span className={styles.liveDot} />
                            Live Telemetry
                        </span>
                    </div>
                    <p className="text-secondary" style={{ fontSize: '13px' }}>
                        Real-time audits, feature adoption, and domains inspected across all extension users
                    </p>
                </div>

                <div className={styles.headerActions}>
                    <a
                        href="https://analytics.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.gaLinkBtn}
                        title="Open Google Analytics 4 Dashboard"
                    >
                        <span>Google Analytics 4</span>
                        <ExternalLink size={13} />
                    </a>

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className={styles.refreshBtn}
                        title="Refresh extension analytics"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
                    <p>Failed to load extension statistics: {error}</p>
                </div>
            )}

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ color: 'var(--gold-400)' }}>
                        <Activity size={20} />
                    </div>
                    <div className={styles.kpiContent}>
                        <span className={styles.kpiValue}>{data?.totalAudits ?? 0}</span>
                        <span className={styles.kpiLabel}>Total Audits Run</span>
                        <span className={styles.kpiSubtext}>
                            {data?.successRate ?? 100}% success rate ({data?.completedAudits ?? 0} completed)
                        </span>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ color: 'var(--accent-blue)' }}>
                        <Users size={20} />
                    </div>
                    <div className={styles.kpiContent}>
                        <span className={styles.kpiValue}>{data?.uniqueUsers ?? 0}</span>
                        <span className={styles.kpiLabel}>Active Extension Users</span>
                        <span className={styles.kpiSubtext}>Unique accounts auditing</span>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ color: 'var(--accent-green)' }}>
                        <Globe size={20} />
                    </div>
                    <div className={styles.kpiContent}>
                        <span className={styles.kpiValue}>{data?.audits7d ?? 0}</span>
                        <span className={styles.kpiLabel}>Audits (Last 7 Days)</span>
                        <span className={styles.kpiSubtext}>
                            {data?.audits24h ?? 0} audits in the past 24 hours
                        </span>
                    </div>
                </div>

                <div className={styles.kpiCard}>
                    <div className={styles.kpiIcon} style={{ color: 'var(--accent-purple, #a855f7)' }}>
                        <FileText size={20} />
                    </div>
                    <div className={styles.kpiContent}>
                        <span className={styles.kpiValue}>{totalActions}</span>
                        <span className={styles.kpiLabel}>User Interactions</span>
                        <span className={styles.kpiSubtext}>
                            {data?.telemetryCounts.sidepanelOpens ?? 0} opens · {data?.telemetryCounts.pdfExports ?? 0} PDFs
                        </span>
                    </div>
                </div>
            </div>

            {/* Insights Row */}
            <div className={styles.insightsGrid}>
                {/* 1. Scopes Breakdown */}
                <div className={styles.insightCard}>
                    <div className={styles.insightTitle}>
                        <Layers size={16} style={{ color: 'var(--gold-400)' }} />
                        <span>Audit Scope Breakdown</span>
                    </div>
                    <div className={styles.distList}>
                        {(() => {
                            const total = data?.totalAudits || 1;
                            const pagePct = Math.round(((data?.scopeCounts.page || 0) / total) * 100);
                            const domainPct = Math.round(((data?.scopeCounts.domain || 0) / total) * 100);
                            const subpathPct = Math.round(((data?.scopeCounts.subpath || 0) / total) * 100);
                            return (
                                <>
                                    <div className={styles.distItem}>
                                        <div className={styles.distLabelRow}>
                                            <span className={styles.distLabel}>Single Active Page</span>
                                            <span className={styles.distValue}>{data?.scopeCounts.page || 0} ({pagePct}%)</span>
                                        </div>
                                        <div className={styles.distTrack}>
                                            <div className={styles.distFill} style={{ width: `${pagePct}%`, background: 'var(--gold-400)' }} />
                                        </div>
                                    </div>

                                    <div className={styles.distItem}>
                                        <div className={styles.distLabelRow}>
                                            <span className={styles.distLabel}>Whole Site (Domain)</span>
                                            <span className={styles.distValue}>{data?.scopeCounts.domain || 0} ({domainPct}%)</span>
                                        </div>
                                        <div className={styles.distTrack}>
                                            <div className={styles.distFill} style={{ width: `${domainPct}%`, background: '#a855f7' }} />
                                        </div>
                                    </div>

                                    <div className={styles.distItem}>
                                        <div className={styles.distLabelRow}>
                                            <span className={styles.distLabel}>Sub-paths / Sections</span>
                                            <span className={styles.distValue}>{data?.scopeCounts.subpath || 0} ({subpathPct}%)</span>
                                        </div>
                                        <div className={styles.distTrack}>
                                            <div className={styles.distFill} style={{ width: `${subpathPct}%`, background: 'var(--accent-blue)' }} />
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* 2. Compliance Risk Breakdown */}
                <div className={styles.insightCard}>
                    <div className={styles.insightTitle}>
                        <ShieldAlert size={16} style={{ color: 'var(--accent-red)' }} />
                        <span>Compliance & Legal Risk</span>
                    </div>
                    <div className={styles.distList}>
                        {(() => {
                            const completed = data?.completedAudits || 1;
                            const lowPct = Math.round(((data?.riskCounts.low || 0) / completed) * 100);
                            const medPct = Math.round(((data?.riskCounts.medium || 0) / completed) * 100);
                            const highPct = Math.round(((data?.riskCounts.high || 0) / completed) * 100);
                            return (
                                <>
                                    <div className={styles.distItem}>
                                        <div className={styles.distLabelRow}>
                                            <span className={styles.distLabel}>Low Risk / Clean</span>
                                            <span className={styles.distValue}>{data?.riskCounts.low || 0} ({lowPct}%)</span>
                                        </div>
                                        <div className={styles.distTrack}>
                                            <div className={styles.distFill} style={{ width: `${lowPct}%`, background: 'var(--accent-green)' }} />
                                        </div>
                                    </div>

                                    <div className={styles.distItem}>
                                        <div className={styles.distLabelRow}>
                                            <span className={styles.distLabel}>Medium Risk Findings</span>
                                            <span className={styles.distValue}>{data?.riskCounts.medium || 0} ({medPct}%)</span>
                                        </div>
                                        <div className={styles.distTrack}>
                                            <div className={styles.distFill} style={{ width: `${medPct}%`, background: 'var(--gold-400)' }} />
                                        </div>
                                    </div>

                                    <div className={styles.distItem}>
                                        <div className={styles.distLabelRow}>
                                            <span className={styles.distLabel}>High Risk Disclaimers</span>
                                            <span className={styles.distValue}>{data?.riskCounts.high || 0} ({highPct}%)</span>
                                        </div>
                                        <div className={styles.distTrack}>
                                            <div className={styles.distFill} style={{ width: `${highPct}%`, background: 'var(--accent-red)' }} />
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* 3. Top Audited Domains */}
                <div className={styles.insightCard}>
                    <div className={styles.insightTitle}>
                        <Globe size={16} style={{ color: 'var(--accent-blue)' }} />
                        <span>Top Audited Domains</span>
                    </div>
                    {data?.topDomains && data.topDomains.length > 0 ? (
                        <div className={styles.domainList}>
                            {data.topDomains.map(item => (
                                <div key={item.domain} className={styles.domainRow}>
                                    <span className={styles.domainName} title={item.domain}>
                                        {item.domain}
                                    </span>
                                    <span className={styles.domainBadge}>
                                        {item.count} {item.count === 1 ? 'audit' : 'audits'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.emptyState}>No domain data yet</div>
                    )}
                </div>
            </div>

            {/* Recent Audits Table with Search and Show More */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeaderRow}>
                    <div className={styles.insightTitle} style={{ marginBottom: 0 }}>
                        <Activity size={16} style={{ color: 'var(--gold-400)' }} />
                        <span>Recent Extension Audits Activity</span>
                    </div>

                    <div className={styles.searchWrap}>
                        <Search size={14} className={styles.searchIcon} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setVisibleCount(5); // Reset visible count to 5 on filter change
                            }}
                            placeholder="Search by user, scope, or domain..."
                            className={styles.searchInput}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setVisibleCount(5);
                                }}
                                className={styles.clearSearchBtn}
                                title="Clear search"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>User</th>
                                <th>Target Website</th>
                                <th>Scope</th>
                                <th>Risk</th>
                                <th>Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedAudits.length > 0 ? (
                                displayedAudits.map((audit: ExtensionAuditSummary) => {
                                    const isExpanded = expandedAuditId === audit.id;
                                    return (
                                        <React.Fragment key={audit.id}>
                                            <tr className={styles.tableRow} onClick={() => toggleAudit(audit.id)}>
                                                <td style={{ whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>
                                                    {formatDate(audit.createdAt)}
                                                </td>
                                                <td>
                                                    <div className={styles.userCell}>
                                                        <span style={{ fontWeight: 600 }}>{audit.userName}</span>
                                                        <span className={styles.userEmail}>{audit.userEmail}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={styles.domainCell}>
                                                        <span style={{ fontWeight: 600 }}>{audit.domain}</span>
                                                        <span className={styles.targetUrl} title={audit.url}>
                                                            {audit.title || audit.url}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getScopeBadgeClass(audit.scope)}`} style={{ textTransform: 'capitalize' }}>
                                                        {audit.scope}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${getRiskBadgeClass(audit.complianceRisk)}`} style={{ textTransform: 'capitalize' }}>
                                                        {audit.complianceRisk}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${audit.status === 'completed' ? 'badge-green' : audit.status === 'failed' ? 'badge-red' : 'badge-blue'}`} style={{ textTransform: 'capitalize' }}>
                                                        {audit.status}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        type="button"
                                                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                                        aria-label="Toggle details"
                                                    >
                                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                </td>
                                            </tr>

                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={7} style={{ padding: 0 }}>
                                                        <div className={styles.expandDetail}>
                                                            <div className={styles.detailGrid}>
                                                                {audit.whatThisPageSells && (
                                                                    <div className={styles.detailBlock}>
                                                                        <span className={styles.detailLabel}>What This Page Sells</span>
                                                                        <p className={styles.detailText}>{audit.whatThisPageSells}</p>
                                                                    </div>
                                                                )}

                                                                {audit.bestNextMove && (
                                                                    <div className={styles.detailBlock}>
                                                                        <span className={styles.detailLabel}>Derek's Best Next Move</span>
                                                                        <p className={styles.detailText}>{audit.bestNextMove}</p>
                                                                    </div>
                                                                )}

                                                                {audit.topConversionLeaks && audit.topConversionLeaks.length > 0 && (
                                                                    <div className={styles.detailBlock}>
                                                                        <span className={styles.detailLabel}>Top Conversion Leaks</span>
                                                                        <ul className={styles.leakList}>
                                                                            {audit.topConversionLeaks.map((leak, i) => (
                                                                                <li key={i}>{leak}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}

                                                                {audit.errorMessage && (
                                                                    <div className={styles.detailBlock} style={{ color: 'var(--accent-red)' }}>
                                                                        <span className={styles.detailLabel} style={{ color: 'var(--accent-red)' }}>Failure Reason</span>
                                                                        <p className={styles.detailText}>{audit.errorMessage}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className={styles.emptyState}>
                                        {searchQuery ? (
                                            <>No extension audits matching &quot;{searchQuery}&quot; found.</>
                                        ) : (
                                            <>No extension audits recorded yet. Open the extension and run an audit to see live telemetry!</>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination / Show More */}
                {filteredAudits.length > 0 && (
                    <div className={styles.paginationFooter}>
                        <span className={styles.showingCount}>
                            Showing {Math.min(visibleCount, filteredAudits.length)} of {filteredAudits.length} audits
                            {searchQuery && ` (filtered from ${data?.recentAudits.length || 0} total)`}
                        </span>

                        {hasMore ? (
                            <button
                                type="button"
                                onClick={() => setVisibleCount(prev => prev + 5)}
                                className={styles.showMoreBtn}
                            >
                                <span>Show More (+5)</span>
                                <ChevronDown size={14} />
                            </button>
                        ) : (
                            filteredAudits.length > 5 && (
                                <span className={styles.showingCount} style={{ fontStyle: 'italic' }}>
                                    All {filteredAudits.length} matching audits displayed
                                </span>
                            )
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
