// Checks for src/lib/extension-element-targets.ts.
// Run: node scripts/verify-extension-element-targets.mjs  (Node 23.6+ strips types natively)
import assert from 'node:assert/strict';
import {
    sanitizeElements,
    formatElementsForPrompt,
    sanitizeElementTargets,
} from '../src/lib/extension-element-targets.ts';

const elements = sanitizeElements([
    { id: 'bb-1', role: 'headline', region: 'hero', tag: 'h1', text: '  Build funnels\n that convert. ' },
    { id: 'bb-2', role: 'cta', region: 'hero', tag: 'button', text: 'Get Started' },
    { id: 'bb-2', role: 'cta', region: 'nav', tag: 'a', text: 'Duplicate id' },
    { id: 'evil"]; drop', role: 'cta', region: 'hero', tag: 'a', text: 'Bad id' },
    { id: 'bb-3', role: 'pricing', region: 'main', tag: 'div', text: '' },
    { id: 'bb-4', text: 'x'.repeat(500) },
    'not an object',
]);
assert.deepEqual(elements.map(e => e.id), ['bb-1', 'bb-2', 'bb-4']);
assert.equal(elements[0].text, 'Build funnels that convert.');
assert.equal(elements[2].text.length, 160);
assert.equal(elements[2].role, 'copy');
assert.deepEqual(sanitizeElements(undefined), []);
assert.equal(sanitizeElements(Array.from({ length: 200 }, (_, i) => ({ id: `bb-${i + 1}`, text: 't' }))).length, 80);

const prompt = formatElementsForPrompt(elements);
assert.match(prompt, /bb-2 \| cta \| hero \| <button> "Get Started"/);
assert.match(prompt, /elementTargets/);
assert.equal(formatElementsForPrompt([]), '');

const result = {
    whatIsWeak: ['The "Get Started" button is generic.', 'Overall tone is bland.'],
    topConversionLeaks: ['Headline is vague.'],
};
const targets = sanitizeElementTargets(
    [
        { finding: 'The "Get Started" button is generic.', elementId: 'bb-2' },
        { finding: 'The "Get Started" button is generic.', elementId: 'bb-1' }, // second target for same finding
        { finding: 'Headline is vague.', elementId: ' bb-1 ' },
        { finding: 'Headline is vague!', elementId: 'bb-1' }, // not an exact finding
        { finding: 'Overall tone is bland.', elementId: 'bb-99' }, // unknown id
        null,
    ],
    result,
    elements
);
assert.deepEqual(targets, [
    { finding: 'The "Get Started" button is generic.', elementId: 'bb-2' },
    { finding: 'Headline is vague.', elementId: 'bb-1' },
]);
assert.deepEqual(sanitizeElementTargets(targets, result, []), []);
assert.deepEqual(sanitizeElementTargets('nope', result, elements), []);

console.log('extension element-target checks passed');
