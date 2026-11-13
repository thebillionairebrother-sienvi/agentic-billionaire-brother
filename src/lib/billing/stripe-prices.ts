/**
 * Server-only: resolves the live Brother price from Stripe so the offer page,
 * upgrade page and checkout all quote the exact Price object that is charged.
 */
import { stripe, STRIPE_TEST_MODE } from '@/lib/stripe';
import {
    BILLING_CURRENCY,
    BROTHER_INTRO_CENTS,
    BROTHER_INTRO_COUPON_ID,
    BROTHER_PRICE_LOOKUP_KEY,
    BROTHER_STANDARD_CENTS,
} from './config';

export interface ResolvedPrice {
    /** Stripe Price id, or null when Stripe isn't configured (display only). */
    priceId: string | null;
    productId: string | null;
    unitAmount: number;
    currency: string;
    interval: 'month' | 'year';
    /** Intro first-month amount when the intro coupon exists, else null. */
    introAmount: number | null;
    introCouponId: string | null;
    source: 'stripe' | 'fallback';
}

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; value: ResolvedPrice } | null = null;

const FALLBACK: ResolvedPrice = {
    priceId: null,
    productId: null,
    unitAmount: BROTHER_STANDARD_CENTS,
    currency: BILLING_CURRENCY,
    interval: 'month',
    introAmount: BROTHER_INTRO_CENTS,
    introCouponId: null,
    source: 'fallback',
};

export async function getBrotherPrice(): Promise<ResolvedPrice> {
    if (STRIPE_TEST_MODE) return FALLBACK;
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

    const list = await stripe.prices.list({ lookup_keys: [BROTHER_PRICE_LOOKUP_KEY], active: true, limit: 1 });
    const price = list.data[0];
    if (!price || price.unit_amount == null || !price.recurring) {
        throw new Error(`Stripe price with lookup_key "${BROTHER_PRICE_LOOKUP_KEY}" is missing. Run scripts/stripe-setup-brother-pricing.mjs.`);
    }

    let introAmount: number | null = null;
    let introCouponId: string | null = null;
    try {
        const coupon = await stripe.coupons.retrieve(BROTHER_INTRO_COUPON_ID);
        if (coupon.valid && coupon.amount_off && coupon.currency === price.currency && coupon.duration === 'once') {
            introAmount = price.unit_amount - coupon.amount_off;
            introCouponId = coupon.id;
        }
    } catch {
        // No intro coupon configured: everyone pays the standard price.
    }

    const value: ResolvedPrice = {
        priceId: price.id,
        productId: typeof price.product === 'string' ? price.product : price.product.id,
        unitAmount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring.interval === 'year' ? 'year' : 'month',
        introAmount,
        introCouponId,
        source: 'stripe',
    };
    cache = { at: Date.now(), value };
    return value;
}

/** Display-safe variant: never throws, falls back to configured amounts. */
export async function getBrotherPriceForDisplay(): Promise<ResolvedPrice> {
    try {
        return await getBrotherPrice();
    } catch (err) {
        console.error('[billing] price lookup failed, using fallback display price:', err);
        return FALLBACK;
    }
}
