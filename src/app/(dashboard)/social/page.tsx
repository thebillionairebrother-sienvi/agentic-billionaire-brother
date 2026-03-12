'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    Twitter,
    Link2,
    Unlink,
    Sparkles,
    Send,
    Trash2,
    Edit3,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Loader2,
    RefreshCcw,
    Key,
    Eye,
    EyeOff,
} from 'lucide-react';
import styles from './social.module.css';

interface SocialAccount {
    id: string;
    platform: string;
    platform_username: string;
    platform_display_name: string;
    platform_avatar_url: string;
    access_token: string | null;
    connected_at: string;
}

interface SocialPost {
    id: string;
    content: string;
    post_type: string;
    status: string;
    ai_rationale: string;
    posted_at: string | null;
    created_at: string;
}

export default function SocialPage() {
    const [account, setAccount] = useState<SocialAccount | null>(null);
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [posting, setPosting] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [topic, setTopic] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Credential inputs
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [savingCreds, setSavingCreds] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    const searchParams = useSearchParams();
    const supabase = createClient();

    const isConnected = account && account.access_token;

    useEffect(() => {
        loadData();
        const err = searchParams.get('error');
        if (err === 'denied') setError('Twitter connection was denied.');
        else if (err === 'no_credentials') setError('Please enter your Twitter API credentials first.');
        else if (err === 'token_failed') setError('Token exchange failed. Check your Client ID and Secret.');
        else if (err) setError(`Connection error: ${err}`);
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: accounts } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'twitter');

        if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);

            if (accounts[0].access_token) {
                const { data: postData } = await supabase
                    .from('social_posts')
                    .select('*')
                    .eq('social_account_id', accounts[0].id)
                    .order('created_at', { ascending: false });

                if (postData) setPosts(postData);
            }
        }
        setLoading(false);
    };

    const handleSaveCredentials = async () => {
        if (!clientId.trim() || !clientSecret.trim()) {
            setError('Both Client ID and Client Secret are required.');
            return;
        }
        setSavingCreds(true);
        setError(null);
        try {
            const res = await fetch('/api/social/twitter/credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save');
            }
            // Reload data to pick up the new account record
            await loadData();
            setClientId('');
            setClientSecret('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save credentials');
        }
        setSavingCreds(false);
    };

    const handleConnect = () => {
        window.location.href = '/api/social/twitter/connect';
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect your Twitter account? All draft posts and credentials will be deleted.')) return;
        setDisconnecting(true);
        const res = await fetch('/api/social/twitter/disconnect', { method: 'POST' });
        if (res.ok) {
            setAccount(null);
            setPosts([]);
        }
        setDisconnecting(false);
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch('/api/social/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.posts) {
                setPosts(prev => [...data.posts, ...prev]);
                setTopic('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Generation failed');
        }
        setGenerating(false);
    };

    const handlePost = async (postId: string) => {
        setPosting(postId);
        try {
            const res = await fetch('/api/social/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId }),
            });
            if (res.ok) {
                setPosts(prev => prev.map(p =>
                    p.id === postId ? { ...p, status: 'posted', posted_at: new Date().toISOString() } : p
                ));
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to post');
                setPosts(prev => prev.map(p =>
                    p.id === postId ? { ...p, status: 'failed' } : p
                ));
            }
        } catch {
            setError('Failed to reach server');
        }
        setPosting(null);
    };

    const handleDelete = async (postId: string) => {
        await supabase.from('social_posts').delete().eq('id', postId);
        setPosts(prev => prev.filter(p => p.id !== postId));
    };

    const handleEdit = (post: SocialPost) => {
        setEditingId(post.id);
        setEditContent(post.content);
    };

    const handleSaveEdit = async (postId: string) => {
        await supabase.from('social_posts').update({ content: editContent }).eq('id', postId);
        setPosts(prev => prev.map(p =>
            p.id === postId ? { ...p, content: editContent } : p
        ));
        setEditingId(null);
        setEditContent('');
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className="skeleton" style={{ height: 200 }} />
                <div className="skeleton" style={{ height: 300, marginTop: 'var(--space-4)' }} />
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className="heading-lg">Social Media</h1>
                <p className="text-secondary">
                    Connect your accounts. We&apos;ll generate content. You approve — we post.
                </p>
            </header>

            {error && (
                <div className={styles.errorBanner}>
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Twitter Card */}
            <div className={styles.platformCard}>
                <div className={styles.platformHeader}>
                    <div className={styles.platformInfo}>
                        <div className={styles.platformIcon}>
                            <Twitter size={20} />
                        </div>
                        <div>
                            <h2 className={styles.platformName}>Twitter / X</h2>
                            {isConnected ? (
                                <span className={styles.connectedBadge}>
                                    <CheckCircle size={12} />
                                    Connected as @{account.platform_username}
                                </span>
                            ) : account ? (
                                <span className={styles.pendingBadge}>
                                    <Key size={12} />
                                    Credentials saved — tap Connect to authorize
                                </span>
                            ) : (
                                <span className={styles.disconnectedBadge}>Not connected</span>
                            )}
                        </div>
                    </div>
                    {isConnected ? (
                        <button
                            className={styles.disconnectBtn}
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                        >
                            <Unlink size={14} />
                            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    ) : account ? (
                        <div className={styles.headerActions}>
                            <button className={styles.connectBtn} onClick={handleConnect}>
                                <Link2 size={14} />
                                Connect Twitter
                            </button>
                            <button
                                className={styles.disconnectBtn}
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                            >
                                <Unlink size={14} />
                                Reset
                            </button>
                        </div>
                    ) : null}
                </div>

                {/* Credential Input (shown when no account exists) */}
                {!account && (
                    <div className={styles.credentialSection}>
                        <div className={styles.credentialInfo}>
                            <Key size={16} />
                            <div>
                                <strong>Enter your Twitter API credentials</strong>
                                <p>
                                    Get these from{' '}
                                    <a href="https://developer.twitter.com/en/portal/projects-and-apps" target="_blank" rel="noopener noreferrer">
                                        developer.twitter.com
                                    </a>
                                    . Enable OAuth 2.0 with Read + Write permissions.
                                </p>
                            </div>
                        </div>
                        <div className={styles.credentialForm}>
                            <div className={styles.credentialField}>
                                <label>Client ID</label>
                                <input
                                    className="input"
                                    placeholder="Enter your OAuth 2.0 Client ID"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                />
                            </div>
                            <div className={styles.credentialField}>
                                <label>Client Secret</label>
                                <div className={styles.secretInput}>
                                    <input
                                        className="input"
                                        type={showSecret ? 'text' : 'password'}
                                        placeholder="Enter your OAuth 2.0 Client Secret"
                                        value={clientSecret}
                                        onChange={(e) => setClientSecret(e.target.value)}
                                    />
                                    <button
                                        className={styles.toggleSecret}
                                        onClick={() => setShowSecret(!showSecret)}
                                        type="button"
                                    >
                                        {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleSaveCredentials}
                                disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
                            >
                                {savingCreds ? (
                                    <><Loader2 size={14} className={styles.spinning} /> Saving...</>
                                ) : (
                                    <><Key size={14} /> Save &amp; Continue</>
                                )}
                            </button>
                        </div>
                        <div className={styles.setupSteps}>
                            <p><strong>Quick setup:</strong></p>
                            <ol>
                                <li>Go to <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer">developer.twitter.com</a> → create a project + app</li>
                                <li>Under &quot;User authentication settings&quot; → enable OAuth 2.0</li>
                                <li>Set permissions to <strong>Read and Write</strong></li>
                                <li>Set callback URL: <code>https://www.billionairebrother.com/api/social/twitter/callback</code></li>
                                <li>Copy your Client ID and Client Secret here</li>
                            </ol>
                        </div>
                    </div>
                )}

                {/* Connect prompt (shown when credentials saved but not connected) */}
                {account && !isConnected && (
                    <div className={styles.connectPrompt}>
                        <p>Your API credentials are saved. Click <strong>Connect Twitter</strong> to authorize access to your account.</p>
                    </div>
                )}
            </div>

            {/* Content Generator */}
            {isConnected && (
                <>
                    <div className={`card ${styles.generatorCard}`}>
                        <h3 className="heading-sm" style={{ marginBottom: 'var(--space-4)' }}>
                            <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
                            {' '}Generate Content
                        </h3>
                        <div className={styles.generateForm}>
                            <input
                                className="input"
                                placeholder="Optional: Give Derek a topic to tweet about..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleGenerate}
                                disabled={generating}
                            >
                                {generating ? (
                                    <><Loader2 size={16} className={styles.spinning} /> Generating...</>
                                ) : (
                                    <><Sparkles size={16} /> Generate 5 Tweets</>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Content Queue */}
                    {posts.length > 0 && (
                        <div className={styles.queueSection}>
                            <div className={styles.queueHeader}>
                                <h3 className="heading-sm">Content Queue</h3>
                                <div className={styles.queueStats}>
                                    <span className={styles.statDraft}>
                                        {posts.filter(p => p.status === 'draft').length} drafts
                                    </span>
                                    <span className={styles.statPosted}>
                                        {posts.filter(p => p.status === 'posted').length} posted
                                    </span>
                                </div>
                            </div>

                            <div className={styles.postsList}>
                                {posts.map((post) => (
                                    <div key={post.id} className={`${styles.postCard} ${styles[`postStatus_${post.status}`]}`}>
                                        <div className={styles.postContent}>
                                            {editingId === post.id ? (
                                                <div className={styles.editArea}>
                                                    <textarea
                                                        className="input"
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        maxLength={280}
                                                        rows={3}
                                                    />
                                                    <div className={styles.editActions}>
                                                        <span className={styles.charCount}>
                                                            {editContent.length}/280
                                                        </span>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(post.id)}>Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className={styles.tweetText}>{post.content}</p>
                                                    {post.ai_rationale && (
                                                        <p className={styles.rationale}>
                                                            <Sparkles size={10} /> {post.ai_rationale}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className={styles.postActions}>
                                            {post.status === 'draft' && editingId !== post.id && (
                                                <>
                                                    <button
                                                        className={styles.postBtn}
                                                        onClick={() => handlePost(post.id)}
                                                        disabled={posting === post.id}
                                                        title="Post to Twitter"
                                                    >
                                                        {posting === post.id ? (
                                                            <Loader2 size={14} className={styles.spinning} />
                                                        ) : (
                                                            <Send size={14} />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={styles.editBtn}
                                                        onClick={() => handleEdit(post)}
                                                        title="Edit"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button
                                                        className={styles.deleteBtn}
                                                        onClick={() => handleDelete(post.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                            {post.status === 'posted' && (
                                                <span className={styles.postedLabel}>
                                                    <CheckCircle size={12} /> Posted
                                                </span>
                                            )}
                                            {post.status === 'failed' && (
                                                <span className={styles.failedLabel}>
                                                    <XCircle size={12} /> Failed
                                                    <button
                                                        className={styles.retryBtn}
                                                        onClick={() => handlePost(post.id)}
                                                    >
                                                        <RefreshCcw size={12} /> Retry
                                                    </button>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {posts.length === 0 && (
                        <div className={styles.emptyQueue}>
                            <Twitter size={48} strokeWidth={1} />
                            <p>No tweets yet. Hit &quot;Generate 5 Tweets&quot; to get started.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
