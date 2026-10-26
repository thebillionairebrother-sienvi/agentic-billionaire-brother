'use client';

import { useEffect, useState } from 'react';
import {
    Crown, History, Users, CalendarDays, CalendarRange, UserPlus, UserMinus,
    Layers, Star, TrendingUp, ExternalLink, RefreshCw
} from 'lucide-react';
import type { ExtensionGrowthData, WindowCount } from '@/lib/extension-growth';
import styles from './ExtensionGrowthCard.module.css';

const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function Delta({ count, label, invert = false }: { count: WindowCount; label: string; invert?: boolean }) {
    const diff = count.current - count.previous;
    if (diff === 0) return <span className={styles.deltaFlat}>no change {label}</span>;
    const good = invert ? diff < 0 : diff > 0;
    return (
        <span className={good ? styles.deltaUp : styles.deltaDown} title={`Previous period: ${count.previous}`}>
            {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()} <span className={styles.deltaLabel}>{label}</span>
        </span>
    );
}

function StatRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className={styles.row}>
            <span className={styles.rowIcon}>{icon}</span>
            <span className={styles.rowLabel}>{label}:</span>
            <span className={styles.rowValue}>{children}</span>
        </div>
    );
}

export function ExtensionGrowthCard() {
    const [data, setData] = useState<ExtensionGrowthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/extension-growth');
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to load extension growth metrics');
            }
            setData(json.data);
        } catch (err: unknown) {
            setError((err instanceof Error && err.message) || 'Error fetching extension growth metrics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <section className={styles.section}>
            <div className={styles.sectionHeader}>
                <div>
                    <h2 className="heading-sm">Chrome Web Store Growth</h2>
                    <p className="text-secondary" style={{ fontSize: '13px' }}>
                        Live version from Google&apos;s update server; users, installs and uninstalls from extension telemetry
                    </p>
                </div>
                <button onClick={fetchData} disabled={loading} className={styles.refreshBtn} title="Refresh growth metrics">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
                    <p>Failed to load extension growth metrics: {error}</p>
                </div>
            )}

            <div className={styles.card}>
                <div className={styles.titleRow}>
                    <span className={styles.logo}><Crown size={20} /></span>
                    <a
                        href={data?.storeUrl ?? 'https://chromewebstore.google.com/'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.title}
                    >
                        Billionaire Brother Execution Engine
                        <ExternalLink size={14} />
                    </a>
                </div>

                <div className={styles.rows}>
                    <StatRow icon={<History size={18} />} label="Version">
                        {data?.liveVersion ? (
                            <>
                                <span className={styles.number}>{data.liveVersion}</span>
                                <span className={styles.pill}>First seen: {formatDate(data.liveVersionFirstSeen)}</span>
                            </>
                        ) : (
                            <span className={styles.muted}>{loading ? '…' : 'Update server unreachable'}</span>
                        )}
                    </StatRow>

                    <StatRow icon={<Users size={18} />} label="Active users (24h)">
                        <span className={styles.number}>{data?.activeUsers.day.current ?? 0}</span>
                        {data && <Delta count={data.activeUsers.day} label="vs previous 24h" />}
                    </StatRow>

                    <StatRow icon={<CalendarDays size={18} />} label="Active users (7d)">
                        <span className={styles.number}>{data?.activeUsers.week.current ?? 0}</span>
                        {data && <Delta count={data.activeUsers.week} label="vs previous 7d" />}
                    </StatRow>

                    <StatRow icon={<CalendarRange size={18} />} label="Active users (30d)">
                        <span className={styles.number}>{data?.activeUsers.month.current ?? 0}</span>
                        {data && <Delta count={data.activeUsers.month} label="vs previous 30d" />}
                    </StatRow>

                    <StatRow icon={<Layers size={18} />} label="On live version (30d)">
                        {data && data.clientsOnLiveVersion === null ? (
                            <span className={styles.muted}>Available once v1.0.19 is in use</span>
                        ) : (
                            <>
                                <span className={styles.number}>{data?.clientsOnLiveVersion ?? 0}</span>
                                <span className={styles.muted}>of {data?.activeUsers.month.current ?? 0} active</span>
                            </>
                        )}
                    </StatRow>

                    <StatRow icon={<UserPlus size={18} />} label="Installs (30d)">
                        <span className={styles.number}>{data?.installs.current ?? 0}</span>
                        {data && <Delta count={data.installs} label="vs previous 30d" />}
                        <span className={styles.muted}>· {data?.totalInstalls ?? 0} all time</span>
                    </StatRow>

                    <StatRow icon={<UserMinus size={18} />} label="Uninstalls (30d)">
                        <span className={styles.number}>{data?.uninstalls.current ?? 0}</span>
                        {data && <Delta count={data.uninstalls} label="vs previous 30d" invert />}
                        <span className={styles.muted}>· {data?.totalUninstalls ?? 0} all time</span>
                    </StatRow>

                    <StatRow icon={<Star size={18} />} label="Rating">
                        <span className={styles.muted}>Not available — the listing is hidden from signed-out visitors (Mature content)</span>
                    </StatRow>

                    <StatRow icon={<TrendingUp size={18} />} label="Ranking">
                        <span className={styles.muted}>Not available — Chrome-Stats metric (paid API)</span>
                    </StatRow>
                </div>

                <p className={styles.footnote}>
                    Telemetry since {formatDate(data?.trackingSince ?? null)}. &quot;Active&quot; means the side panel was opened or a feature
                    was used. Installs and uninstalls are counted from v1.0.19 onward, so earlier installs aren&apos;t included.
                    &quot;First seen&quot; is when this dashboard first saw the version on the store, not the exact publish time.
                </p>
            </div>
        </section>
    );
}
