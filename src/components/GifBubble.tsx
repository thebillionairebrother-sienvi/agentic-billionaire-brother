'use client';

import { useState, useEffect } from 'react';
import styles from './GifBubble.module.css';

interface GifBubbleProps {
    reaction: string;
}

export function GifBubble({ reaction }: GifBubbleProps) {
    const [gifUrl, setGifUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!reaction) {
            setLoading(false);
            return;
        }

        fetch('/api/giphy-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: reaction }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data?.gifUrl) {
                    setGifUrl(data.gifUrl);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [reaction]);

    if (!loading && !gifUrl) return null;

    if (loading) {
        return <div className={styles.skeleton} />;
    }

    return (
        <img
            src={gifUrl!}
            alt={reaction}
            className={styles.gif}
        />
    );
}
