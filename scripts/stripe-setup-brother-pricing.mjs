#!/usr/bin/env node
/**
 * Create the Brother pricing objects in Stripe (idempotent):
 *   - Price  $49.00 USD / month, lookup_key "bb_brother_monthly_4900",
 *     on the existing BB-Brother product
 *   - Coupon "bb-brother-first-month-39": $10 off once ($39 first month),
 *     restricted to the BB-Brother product
 *
 *   node scripts/stripe-setup-brother-pricing.mjs                 # dry run
 *   node scripts/stripe-setup-brother-pricing.mjs --apply         # create
 *   node scripts/stripe-setup-brother-pricing.mjs --env .env.staging --apply
 *
 * Run against TEST keys first. The live account is shared with other Sienvi
 * products; this script only adds a price and coupon, plus bb_* metadata on
 * the BB-Brother product. It never edits or archives existing prices.
 */
import fs from 'node:fs';

const LOOKUP_KEY = 'bb_brother_monthly_4900';
const COUPON_ID = 'bb-brother-first-month-39';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envPath = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.local';
const env = Object.fromEntries(
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
        .filter((l) => /^[A-Z0-9_]+=/.test(l))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }),
);
const key = env.STRIPE_SECRET_KEY;
const mode = key?.startsWith('sk_live') || key?.startsWith('rk_live') ? 'LIVE' : 'TEST';

async function stripe(method, path, params) {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params ? new URLSearchParams(params).toString() : undefined,
    });
    return res.json();
}

console.log(`Stripe mode: ${mode} · ${apply ? 'APPLY' : 'DRY RUN'} · env: ${envPath}`);

// Product: reuse the product of the existing Brother price; otherwise (e.g. a
// fresh test-mode account) find a product tagged bb_tier=brother or create one.
let productId;
const oldPrice = env.STRIPE_PRICE_ID_BROTHER ? await stripe('GET', `prices/${env.STRIPE_PRICE_ID_BROTHER}`) : { error: {} };
if (!oldPrice.error) {
    productId = oldPrice.product;
} else {
    const found = await stripe('GET', `products/search?query=${encodeURIComponent("metadata['bb_tier']:'brother' AND active:'true'")}`);
    productId = found.data?.[0]?.id;
    if (!productId && apply) {
        const p = await stripe('POST', 'products', { name: 'BB-Brother', 'metadata[bb_tier]': 'brother', 'metadata[app]': 'bb' });
        if (p.error) throw new Error(p.error.message);
        productId = p.id;
        console.log(`+ Created product ${productId}`);
    } else if (!productId) {
        console.log('- Would create product BB-Brother (no existing Brother product found)');
        process.exit(0);
    }
}
console.log(`Brother product: ${productId}`);

const existing = await stripe('GET', `prices?lookup_keys[]=${LOOKUP_KEY}&active=true`);
if (existing.data?.length) {
    const p = existing.data[0];
    console.log(`✓ Price exists: ${p.id} ${p.unit_amount / 100} ${p.currency}/${p.recurring?.interval}`);
} else if (apply) {
    const p = await stripe('POST', 'prices', {
        product: productId,
        unit_amount: '4900',
        currency: 'usd',
        'recurring[interval]': 'month',
        lookup_key: LOOKUP_KEY,
        nickname: 'Brother — $49/month (standard)',
        'metadata[app]': 'bb',
        'metadata[bb_tier]': 'brother',
    });
    if (p.error) throw new Error(p.error.message);
    console.log(`+ Created price ${p.id}`);
} else {
    console.log(`- Would create price $49.00 USD/month with lookup_key ${LOOKUP_KEY}`);
}

const coupon = await stripe('GET', `coupons/${COUPON_ID}`);
if (!coupon.error) {
    console.log(`✓ Coupon exists: ${coupon.id} amount_off=${coupon.amount_off} ${coupon.currency} duration=${coupon.duration}`);
} else if (apply) {
    const c = await stripe('POST', 'coupons', {
        id: COUPON_ID,
        name: 'Brother first month $39',
        amount_off: '1000',
        currency: 'usd',
        duration: 'once',
        'applies_to[products][0]': productId,
        'metadata[app]': 'bb',
    });
    if (c.error) throw new Error(c.error.message);
    console.log(`+ Created coupon ${c.id}`);
} else {
    console.log(`- Would create coupon ${COUPON_ID}: $10 off once, BB-Brother product only`);
}

// Product metadata so the webhook recognises the product even without env ids.
if (apply) {
    await stripe('POST', `products/${productId}`, { 'metadata[bb_tier]': 'brother', 'metadata[app]': 'bb' });
    console.log('✓ Product metadata bb_tier=brother set');
} else {
    console.log('- Would set product metadata bb_tier=brother');
}
