import ai from '@/lib/gemini';

/**
 * generateContent with the extension's 503/"high demand" fallback chain: one quick retry on the
 * primary model, then the fallback models, each attempt capped at 28s. Throws the first
 * high-demand error when every model fails, so the extension's errors.ts classifies it as 503.
 * Shared by /api/extension/audit and /api/extension/battle (route files can't export helpers).
 */
export async function generateExtensionContentWithRetry(primaryModel: string, args: any, logLabel = 'extension/audit') {
    const candidateModels = Array.from(
        new Set([
            primaryModel,
            'gemini-3-flash-preview',
            'gemini-2.5-flash',
            'gemini-3.1-flash-lite-preview',
            'gemini-flash-latest',
        ])
    );
    let lastError: any = null;
    let firstDemandError: any = null;
    const PER_ATTEMPT_TIMEOUT_MS = 28000;

    for (const model of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
            // Abort the request itself on timeout, so a slow attempt doesn't keep
            // running (and holding the function open) while the next model is tried.
            const controller = new AbortController();
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const callPromise = ai.models.generateContent({
                    model,
                    ...args,
                    config: { ...(args?.config || {}), abortSignal: controller.signal },
                });
                const timeoutPromise = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error(`503 UNAVAILABLE: Model ${model} is experiencing high demand and timed out after ${PER_ATTEMPT_TIMEOUT_MS / 1000}s.`));
                    }, PER_ATTEMPT_TIMEOUT_MS);
                });
                return await Promise.race([callPromise, timeoutPromise]);
            } catch (err: any) {
                lastError = err;
                const msg = (err?.message || '').toString();
                const is503Unavailable =
                    err?.status === 503 ||
                    msg.includes('503') ||
                    msg.toLowerCase().includes('high demand') ||
                    msg.includes('UNAVAILABLE') ||
                    msg.toLowerCase().includes('overloaded');
                if (is503Unavailable && !firstDemandError) {
                    firstDemandError = err;
                }
                if (is503Unavailable && attempt === 0 && model === primaryModel) {
                    console.warn(`[${logLabel}] Model ${model} busy (503), retrying in 600ms...`);
                    await new Promise(r => setTimeout(r, 600));
                    continue;
                }
                console.warn(`[${logLabel}] Model ${model} failed (${err?.status || msg}). Trying next fallback...`);
                break;
            } finally {
                clearTimeout(timer);
            }
        }
    }
    throw firstDemandError || lastError || new Error(`503 UNAVAILABLE: Model ${primaryModel} is currently experiencing high demand.`);
}
