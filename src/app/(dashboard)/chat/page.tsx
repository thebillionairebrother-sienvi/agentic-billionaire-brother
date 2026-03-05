'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, RefreshCw } from 'lucide-react';
import { GifBubble } from '@/components/GifBubble';
import styles from './chat.module.css';

interface Message {
    role: 'user' | 'derek';
    content: string;
    reaction?: string;
    taskUpdates?: string[];
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    const sendMessage = async () => {
        const msg = input.trim();
        if (!msg || loading) return;

        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: msg }]);
        setLoading(true);

        try {
            // Build chat history from existing messages for Gemini context
            const chatHistory = messages.map(m => ({
                role: m.role === 'derek' ? 'assistant' : 'user',
                content: m.content,
            }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg, chatHistory }),
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
                    taskUpdates: data.taskUpdates,
                },
            ]);
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

    const startNewChat = () => {
        setMessages([]);
    };

    return (
        <div className={styles.page}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.derekAvatar}>D</div>
                    <div>
                        <h1 className={styles.headerTitle}>Derek</h1>
                        <span className={styles.headerSub}>Your Billionaire Brother</span>
                    </div>
                </div>
                <button className={styles.newChatBtn} onClick={startNewChat} title="New conversation">
                    <RefreshCw size={16} />
                </button>
            </header>

            {/* Messages */}
            <div className={styles.messages}>
                {messages.length === 0 && (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <Sparkles size={32} />
                        </div>
                        <h2>Hey, what&apos;s up?</h2>
                        <p>Tell me what&apos;s on your mind — tasks, strategy, or anything about your business. I&apos;m here to help.</p>
                        <div className={styles.suggestions}>
                            <button onClick={() => setInput("I'm stuck on today's tasks")}>
                                I&apos;m stuck on today&apos;s tasks
                            </button>
                            <button onClick={() => setInput("Can you adjust my tasks for today?")}>
                                Adjust my tasks
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
                        className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.derekMessage}`}
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
                                {msg.taskUpdates && msg.taskUpdates.length > 0 && (
                                    <div className={styles.taskUpdateBanner}>
                                        <Sparkles size={13} />
                                        <span>{msg.taskUpdates.join(' · ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className={`${styles.message} ${styles.derekMessage}`}>
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

            {/* Input */}
            <div className={styles.inputArea}>
                <div className={styles.inputWrapper}>
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
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
