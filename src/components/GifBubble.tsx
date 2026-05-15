'use client';

import { useState, useEffect } from 'react';
import styles from './GifBubble.module.css';

interface GifBubbleProps {
    reaction: string;
    /** Pre-fetched GIF URL from the server — skips the client-side fetch entirely */
    gifUrl?: string;
}

export function GifBubble({ reaction, gifUrl: preloadedGifUrl }: GifBubbleProps) {
    const [gifUrl, setGifUrl] = useState<string | null>(preloadedGifUrl || null);
    const [loading, setLoading] = useState(!preloadedGifUrl);

    useEffect(() => {
        // If we already have a pre-fetched URL, no need to fetch
        if (preloadedGifUrl) {
            setGifUrl(preloadedGifUrl);
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
