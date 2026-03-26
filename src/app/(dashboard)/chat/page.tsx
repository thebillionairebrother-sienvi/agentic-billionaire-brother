'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, RefreshCw, MessageSquare, Plus, ChevronDown, Minimize2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GifBubble } from '@/components/GifBubble';
import type { ChatConversation } from '@/lib/types';
import styles from './chat.module.css';

interface Message {
    role: 'user' | 'derek';
    content: string;
    reaction?: string;
    taskUpdates?: string[];
}

interface ContractOption {
    id: string;
    archetype: string;
    signed_at: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [contracts, setContracts] = useState<ContractOption[]>([]);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const supabase = createClient();
    const router = useRouter();

    const handleMinimize = () => {
        const returnUrl = sessionStorage.getItem('derek_chat_return_url') || '/';
        sessionStorage.setItem('open_derek_chat', 'true');
        router.push(returnUrl);
    };

    const deleteConversation = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
            setActiveConversationId(null);
            setMessages([]);
        }

        await supabase
            .from('chat_conversations')
            .delete()
            .eq('id', id);
    };

    // Load contracts and conversations on mount
    useEffect(() => {
        loadContracts();
        loadConversations();
    }, []);

    const loadContracts = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('execution_contracts')
            .select('id, signed_at, strategy:strategy_options(archetype)')
            .eq('user_id', user.id)
            .order('signed_at', { ascending: false });

        if (data) {
            const mapped = data.map((c: Record<string, unknown>) => ({
                id: c.id as string,
                archetype: (c.strategy as Record<string, string>)?.archetype || 'Strategy',
                signed_at: c.signed_at as string,
            }));
            setContracts(mapped);
            if (mapped.length > 0 && !selectedContractId) {
                setSelectedContractId(mapped[0].id);
            }
        }
    };

    const loadConversations = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('chat_conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(50);

        if (data) {
            setConversations(data as ChatConversation[]);
        }
    };

    const loadConversation = useCallback(async (conversationId: string) => {
        setActiveConversationId(conversationId);
        setMessages([]);

        const { data } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data.map(m => ({
                role: m.role as 'user' | 'derek',
                content: m.content,
                reaction: m.reaction || undefined,
                taskUpdates: m.task_updates || undefined,
            })));
        }

        // Set the contract from the conversation
        const conv = conversations.find(c => c.id === conversationId);
        if (conv?.execution_contract_id) {
            setSelectedContractId(conv.execution_contract_id);
        }
    }, [conversations, supabase]);

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
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    const startNewConversation = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: conv } = await supabase
            .from('chat_conversations')
            .insert({
                user_id: user.id,
                execution_contract_id: selectedContractId,
                title: 'New Conversation',
            })
            .select()
            .single();

        if (conv) {
            setActiveConversationId(conv.id);
            setMessages([]);
            setConversations(prev => [conv as ChatConversation, ...prev]);
        }
    };

    const sendMessage = async () => {
        const msg = input.trim();
        if (!msg || loading) return;

        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: msg }]);
        setLoading(true);

        // Ensure we have an active conversation
        let convId = activeConversationId;
        if (!convId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setLoading(false); return; }

            const { data: conv } = await supabase
                .from('chat_conversations')
                .insert({
                    user_id: user.id,
                    execution_contract_id: selectedContractId,
                    title: msg.substring(0, 50),
                })
                .select()
                .single();

            if (conv) {
                convId = conv.id;
                setActiveConversationId(conv.id);
                setConversations(prev => [conv as ChatConversation, ...prev]);
            }
        }

        try {
            const chatHistory = messages.map(m => ({
                role: m.role === 'derek' ? 'assistant' : 'user',
                content: m.content,
            }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    chatHistory,
                    contractId: selectedContractId,
                    conversationId: convId,
                }),
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

            // Update conversation title if it's the first message
            if (convId && messages.length === 0) {
                await supabase
                    .from('chat_conversations')
                    .update({ title: msg.substring(0, 50), updated_at: new Date().toISOString() })
                    .eq('id', convId);
                loadConversations();
            } else if (convId) {
                await supabase
                    .from('chat_conversations')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', convId);
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

    const selectedContract = contracts.find(c => c.id === selectedContractId);

    return (
        <div className={styles.page}>
            {/* Conversation Sidebar */}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>Conversations</h3>
                    <button
                        className={styles.newChatBtn}
                        onClick={startNewConversation}
                        title="New conversation"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                <div className={styles.conversationList}>
                    {conversations.length === 0 ? (
                        <div className={styles.noConversations}>
                            <MessageSquare size={20} />
                            <span>No conversations yet</span>
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <div key={conv.id} className={styles.conversationItemWrapper}>
                                <button
                                    className={`${styles.conversationItem} ${conv.id === activeConversationId ? styles.conversationActive : ''}`}
                                    onClick={() => loadConversation(conv.id)}
                                >
                                    <MessageSquare size={14} />
                                    <span className={styles.conversationTitle}>{conv.title}</span>
                                    <span className={styles.conversationDate}>
                                        {new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </button>
                                <button
                                    className={styles.deleteConvBtn}
                                    onClick={(e) => deleteConversation(e, conv.id)}
                                    title="Delete conversation"
                                    aria-label="Delete conversation"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* Main Chat */}
            <div className={styles.chatMain}>
                {/* Header */}
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button
                            className={styles.sidebarToggle}
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <MessageSquare size={18} />
                        </button>
                        <div className={styles.derekAvatar}>D</div>
                        <div>
                            <h1 className={styles.headerTitle}>Derek</h1>
                            <span className={styles.headerSub}>Your Billionaire Brother</span>
                        </div>
                    </div>

                    <div className={styles.headerRight}>
                        {/* Strategy Selector */}
                        {contracts.length > 0 && (
                            <div className={styles.strategySelector}>
                                <ChevronDown size={14} />
                                <select
                                    className={styles.strategySelect}
                                    value={selectedContractId || ''}
                                    onChange={(e) => setSelectedContractId(e.target.value)}
                                >
                                    {contracts.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.archetype}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Minimize Button */}
                        <button
                            className={styles.minimizeBtn}
                            onClick={handleMinimize}
                            title="Back to floating chat"
                            aria-label="Minimize to floating chat"
                        >
                            <Minimize2 size={18} />
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className={styles.messages}>
                    {messages.length === 0 && (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>
                                <Sparkles size={32} />
                            </div>
                            <h2>Hey, what&apos;s up?</h2>
                            <p>
                                Tell me what&apos;s on your mind — tasks, strategy, or anything about your business. I&apos;m here to help.
                                {selectedContract && (
                                    <span className={styles.contextHint}>
                                        <br />Currently talking about: <strong>{selectedContract.archetype}</strong>
                                    </span>
                                )}
                            </p>
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
        </div>
    );
}
