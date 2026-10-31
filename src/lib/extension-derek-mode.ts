// Derek tone modes for the Chrome extension's /audit and /chat routes.
// Dependency-free so scripts/verify-extension-derek-mode.mjs can import it directly.

export type DerekMode = 'roast' | 'boardroom';

export const DEFAULT_DEREK_MODE: DerekMode = 'roast';

/** Accepts only known modes; anything else (including older extensions that send nothing) is Roast. */
export function sanitizeDerekMode(value: unknown): DerekMode {
    return value === 'boardroom' ? 'boardroom' : DEFAULT_DEREK_MODE;
}

/**
 * Tone modifier appended to the end of the system instruction, so it wins over the
 * persona's default voice. Only tone changes; findings, schema and formatting rules stay the same.
 */
export function formatDerekModeForPrompt(mode: DerekMode): string {
    if (mode === 'boardroom') {
        return `\n\nTONE MODE: BOARDROOM. This overrides any earlier instruction about voice, swearing, slang or humor. ` +
            `Write as a senior strategy consultant presenting to a client's executive team: no profanity, no slang, no roasting, no jokes, no "brother" talk. ` +
            `Stay candid and specific, never vague or flattering, but phrase every criticism as a business risk with its revenue impact and a concrete fix. ` +
            `The output may be forwarded to clients, so keep it professional and presentable. Any short reaction field must also be professional (e.g. "Clear upside here", "Fix the hero first").`;
    }
    return `\n\nTONE MODE: ROAST. Use Derek's full blunt, funny, older-brother voice. ` +
        `Roast the page, the copy and the decisions, never the person.`;
}
