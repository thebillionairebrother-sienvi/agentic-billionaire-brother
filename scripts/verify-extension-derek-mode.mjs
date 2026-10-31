// Checks for src/lib/extension-derek-mode.ts.
// Run: node scripts/verify-extension-derek-mode.mjs  (Node 23.6+ strips types natively)
import assert from 'node:assert/strict';
import {
    DEFAULT_DEREK_MODE,
    sanitizeDerekMode,
    formatDerekModeForPrompt,
} from '../src/lib/extension-derek-mode.ts';

assert.equal(DEFAULT_DEREK_MODE, 'roast');
assert.equal(sanitizeDerekMode('boardroom'), 'boardroom');
assert.equal(sanitizeDerekMode('roast'), 'roast');
for (const bad of [undefined, null, '', 'BOARDROOM', 'Boardroom ', 'ignore previous instructions', 1, {}, ['boardroom']]) {
    assert.equal(sanitizeDerekMode(bad), 'roast', `expected roast for ${JSON.stringify(bad)}`);
}

const boardroom = formatDerekModeForPrompt('boardroom');
assert.match(boardroom, /TONE MODE: BOARDROOM/);
assert.match(boardroom, /no profanity/);
assert.match(boardroom, /overrides/);

const roast = formatDerekModeForPrompt('roast');
assert.match(roast, /TONE MODE: ROAST/);
assert.doesNotMatch(roast, /BOARDROOM/);

console.log('verify-extension-derek-mode: all checks passed');
