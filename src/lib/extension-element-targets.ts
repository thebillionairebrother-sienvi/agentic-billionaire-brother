// Element targeting for extension audits.
//
// The extension tags audit-relevant elements on the live page with data-bb-id
// and sends them as snapshot.elements ({ id, role, region, tag, text }). We show
// that list to the model and ask it to return elementTargets: which element each
// whatIsWeak / topConversionLeaks finding refers to. The extension then
// highlights that exact element instead of guessing from the finding's wording.
//
// Kept dependency-free so scripts/verify-extension-element-targets.mts can run
// it directly with Node.

export interface PageElementRef {
    id: string;
    role: string;
    region: string;
    tag: string;
    text: string;
}

export interface ElementTarget {
    finding: string;
    elementId: string;
}

const MAX_ELEMENTS = 80;
const MAX_TEXT = 160;
const ID_PATTERN = /^bb-\d{1,5}$/;

const clean = (value: unknown, max: number): string =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

// Validates the client-supplied element list; anything malformed is dropped.
export function sanitizeElements(raw: unknown): PageElementRef[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: PageElementRef[] = [];
    for (const item of raw) {
        if (out.length >= MAX_ELEMENTS) break;
        const id = clean(item?.id, 12);
        const text = clean(item?.text, MAX_TEXT);
        if (!ID_PATTERN.test(id) || !text || seen.has(id)) continue;
        seen.add(id);
        out.push({
            id,
            role: clean(item?.role, 20) || 'copy',
            region: clean(item?.region, 20) || 'main',
            tag: clean(item?.tag, 20) || 'element',
            text,
        });
    }
    return out;
}

// Prompt section listing the elements, or '' when the snapshot has none
// (older extension versions, sub-page-only data).
export function formatElementsForPrompt(elements: PageElementRef[]): string {
    if (elements.length === 0) return '';
    const lines = elements.map(e => `${e.id} | ${e.role} | ${e.region} | <${e.tag}> ${JSON.stringify(e.text)}`);
    return (
        `\n\nTagged page elements on the active page (id | role | region | text):\n${lines.join('\n')}\n` +
        `For every whatIsWeak or topConversionLeaks item that is about one specific element listed above, add an entry to elementTargets ` +
        `with "finding" set to that item's exact text (character for character) and "elementId" set to the element's id. ` +
        `Only use ids from this list. Omit findings that are page-wide or that don't map to a single listed element.`
    );
}

// Keeps only targets whose finding exactly matches a returned finding and whose
// id was in the snapshot; one target per finding.
export function sanitizeElementTargets(
    rawTargets: unknown,
    result: { whatIsWeak?: unknown; topConversionLeaks?: unknown },
    elements: PageElementRef[]
): ElementTarget[] {
    if (!Array.isArray(rawTargets) || elements.length === 0) return [];
    const validIds = new Set(elements.map(e => e.id));
    const findings = new Set<string>(
        [result.whatIsWeak, result.topConversionLeaks]
            .flatMap(list => (Array.isArray(list) ? list : []))
            .filter((f): f is string => typeof f === 'string')
    );

    const out: ElementTarget[] = [];
    const used = new Set<string>();
    for (const t of rawTargets) {
        const finding = typeof t?.finding === 'string' ? t.finding : '';
        const elementId = typeof t?.elementId === 'string' ? t.elementId.trim() : '';
        if (!findings.has(finding) || !validIds.has(elementId) || used.has(finding)) continue;
        used.add(finding);
        out.push({ finding, elementId });
    }
    return out;
}
