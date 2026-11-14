// Guest (signed-out) chat limits for /api/chat/public.
//
// The old limit trusted a promptCount the browser sent, so anyone could skip it.
// Now every guest message increments two server-side counters in Postgres
// (public.increment_guest_chat, migration 20261114_guest_chat_limits.sql):
//   - per client IP per UTC day (the IP is stored only as an HMAC)
//   - all guests together per UTC day: the real cost bound, since IPs rotate
//
// The pure helpers below have no I/O so scripts/verify-guest-limits.mjs can test them.

export const GUEST_PER_IP_DAILY_DEFAULT = 10;
export const GUEST_GLOBAL_DAILY_DEFAULT = 300;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_HISTORY_CHARS = 12000;

const positiveInt = (value: string | undefined, fallback: number): number => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
};

export function guestLimits(env: Record<string, string | undefined> = process.env) {
    return {
        perIpDaily: positiveInt(env.GUEST_CHAT_PER_IP_DAILY, GUEST_PER_IP_DAILY_DEFAULT),
        globalDaily: positiveInt(env.GUEST_CHAT_GLOBAL_DAILY, GUEST_GLOBAL_DAILY_DEFAULT),
    };
}

/** Counts already include the current request (the RPC increments first). */
export function isGuestAllowed(
    counts: { ipCount: number; globalCount: number } | null,
    limits: { perIpDaily: number; globalDaily: number },
): boolean {
    if (!counts) return false; // counter unavailable: fail closed for guests
    return counts.ipCount <= limits.perIpDaily && counts.globalCount <= limits.globalDaily;
}

/**
 * Client IP. On Vercel, x-vercel-forwarded-for and x-real-ip are set by the
 * platform; x-forwarded-for is the last resort (first hop only).
 */
export function clientIp(headers: Headers): string {
    const first = (v: string | null) => v?.split(',')[0]?.trim() || '';
    return first(headers.get('x-vercel-forwarded-for'))
        || first(headers.get('x-real-ip'))
        || first(headers.get('x-forwarded-for'))
        || 'unknown';
}

/** Keeps the last MAX_HISTORY_MESSAGES messages whose total length fits MAX_HISTORY_CHARS. */
export function trimChatHistory<T extends { role: string; content: string }>(history: unknown): T[] {
    if (!Array.isArray(history)) return [];
    const valid = history.filter(
        (m): m is T => !!m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string',
    );
    const kept: T[] = [];
    let chars = 0;
    for (let i = valid.length - 1; i >= 0 && kept.length < MAX_HISTORY_MESSAGES; i--) {
        const content = valid[i].content.slice(0, MAX_MESSAGE_CHARS);
        if (chars + content.length > MAX_HISTORY_CHARS) break;
        chars += content.length;
        kept.unshift({ ...valid[i], content });
    }
    return kept;
}

export function todayUtc(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}
