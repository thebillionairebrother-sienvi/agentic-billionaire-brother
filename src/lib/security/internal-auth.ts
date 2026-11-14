import { timingSafeEqual } from 'node:crypto';

/**
 * Server-to-server calls (board-meeting/commit → /api/workers/*) carry
 * `Authorization: Bearer ${CRON_SECRET}`, the same secret the Vercel cron uses.
 * Without a configured secret nothing is accepted.
 */
export function internalAuthHeader(): Record<string, string> {
    return { Authorization: `Bearer ${process.env.CRON_SECRET || ''}` };
}

export function isInternalRequest(request: Request): boolean {
    const secret = process.env.CRON_SECRET || '';
    if (!secret) return false;
    const got = Buffer.from(request.headers.get('authorization') || '');
    const want = Buffer.from(`Bearer ${secret}`);
    return got.length === want.length && timingSafeEqual(got, want);
}
