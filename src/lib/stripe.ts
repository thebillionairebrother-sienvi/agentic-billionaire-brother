import Stripe from 'stripe';

// When Stripe keys are not configured, enable test mode
export const STRIPE_TEST_MODE = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'your-stripe-secret-key';

export const stripe = STRIPE_TEST_MODE
    ? (null as unknown as Stripe) // Not used in test mode
    : new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2026-01-28.clover',
    });

/** @deprecated Use STRIPE_PRICE_IDS from plan-gating.ts instead */
export const PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_test_dummy';

// Per-tier price IDs
export const PRICE_ID_BROTHER = process.env.STRIPE_PRICE_ID_BROTHER || '';
export const PRICE_ID_TEAM = process.env.STRIPE_PRICE_ID_TEAM || '';
