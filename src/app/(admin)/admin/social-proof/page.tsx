'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Check, X, DollarSign, Calendar, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './social-proof.module.css';

interface RevenueWin {
    id: string;
    user_id: string;
    monthly_revenue: number | null;
    platform: string | null;
    win_headline: string | null;
    screenshot_path: string | null;
    consent_given: boolean;
    admin_approved: boolean;
    admin_rejected: boolean;
    admin_notes: string | null;
    submitted_at: string;
    approved_at: string | null;
    users: {
        display_name: string | null;
        email: string;
    };
}

export default function SocialProofPage() {
    const [wins, setWins] = useState<RevenueWin[]>([]);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});
    const supabase = createClient();

    const fetchWins = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/revenue-wins?filter=${filter}`);
            if (res.ok) {
                const data = await res.json();
                setWins(data.wins || []);
            }
        } catch {
            // ignore
        }
        setLoading(false);
    }, [filter]);

    useEffect(() => {
        fetchWins();
    }, [fetchWins]);

    // Generate signed URLs for screenshots
    useEffect(() => {
        const loadUrls = async () => {
            const urlMap: Record<string, string> = {};
            for (const win of wins) {
                if (win.screenshot_path && !screenshotUrls[win.id]) {
                    try {
                        const { data } = await supabase.storage
                            .from('social-proof')
                            .createSignedUrl(win.screenshot_path, 3600);
                        if (data?.signedUrl) {
                            urlMap[win.id] = data.signedUrl;
                        }
                    } catch {
                        // ignore
                    }
                }
            }
            if (Object.keys(urlMap).length > 0) {
                setScreenshotUrls(prev => ({ ...prev, ...urlMap }));
            }
        };
        if (wins.length > 0) loadUrls();
    }, [wins]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleAction = async (winId: string, action: 'approve' | 'reject') => {
        setActionLoading(winId);
        try {
            const res = await fetch('/api/revenue-wins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    winId,
                    notes: notes[winId] || null,
                }),
            });
            if (res.ok) {
                await fetchWins();
            }
        } catch {
            // ignore
        }
        setActionLoading(null);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const platformLabel = (p: string | null) => {
        if (!p) return 'Unknown';
        return p.charAt(0).toUpperCase() + p.slice(1);
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className="heading-lg">
                    <Trophy size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px', color: 'var(--gold-400)' }} />
                    Social Proof
                </h1>
                <div className={styles.tabs}>
                    {(['pending', 'approved', 'all'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${filter === tab ? styles.tabActive : ''}`}
                            onClick={() => setFilter(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className={styles.grid}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
                    ))}
                </div>
            ) : wins.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📸</div>
                    <h3>No {filter === 'pending' ? 'pending' : filter === 'approved' ? 'approved' : ''} wins yet</h3>
                    <p className="text-secondary">
                        {filter === 'pending'
                            ? 'User-submitted revenue wins will appear here for review.'
                            : 'Approved wins will show here and can be used for marketing.'}
                    </p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {wins.map(win => (
                        <div key={win.id} className={styles.winCard}>
                            {/* Screenshot */}
                            <div className={styles.screenshotContainer}>
                                {win.screenshot_path && screenshotUrls[win.id] ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={screenshotUrls[win.id]}
                                        alt="Revenue screenshot"
                                        className={styles.screenshotImg}
                                    />
                                ) : (
                                    <div className={styles.noScreenshot}>
                                        <ImageIcon size={32} />
                                    </div>
                                )}
                            </div>

                            <div className={styles.cardBody}>
                                {/* User Info */}
                                <div className={styles.cardUser}>
                                    <div className={styles.cardAvatar}>
                                        {(win.users?.display_name || win.users?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div className={styles.cardUserMeta}>
                                        <div className={styles.cardName}>{win.users?.display_name || 'Unknown'}</div>
                                        <div className={styles.cardEmail}>{win.users?.email}</div>
                                    </div>
                                    {win.admin_approved && <span className={`${styles.statusBadge} ${styles.approved}`}>Approved</span>}
                                    {win.admin_rejected && <span className={`${styles.statusBadge} ${styles.rejected}`}>Rejected</span>}
                                </div>

                                {/* Headline */}
                                {win.win_headline && (
                                    <p className={styles.headline}>&ldquo;{win.win_headline}&rdquo;</p>
                                )}

                                {/* Meta */}
                                <div className={styles.cardMeta}>
                                    {win.monthly_revenue != null && (
                                        <span className={styles.metaItem}>
                                            <DollarSign size={12} />
                                            <span className={styles.metaValue}>${win.monthly_revenue.toLocaleString()}/mo</span>
                                        </span>
                                    )}
                                    {win.platform && (
                                        <span className={styles.metaItem}>
                                            Platform: <span className={styles.metaValue}>{platformLabel(win.platform)}</span>
                                        </span>
                                    )}
                                </div>

                                <div className={styles.cardDate}>
                                    <Calendar size={10} style={{ display: 'inline', marginRight: '4px' }} />
                                    {formatDate(win.submitted_at)}
                                </div>

                                {/* Admin Notes */}
                                {win.admin_notes && (
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                        Admin: {win.admin_notes}
                                    </p>
                                )}

                                {/* Actions — only for pending */}
                                {!win.admin_approved && !win.admin_rejected && (
                                    <>
                                        <input
                                            type="text"
                                            className={styles.notesInput}
                                            placeholder="Admin notes (optional)..."
                                            value={notes[win.id] || ''}
                                            onChange={(e) => setNotes(prev => ({ ...prev, [win.id]: e.target.value }))}
                                        />
                                        <div className={styles.cardActions}>
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'var(--accent-green-glow)', color: 'var(--accent-green)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                                                onClick={() => handleAction(win.id, 'approve')}
                                                disabled={actionLoading === win.id}
                                            >
                                                <Check size={14} /> Approve
                                            </button>
                                            <button
                                                className="btn btn-sm"
                                                style={{ background: 'var(--accent-red-glow)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                                                onClick={() => handleAction(win.id, 'reject')}
                                                disabled={actionLoading === win.id}
                                            >
                                                <X size={14} /> Reject
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
