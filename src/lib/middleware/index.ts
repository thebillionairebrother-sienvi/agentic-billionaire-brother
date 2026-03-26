/**
 * AI Middleware — Barrel Export
 *
 * Import everything from '@/lib/middleware' in API routes.
 */
export { buildAiContext, GuardError } from './compose';
export type { AiContext } from './compose';
export { guardErrorResponse } from './types';
export type { DailyUsage, MonthlyUsage } from './types';
export { checkKillSwitch } from './kill-switch';
export { getSubscriptionInfo } from './subscription';
export { checkUsageGuard, getDailyUsage, getMonthlyUsage } from './usage-guard';
export { resolveTokenBudget } from './token-budget';
export { logUsageAndCost } from './meter-logger';
export type { MeterLogEntry } from './meter-logger';
