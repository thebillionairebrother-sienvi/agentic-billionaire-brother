'use client';

import { useEffect } from 'react';

/**
 * Only the landing page may be embedded (Whop — see EMBED_FRAME_ANCESTORS in
 * next.config.ts), and login and checkout can't work inside another site's
 * iframe. When framed, open every link that leaves the landing page in a new tab.
 */
export function EmbedLinkGuard() {
    useEffect(() => {
        if (window.self === window.top) return;

        const handleClick = (event: MouseEvent) => {
            if (!(event.target instanceof Element)) return;
            const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
            if (!anchor) return;

            const url = new URL(anchor.href, window.location.href);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
            // Landing page and its #anchors stay in the frame.
            if (url.origin === window.location.origin && url.pathname === '/') return;

            // next/link skips client-side navigation when target is not _self, so
            // setting it in the capture phase covers <Link> and plain <a> alike.
            anchor.target = '_blank';
            anchor.relList.add('noopener');
        };

        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, []);

    return null;
}
