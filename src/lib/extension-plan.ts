// Plan decision for the Chrome extension routes, kept dependency-free so
// scripts/verify-extension-plan.mjs can test it with plain Node.
//
// Rules:
//  - users.tier is the source of truth (the Stripe webhook and /api/auth/set-tier
//    keep it current).
//  - A subscriptions row only counts while its status is live (active, trialing,
//    past_due). A cancelled row keeps its old tier name, so it must not grant access.
//  - user_metadata is never trusted: users can write it themselves.

export type PlanTier = 'free' | 'brother' | 'team';

export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];

const RANK: Record<PlanTier, number> = { free: 0, brother: 1, team: 2 };

const asTier = (value: unknown): PlanTier =>
    value === 'team' || value === 'brother' ? value : 'free';

export function decideExtensionTier(input: {
    usersTier?: string | null;
    subscription?: { tier?: string | null; status?: string | null } | null;
    privilegedTier?: PlanTier | null;
}): PlanTier {
    const candidates: PlanTier[] = [asTier((input.usersTier || '').toLowerCase())];
    const sub = input.subscription;
    if (sub && LIVE_SUBSCRIPTION_STATUSES.includes((sub.status || '').toLowerCase())) {
        candidates.push(asTier((sub.tier || '').toLowerCase()));
    }
    if (input.privilegedTier) candidates.push(input.privilegedTier);
    return candidates.reduce((best, t) => (RANK[t] > RANK[best] ? t : best), 'free' as PlanTier);
}

export const hasPaidExtensionAccess = (tier: PlanTier, isAdmin: boolean): boolean =>
    tier === 'brother' || tier === 'team' || isAdmin;

// ── Last-known plan cache (per server instance) ──
// Used only when Supabase is having a transient outage, so paying users are not
// locked out, while nobody without a recently verified plan gets paid access.
export const LAST_KNOWN_PLAN_TTL_MS = 6 * 60 * 60 * 1000;

export interface CachedPlan { tier: PlanTier; isAdmin: boolean; email: string; at: number }

export function readCachedPlan(cache: Map<string, CachedPlan>, userId: string, now = Date.now()): CachedPlan | null {
    const hit = cache.get(userId);
    if (!hit || now - hit.at > LAST_KNOWN_PLAN_TTL_MS) return null;
    return hit;
}

// ── Outage fallback limiter (per server instance) ──
// When the usage guard can't read its counters, allow a few requests per user
// per hour instead of skipping the guard entirely.
export const OUTAGE_REQUESTS_PER_HOUR = 5;

export function takeOutageAllowance(log: Map<string, number[]>, userId: string, now = Date.now()): boolean {
    const recent = (log.get(userId) || []).filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length >= OUTAGE_REQUESTS_PER_HOUR) {
        log.set(userId, recent);
        return false;
    }
    recent.push(now);
    log.set(userId, recent);
    return true;
}
