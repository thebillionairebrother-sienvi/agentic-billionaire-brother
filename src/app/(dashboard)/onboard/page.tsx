'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Send, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GifBubble } from '@/components/GifBubble';
import type { InterviewMessage, InterviewResponse, QuestionnairePayload } from '@/lib/types';
import styles from './onboard.module.css';

export default function OnboardPage() {
    const [messages, setMessages] = useState<InterviewMessage[]>([]);
    const [input, setInput] = useState('');

    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [complete, setComplete] = useState(false);
    const [extractedData, setExtractedData] = useState<QuestionnairePayload | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const router = useRouter();

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Initialize — get the AI's greeting
    useEffect(() => {
        const init = async () => {
            try {
                const res = await fetch('/api/interview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: '' }),
                });

                if (!res.ok) throw new Error('Failed to start interview');

                const data: InterviewResponse = await res.json();
                setMessages([{
                    role: 'assistant',
                    content: data.reply,
                    reaction: data.reaction,
                }]);
            } catch {
                setError('Failed to start the interview. Please refresh the page.');
            } finally {
                setInitializing(false);
            }
        };
        init();
    }, []);

    const sendMessage = async () => {
        if (!input.trim() || loading || complete) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);
        setError(null);

        try {
            const userMessageCount = messages.filter(m => m.role === 'user').length + 1; // +1 for current
            // Build chat history from existing messages for Gemini context
            const chatHistory = messages.map(m => ({
                role: m.role,
                content: m.content,
            }));
            const res = await fetch('/api/interview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, chatHistory, messageCount: userMessageCount }),
            });

            if (!res.ok) throw new Error('Failed to send message');

            const data: InterviewResponse = await res.json();
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: data.reply,
                reaction: data.reaction,
            }]);

            if (data.complete) {
                setComplete(true);
                // Use extracted data if available, or a minimal default so the button still shows
                setExtractedData(data.extractedData || {
                    business_name: 'My Business',
                    business_state: 'idea',
                    industry: 'General',
                    current_revenue_range: 'Pre-revenue',
                    target_audience: '',
                    strengths: [],
                    weaknesses: [],
                    risk_tolerance: 'moderate',
                    hours_per_week: 10,
                    monthly_budget_range: '$0',
                    no_go_constraints: [],
                    existing_assets: [],
                    additional_context: '',
                    team_size: 'solo',
                    va_count: 0,
                    calendar_blocks_available: 4,
                    timezone: 'UTC',
                });
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleSubmit = async () => {
        if (!extractedData) return;
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/questionnaire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(extractedData),
            });

            if (!res.ok) {
                const body = await res.json();
                throw new Error(body.error || 'Failed to save');
            }

            router.push('/strategies');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerIcon}>
                    <Crown size={24} />
                </div>
                <div>
                    <h1 className={styles.headerTitle}>Meet Your Billionaire Brother</h1>
                    <p className={styles.headerSubtitle}>
                        {complete
                            ? 'Interview complete — review your profile below'
                            : 'Answer a few questions so I can build your strategy'}
                    </p>
                </div>
            </div>

            {/* Chat Container */}
            <div className={styles.chatContainer}>
                <div className={styles.messageList}>
                    {initializing && (
                        <div className={styles.messageRow}>
                            <div className={`${styles.avatar} ${styles.avatarAi}`}>
                                <Sparkles size={16} />
                            </div>
                            <div className={`${styles.bubble} ${styles.bubbleAi}`}>
                                <div className={styles.typingIndicator}>
                                    <span /><span /><span />
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : ''}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className={`${styles.avatar} ${styles.avatarAi}`}>
                                    <Sparkles size={16} />
                                </div>
                            )}
                            <div className={styles.messageContent}>
                                {/* GIF Reaction — above the AI bubble */}
                                {msg.role === 'assistant' && msg.reaction && (
                                    <div className={styles.gifWrapper}>
                                        <GifBubble reaction={msg.reaction} />
                                    </div>
                                )}
                                <div
                                    className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi}`}
                                >
                                    {msg.role === 'assistant' ? (
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                            {msg.role === 'user' && (
                                <div className={`${styles.avatar} ${styles.avatarUser}`}>
                                    You
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className={styles.messageRow}>
                            <div className={`${styles.avatar} ${styles.avatarAi}`}>
                                <Sparkles size={16} />
                            </div>
                            <div className={`${styles.bubble} ${styles.bubbleAi}`}>
                                <div className={styles.typingIndicator}>
                                    <span /><span /><span />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Extracted Takeaways */}
                {complete && extractedData && (
                    <div className={styles.takeawaysCard}>
                        <div className={styles.takeawaysHeader}>
                            <CheckCircle size={20} />
                            <h3>Key Takeaways</h3>
                        </div>
                        <div className={styles.takeawaysGrid}>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Business</span>
                                <span>{extractedData.business_name} • {extractedData.industry}</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Stage</span>
                                <span>{extractedData.business_state}</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Revenue</span>
                                <span>{extractedData.current_revenue_range || 'N/A'}</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Strengths</span>
                                <span>{(extractedData.strengths || []).join(', ') || 'N/A'}</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Risk</span>
                                <span>{extractedData.risk_tolerance}</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Hours/week</span>
                                <span>{extractedData.hours_per_week}h</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Budget</span>
                                <span>{extractedData.monthly_budget_range}</span>
                            </div>
                            <div className={styles.takeawayItem}>
                                <span className={styles.takeawayLabel}>Team</span>
                                <span>{extractedData.team_size}</span>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', marginTop: 'var(--space-4)' }}
                            disabled={submitting}
                            onClick={handleSubmit}
                        >
                            {submitting ? 'Generating Strategies...' : 'Generate My Strategies'}
                            {!submitting && <ArrowRight size={18} />}
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && <div className={styles.error}>{error}</div>}

                {/* Input Bar */}
                {!complete && !initializing && (
                    <div className={styles.inputBar}>
                        <textarea
                            ref={inputRef}
                            className={styles.chatInput}
                            placeholder="Type your answer..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            className={styles.sendButton}
                            onClick={sendMessage}
                            disabled={!input.trim() || loading}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
