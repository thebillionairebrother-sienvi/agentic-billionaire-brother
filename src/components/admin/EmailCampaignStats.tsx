'use client';

import { useEffect, useState } from 'react';
import { Mail, Eye, MousePointerClick, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CampaignKpi, EmailKpisResponse } from '@/app/api/admin/email-kpis/route';
import styles from './EmailCampaignStats.module.css';

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        active:    'badge-green',
        completed: 'badge-blue',
        draft:     'badge-gold',
        paused:    'badge-gold',
        sending:   'badge-blue',
    };
    return (
        <span className={`badge ${map[status] ?? 'badge-blue'}`} style={{ textTransform: 'capitalize' }}>
            {status}
        </span>
    );
}

function DispatchBar({ dispatched, total }: { dispatched: number; total: number }) {
    const pct = total > 0 ? (dispatched / total) * 100 : 0;
    return (
        <div className={styles.dispatchWrap}>
            <span className={styles.dispatchLabel}>{dispatched}/{total} dispatched</span>
            <div className="progress-bar" style={{ width: '80px' }}>
                <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export function EmailCampaignStats() {
    const [data, setData] = useState<EmailKpisResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const [currentPage, setCurrentPage] = useState(1);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/email-kpis');
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to load');
            setData(json);
            setLastRefreshed(new Date());
            setCurrentPage(1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // ── Loading skeleton ──
    if (loading) {
        return (
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h3 className="heading-sm">Billionaire Brother Email Campaigns</h3>
                        <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                            Live stats from Sienvi emailer
                        </p>
                    </div>
                </div>
                <div className={styles.skeletonGrid}>
                    {[1, 2].map(i => (
                        <div key={i} className={`skeleton ${styles.skeletonCard}`} />
                    ))}
                </div>
            </section>
        );
    }

    // ── Error state ──
    if (error) {
        return (
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h3 className="heading-sm">Billionaire Brother Email Campaigns</h3>
                </div>
                <div className={`card ${styles.errorCard}`}>
                    <AlertCircle size={20} className={styles.errorIcon} />
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '4px' }}>Could not load email KPIs</p>
                        <p className="text-secondary" style={{ fontSize: 'var(--text-sm)' }}>{error}</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData} style={{ marginLeft: 'auto' }}>
                        <RefreshCw size={14} /> Retry
                    </button>
                </div>
            </section>
        );
    }

    // ── Empty state ──
    if (!data || data.campaigns.length === 0) {
        return (
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h3 className="heading-sm">Billionaire Brother Email Campaigns</h3>
                    <button className="btn btn-ghost btn-sm" onClick={fetchData}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
                <div className={`card ${styles.emptyCard}`}>
                    <Mail size={24} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                    <p className="text-secondary">No campaigns matching &quot;Billionaire Brother&quot; found in the emailer yet.</p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        Create a campaign in Sienvi emailer with &quot;Billionaire Brother&quot; in the name.
                    </p>
                </div>
            </section>
        );
    }

    const { campaigns, totals } = data;
    const itemsPerPage = 4;
    const totalPages = Math.ceil(campaigns.length / itemsPerPage);
    const paginatedCampaigns = campaigns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <section className={styles.section}>
            {/* Section header */}
            <div className={styles.sectionHeader}>
                <div>
                    <h3 className="heading-sm">Billionaire Brother Email Campaigns</h3>
                    <p className="text-secondary" style={{ fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                        Live stats from Sienvi emailer ·{' '}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                            {lastRefreshed.toLocaleTimeString()}
                        </span>
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={fetchData}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Aggregate totals row */}
            <div className={styles.totalsRow}>
                <div className={styles.totalItem}>
                    <Mail size={16} className={styles.totalIcon} style={{ color: 'var(--gold-400)' }} />
                    <span className={styles.totalValue}>{totals.totalSent.toLocaleString()}</span>
                    <span className={styles.totalLabel}>Total Sent</span>
                </div>
                <div className={styles.totalItem}>
                    <Eye size={16} className={styles.totalIcon} style={{ color: 'var(--accent-blue)' }} />
                    <span className={styles.totalValue}>{totals.avgOpenRate}%</span>
                    <span className={styles.totalLabel}>Avg Open Rate</span>
                </div>
                <div className={styles.totalItem}>
                    <MousePointerClick size={16} className={styles.totalIcon} style={{ color: 'var(--accent-purple)' }} />
                    <span className={styles.totalValue}>{totals.avgClickRate}%</span>
                    <span className={styles.totalLabel}>Avg CTR</span>
                </div>
            </div>

            {/* Per-campaign cards */}
            <div className={styles.campaignGrid}>
                {paginatedCampaigns.map((c: CampaignKpi) => (
                    <div key={c.campaign_id} className={`card ${styles.campaignCard}`}>
                        {/* Card header */}
                        <div className={styles.campaignHeader}>
                            <div className={styles.campaignMeta}>
                                <p className={styles.campaignName}>{c.campaign_name}</p>
                                <p className={styles.campaignDate}>
                                    Created {new Date(c.campaign_created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <StatusBadge status={c.campaign_status} />
                        </div>

                        {/* KPI grid */}
                        <div className={styles.kpiGrid}>
                            <div className={styles.kpiItem}>
                                <span className={styles.kpiVal}>{c.total_sent.toLocaleString()}</span>
                                <span className={styles.kpiLbl}>Sent</span>
                            </div>
                            <div className={styles.kpiItem}>
                                <span className={styles.kpiVal} style={{ color: 'var(--accent-blue)' }}>
                                    {c.open_rate}%
                                </span>
                                <span className={styles.kpiLbl}>Open Rate</span>
                            </div>
                            <div className={styles.kpiItem}>
                                <span className={styles.kpiVal} style={{ color: 'var(--accent-purple)' }}>
                                    {c.click_rate}%
                                </span>
                                <span className={styles.kpiLbl}>CTR</span>
                            </div>
                        </div>

                        {/* Dispatch progress */}
                        {c.total_sequences > 0 && (
                            <div className={styles.campaignFooter}>
                                <DispatchBar
                                    dispatched={c.dispatched_sequences}
                                    total={c.total_sequences}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className={styles.paginationRow}>
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <ChevronLeft size={14} /> Previous
                    </button>
                    <span className={styles.pageInfo}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        Next <ChevronRight size={14} />
                    </button>
                </div>
            )}
        </section>
    );
}
