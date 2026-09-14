'use client';

import { useState, useEffect } from 'react';
import { getGifFromPool } from '@/lib/gif-pool';
import styles from './GifBubble.module.css';

interface GifBubbleProps {
    reaction: string;
    /** Pre-fetched GIF URL from the server — skips the client-side fetch entirely */
    gifUrl?: string;
}

export function GifBubble({ reaction, gifUrl: preloadedGifUrl }: GifBubbleProps) {
    const poolGif = getGifFromPool(reaction);
    const initialGifUrl = preloadedGifUrl || poolGif || null;
    const [gifUrl, setGifUrl] = useState<string | null>(initialGifUrl);
    const [loading, setLoading] = useState(!initialGifUrl && Boolean(reaction));

    useEffect(() => {
        // If we already have a pre-fetched URL or a matching GIF pool entry, no network fetch needed
        if (preloadedGifUrl || poolGif) {
            setGifUrl(preloadedGifUrl || poolGif);
            setLoading(false);
            return;
        }

        if (!reaction) {
            setLoading(false);
            return;
        }

        // Fallback: client-side fetch for legacy messages without gifUrl
        const controller = new AbortController();

        fetch('/api/giphy-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: reaction }),
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error('GIF fetch failed');
                return res.json();
            })
            .then((data) => {
                if (data?.gifUrl) {
                    setGifUrl(data.gifUrl);
                }
            })
            .catch((err) => {
                // Silently handle abort and network errors
                if (err.name !== 'AbortError') {
                    console.warn('[GifBubble] Failed to load GIF:', err.message);
                }
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [reaction, preloadedGifUrl]);

    if (!loading && !gifUrl) return null;

    if (loading) {
        return <div className={styles.skeleton} />;
    }

    return (
        <img
            src={gifUrl!}
            alt={reaction}
            className={styles.gif}
            loading="lazy"
        />
    );
}
