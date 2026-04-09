/**
 * Google Analytics 4 — typed event tracking helpers.
 *
 * Usage:
 *   import { trackEvent } from '@/lib/analytics';
 *   trackEvent('sign_up', { method: 'email' });
 */

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      params?: Record<string, unknown>
    ) => void;
    dataLayer: unknown[];
  }
}

/** Fire a custom GA4 event. Safe to call even before gtag is loaded. */
export function trackEvent(
  action: string,
  params?: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', action, params);
}

// ─── Pre-built event helpers ───────────────────────────────────────────────

/** Call after a user successfully signs up. */
export function trackSignUp(method: 'email' | 'google' | 'twitter' = 'email') {
  trackEvent('sign_up', { method });
}

/** Call when the user initiates the Stripe checkout flow. */
export function trackBeginCheckout(value?: number, currency = 'USD') {
  trackEvent('begin_checkout', { value, currency });
}

/** Call on Stripe webhook payment_intent.succeeded confirmation. */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency?: string;
  items?: { item_name: string; price: number }[];
}) {
  trackEvent('purchase', {
    transaction_id: params.transactionId,
    value: params.value,
    currency: params.currency ?? 'USD',
    items: params.items,
  });
}

/** Call when a user completes a lesson or module. */
export function trackLessonComplete(lessonId: string, lessonName: string) {
  trackEvent('lesson_complete', { lesson_id: lessonId, lesson_name: lessonName });
}

/** Call when a user sends a message to Derek (AI chat). */
export function trackDerekChat(messageCount: number) {
  trackEvent('derek_chat_message', { message_count: messageCount });
}
