/**
 * Signed one-click cancellation tokens for the pre-charge reminder email.
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CancelTokenPayload {
    /** Supabase user id */
    u: string;
    /** Stripe subscription id */
    s: string;
    /** Expiry, unix seconds */
    exp: number;
}

function b64url(buf: Buffer | string): string {
    return Buffer.from(buf).toString('base64url');
}

function getSecret(secret?: string): string {
    const s = secret ?? process.env.BILLING_LINK_SECRET;
    if (!s || s.length < 16) throw new Error('BILLING_LINK_SECRET is not configured (min 16 chars).');
    return s;
}

export function signCancelToken(payload: CancelTokenPayload, secret?: string): string {
    const body = b64url(JSON.stringify(payload));
    const sig = b64url(createHmac('sha256', getSecret(secret)).update(body).digest());
    return `${body}.${sig}`;
}

export function verifyCancelToken(
    token: string,
    now: Date = new Date(),
    secret?: string,
): CancelTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = createHmac('sha256', getSecret(secret)).update(body).digest();
    let given: Buffer;
    try {
        given = Buffer.from(sig, 'base64url');
    } catch {
        return null;
    }
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CancelTokenPayload;
        if (!payload.u || !payload.s || typeof payload.exp !== 'number') return null;
        if (payload.exp * 1000 < now.getTime()) return null;
        return payload;
    } catch {
        return null;
    }
}
