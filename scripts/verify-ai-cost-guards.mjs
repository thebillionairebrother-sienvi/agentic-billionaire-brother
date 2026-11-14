// Checks for the AI cost / access guards: guest chat limits and extension plan rules.
// Run: node scripts/verify-ai-cost-guards.mjs  (Node 23.6+ strips types natively)
import assert from 'node:assert/strict';
import {
    clientIp,
    guestLimits,
    isGuestAllowed,
    trimChatHistory,
    MAX_HISTORY_MESSAGES,
    MAX_HISTORY_CHARS,
    MAX_MESSAGE_CHARS,
} from '../src/lib/security/guest-limits.ts';
import {
    decideExtensionTier,
    hasPaidExtensionAccess,
    readCachedPlan,
    takeOutageAllowance,
    LAST_KNOWN_PLAN_TTL_MS,
    OUTAGE_REQUESTS_PER_HOUR,
} from '../src/lib/extension-plan.ts';

// ── Guest limits ──
assert.deepEqual(guestLimits({}), { perIpDaily: 10, globalDaily: 300 });
assert.deepEqual(guestLimits({ GUEST_CHAT_PER_IP_DAILY: '4', GUEST_CHAT_GLOBAL_DAILY: '50' }), { perIpDaily: 4, globalDaily: 50 });
assert.deepEqual(guestLimits({ GUEST_CHAT_PER_IP_DAILY: '-1', GUEST_CHAT_GLOBAL_DAILY: 'lots' }), { perIpDaily: 10, globalDaily: 300 });

const L = { perIpDaily: 3, globalDaily: 5 };
assert.equal(isGuestAllowed({ ipCount: 1, globalCount: 1 }, L), true);
assert.equal(isGuestAllowed({ ipCount: 3, globalCount: 5 }, L), true, 'counts include the current request');
assert.equal(isGuestAllowed({ ipCount: 4, globalCount: 4 }, L), false, 'per-IP limit');
assert.equal(isGuestAllowed({ ipCount: 1, globalCount: 6 }, L), false, 'global limit');
assert.equal(isGuestAllowed(null, L), false, 'counter unavailable fails closed');

const h = (o) => new Headers(o);
assert.equal(clientIp(h({ 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })), '1.1.1.1');
assert.equal(clientIp(h({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '9.9.9.9' })), '2.2.2.2');
assert.equal(clientIp(h({ 'x-forwarded-for': '3.3.3.3, 10.0.0.1' })), '3.3.3.3');
assert.equal(clientIp(h({})), 'unknown');

assert.deepEqual(trimChatHistory(null), []);
assert.deepEqual(trimChatHistory([{ role: 'user', content: 1 }, 'x', null]), []);
const long = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
const kept = trimChatHistory(long);
assert.equal(kept.length, MAX_HISTORY_MESSAGES);
assert.equal(kept.at(-1).content, 'm39', 'keeps the most recent messages');
const huge = Array.from({ length: 10 }, () => ({ role: 'user', content: 'x'.repeat(5000) }));
const trimmedHuge = trimChatHistory(huge);
assert.ok(trimmedHuge.every((m) => m.content.length <= MAX_MESSAGE_CHARS));
assert.ok(trimmedHuge.reduce((n, m) => n + m.content.length, 0) <= MAX_HISTORY_CHARS);

// ── Extension plan ──
assert.equal(decideExtensionTier({ usersTier: 'brother' }), 'brother');
assert.equal(decideExtensionTier({ usersTier: 'free' }), 'free');
assert.equal(decideExtensionTier({ usersTier: null }), 'free');
assert.equal(decideExtensionTier({ usersTier: 'free', subscription: { tier: 'brother', status: 'trialing' } }), 'brother');
assert.equal(decideExtensionTier({ usersTier: 'free', subscription: { tier: 'brother', status: 'past_due' } }), 'brother');
assert.equal(decideExtensionTier({ usersTier: 'free', subscription: { tier: 'brother', status: 'cancelled' } }), 'free',
    'cancelled subscription rows keep their tier name but must not grant access');
assert.equal(decideExtensionTier({ usersTier: 'free', subscription: { tier: 'team', status: 'canceled' } }), 'free');
assert.equal(decideExtensionTier({ usersTier: 'brother', subscription: { tier: 'team', status: 'active' } }), 'team');
assert.equal(decideExtensionTier({ usersTier: 'free', privilegedTier: 'team' }), 'team');
assert.equal(decideExtensionTier({ usersTier: 'TEAM' }), 'team');
assert.equal(decideExtensionTier({ usersTier: 'gold' }), 'free');
assert.equal(hasPaidExtensionAccess('free', false), false);
assert.equal(hasPaidExtensionAccess('free', true), true);
assert.equal(hasPaidExtensionAccess('brother', false), true);

const cache = new Map([['u1', { tier: 'brother', isAdmin: false, email: 'a@b.c', at: 1000 }]]);
assert.equal(readCachedPlan(cache, 'u1', 1000 + LAST_KNOWN_PLAN_TTL_MS)?.tier, 'brother');
assert.equal(readCachedPlan(cache, 'u1', 1001 + LAST_KNOWN_PLAN_TTL_MS), null, 'expired');
assert.equal(readCachedPlan(cache, 'u2', 1000), null);

const log = new Map();
for (let i = 0; i < OUTAGE_REQUESTS_PER_HOUR; i++) assert.equal(takeOutageAllowance(log, 'u1', 1000 + i), true);
assert.equal(takeOutageAllowance(log, 'u1', 2000), false, 'allowance used up');
assert.equal(takeOutageAllowance(log, 'u2', 2000), true, 'per user');
assert.equal(takeOutageAllowance(log, 'u1', 1000 + 60 * 60 * 1000 + 10), true, 'window slides');

console.log('verify-ai-cost-guards: all checks passed');
