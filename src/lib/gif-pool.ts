/**
 * GIF Pools for Derek Chat (/chat, FloatingDerekChat, and AI responses).
 *
 * Provides curated, instant-loading GIF pools mapped to emotional vibes and reactions,
 * with Adam Scott shouting "Bababooey" (Parks and Recreation) as Derek's signature
 * celebration GIF whenever something good happens.
 */

export interface GifPoolItem {
    id: string;
    title: string;
    url: string;
    fallbackUrl?: string;
    tags: string[];
    description: string;
}

export interface GifPoolCategory {
    id: string;
    name: string;
    description: string;
    triggers: string[];
    gifs: GifPoolItem[];
}

export const BABABOOEY_GIF_URL = '/bababooey.gif';
export const BABABOOEY_GIPHY_FALLBACK_URL = 'https://media4.giphy.com/media/j3KLrIggcbVU2f0mDu/200.gif';

export const GIF_POOLS: Record<string, GifPoolCategory> = {
    GOOD_NEWS: {
        id: 'GOOD_NEWS',
        name: 'Good News & Celebrations',
        description: 'Triggered when something good happens: wins, milestones, completed tasks, revenue, breakthroughs, or good news.',
        triggers: [
            'bababooey',
            'baba booey',
            'adam scott bababooey',
            'parks and rec bababooey',
            'good news',
            'huge win',
            'win',
            'big win',
            'lets go',
            "let's go",
            'proud of you',
            'crushed it',
            'crushing it',
            'killed it',
            'nailed it',
            'celebration',
            'celebrate',
            'milestone',
            'victory',
            'we did it',
            'boom',
            'success',
            'champion',
            'champ',
            'high five',
            'breakthrough',
            'first sale',
            'revenue win',
            'you did it',
        ],
        gifs: [
            {
                id: 'bababooey',
                title: 'Adam Scott Bababooey (Parks and Recreation)',
                url: BABABOOEY_GIF_URL,
                fallbackUrl: BABABOOEY_GIPHY_FALLBACK_URL,
                tags: ['bababooey', 'adam scott', 'parks and rec', 'win', 'good news', 'celebration', 'lets go', 'peacock'],
                description: 'Adam Scott shouting "Bababooey" in sitcom Parks and Recreation',
            },
        ],
    },
};

/**
 * Normalizes text for trigger matching by lowercasing, stripping punctuation,
 * and collapsing multiple whitespace characters.
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Resolves a reaction or search query to a curated GIF from the GIF pools.
 * Returns the GIF URL (e.g. '/bababooey.gif') if a match is found, or null to fall back to Giphy.
 */
export function getGifFromPool(queryOrReaction?: string | null): string | null {
    if (!queryOrReaction) return null;

    const normalized = normalizeText(queryOrReaction);
    if (!normalized) return null;

    // 1. Explicit match for Bababooey variants
    if (
        normalized.includes('bababooey') ||
        normalized.includes('baba booey') ||
        normalized.includes('bababoi') ||
        normalized.includes('baba boy')
    ) {
        return GIF_POOLS.GOOD_NEWS.gifs[0].url;
    }

    // 2. Check each pool category for matching triggers
    for (const pool of Object.values(GIF_POOLS)) {
        for (const trigger of pool.triggers) {
            const cleanTrigger = normalizeText(trigger);
            if (
                normalized === cleanTrigger ||
                normalized.includes(cleanTrigger) ||
                (cleanTrigger.length >= 4 && cleanTrigger.split(' ').every(word => normalized.includes(word)))
            ) {
                const randomIndex = Math.floor(Math.random() * pool.gifs.length);
                return pool.gifs[randomIndex].url;
            }
        }
    }

    return null;
}

/**
 * Checks if a reaction string represents a "good news" or celebratory event.
 */
export function isGoodNewsReaction(reaction?: string | null): boolean {
    if (!reaction) return false;
    const normalized = normalizeText(reaction);
    return GIF_POOLS.GOOD_NEWS.triggers.some(trigger =>
        normalized.includes(normalizeText(trigger))
    );
}
