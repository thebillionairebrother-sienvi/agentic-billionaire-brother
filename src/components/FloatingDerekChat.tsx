'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Sparkles, ArrowRight, Maximize2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GifBubble } from '@/components/GifBubble';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './FloatingDerekChat.module.css';

const GUEST_PROMPT_KEY = 'derek_guest_prompts';
const MAX_GUEST_PROMPTS = 3;

interface Message {
    role: 'user' | 'derek';
    content: string;
    reaction?: string;
}

export function FloatingDerekChat() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [guestPromptCount, setGuestPromptCount] = useState(0);
    const [limitReached, setLimitReached] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const pathname = usePathname();

    const loadLatestConversation = useCallback(async (userId: string) => {
        const supabase = createClient();
        const { data: convs } = await supabase
            .from('chat_conversations')
            .select('id')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (convs && convs.length > 0) {
            const convId = convs[0].id;
            setActiveConversationId(convId);
            const { data: msgs } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: true });

            if (msgs && msgs.length > 0) {
                setMessages(msgs.map(m => ({
                    role: m.role as 'user' | 'derek',
                    content: m.content,
                    reaction: m.reaction || undefined,
                })));
            }
        }
    }, []);

    // Check auth state
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            setIsAuthenticated(!!user);
            if (user) {
                setLimitReached(false);
                setGuestPromptCount(0);
                loadLatestConversation(user.id);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session?.user);
            if (session?.user) {
                setLimitReached(false);
                setGuestPromptCount(0);
                loadLatestConversation(session.user.id);
            }
        });

        return () => subscription.unsubscribe();
    }, [loadLatestConversation]);

    // Load guest prompt count from localStorage
    useEffect(() => {
        if (isAuthenticated === false) {
            try {
                const stored = localStorage.getItem(GUEST_PROMPT_KEY);
                if (stored) {
                    const count = parseInt(stored, 10);
                    setGuestPromptCount(count);
                    if (count >= MAX_GUEST_PROMPTS) {
                        setLimitReached(true);
                    }
                }
            } catch { /* localStorage may be unavailable */ }
        }
    }, [isAuthenticated]);

    // Check for minimize action from full chat page
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (sessionStorage.getItem('open_derek_chat') === 'true') {
                setOpen(true);
                sessionStorage.removeItem('open_derek_chat');
            }
        }
    }, [pathname]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 100) + 'px';
        }
    }, [input]);

    // Focus input when chat opens
    useEffect(() => {
        if (open && inputRef.current && !limitReached) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open, limitReached]);

    const sendMessage = async () => {
        const msg = input.trim();
        if (!msg || loading) return;

        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: msg }]);
        setLoading(true);

        let convId = activeConversationId;
        const supabase = createClient();

        if (isAuthenticated) {
            if (!convId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: newConv } = await supabase
                        .from('chat_conversations')
                        .insert({
                            user_id: user.id,
                            title: msg.substring(0, 50),
                        })
                        .select()
                        .single();
                    if (newConv) {
                        convId = newConv.id;
                        setActiveConversationId(newConv.id);
                    }
                }
            } else {
                if (messages.length === 0) {
                    await supabase.from('chat_conversations').update({ title: msg.substring(0, 50), updated_at: new Date().toISOString() }).eq('id', convId);
                } else {
                    await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
                }
            }
        }

        try {
            const chatHistory = messages.map(m => ({
                role: m.role === 'derek' ? 'assistant' : 'user',
                content: m.content,
            }));

            const endpoint = isAuthenticated ? '/api/chat' : '/api/chat/public';
            const body = isAuthenticated
                ? JSON.stringify({ message: msg, chatHistory, conversationId: convId })
                : JSON.stringify({ message: msg, chatHistory, promptCount: guestPromptCount });

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to get response');
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: 'derek',
                    content: data.response,
                    reaction: data.reaction,
                },
            ]);

            // Update guest prompt count only for unauthenticated users
            if (!isAuthenticated) {
                const newCount = guestPromptCount + 1;
                setGuestPromptCount(newCount);
                try {
                    localStorage.setItem(GUEST_PROMPT_KEY, String(newCount));
                } catch { /* */ }

                if (data.limitReached || newCount >= MAX_GUEST_PROMPTS) {
                    setLimitReached(true);
                }
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'derek',
                    content: err instanceof Error ? err.message : 'Something went wrong. Try again.',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (pathname === '/chat') {
        return null;
    }

    const handleMaximize = () => {
        sessionStorage.setItem('derek_chat_return_url', pathname);
        setOpen(false);
    };

    return (
        <>
            {/* FAB Button */}
            <button
                className={`${styles.fab} ${open ? styles.fabHidden : ''}`}
                onClick={() => setOpen(true)}
                aria-label="Talk to Derek"
                id="derek-chat-fab"
            >
                <span className={styles.fabIcon}>D</span>
                <span className={styles.fabPulse} />
            </button>

            {/* Chat Panel */}
            {open && (
                <div className={styles.panel} role="dialog" aria-label="Chat with Derek">
                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.avatar}>D</div>
                            <div>
                                <div className={styles.headerTitle}>Derek</div>
                                <div className={styles.headerSub}>Your Billionaire Brother</div>
                            </div>
                        </div>
                        <div className={styles.headerRight}>
                            <Link href="/chat" onClick={handleMaximize} className={styles.iconBtn} aria-label="Full screen mode">
                                <Maximize2 size={16} />
                            </Link>
                            <button
                                className={styles.iconBtn}
                                onClick={() => setOpen(false)}
                                aria-label="Close chat"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className={styles.messages}>
                        {messages.length === 0 && (
                            <div className={styles.emptyState}>
                                <Sparkles size={24} className={styles.emptyIcon} />
                                <p className={styles.emptyTitle}>Hey, what&apos;s up?</p>
                                <p className={styles.emptyDesc}>
                                    Ask me anything about business, strategy, or what&apos;s on your mind.
                                </p>
                                <div className={styles.suggestions}>
                                    <button onClick={() => setInput("I have a business idea")}>
                                        I have a business idea
                                    </button>
                                    <button onClick={() => setInput("I need motivation")}>
                                        I need motivation
                                    </button>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.derekMsg}`}
                            >
                                {msg.role === 'derek' && (
                                    <div className={styles.msgAvatar}>D</div>
                                )}
                                <div className={styles.msgColumn}>
                                    {msg.role === 'derek' && msg.reaction && (
                                        <div className={styles.gifWrapper}>
                                            <GifBubble reaction={msg.reaction} />
                                        </div>
                                    )}
                                    <div className={styles.msgBubble}>
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className={`${styles.message} ${styles.derekMsg}`}>
                                <div className={styles.msgAvatar}>D</div>
                                <div className={styles.msgBubble}>
                                    <div className={styles.typing}>
                                        <span /><span /><span />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input / Sign-up CTA */}
                    {limitReached ? (
                        <div className={styles.limitCta}>
                            <p className={styles.limitText}>
                                🔥 Want more from Derek? Sign up to unlock unlimited conversations, custom strategies, and weekly action steps.
                            </p>
                            <Link href="/auth" className={styles.limitBtn}>
                                Sign Up Free <ArrowRight size={16} />
                            </Link>
                        </div>
                    ) : (
                        <div className={styles.inputArea}>
                            <textarea
                                ref={inputRef}
                                className={styles.input}
                                placeholder="Talk to Derek..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                disabled={loading}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={sendMessage}
                                disabled={!input.trim() || loading}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    )}

                    {/* Guest prompt counter */}
                    {!isAuthenticated && !limitReached && (
                        <div className={styles.promptCounter}>
                            {MAX_GUEST_PROMPTS - guestPromptCount} free message{MAX_GUEST_PROMPTS - guestPromptCount !== 1 ? 's' : ''} remaining
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
