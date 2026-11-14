/**
 * Input checks for the /api routes. Pure functions (no req/res) so they are
 * easy to unit-test. They reject input the real frontend could never send.
 */
import type { SummaryData } from './openrouter.js';

/** Text cap. The frontend cuts PDFs at 50,000 chars (lib/pdf.ts); the rest is headroom. */
export const MAX_TEXT_CHARS = 60_000;
/** Matches the frontend's MAX_SCAN_PAGES (lib/pdf.ts). */
export const MAX_IMAGE_PAGES = 8;

const MAX_SHORT_CHARS = 500; // title, parties
const MAX_ITEM_CHARS = 1_000; // each list item
const MAX_ITEMS = 10;

export type ContentCheck =
  | { ok: true; content: string | string[] }
  | { ok: false; error: string };

const isImageUrl = (x: unknown): x is string =>
  typeof x === 'string' && x.startsWith('data:image/');

/**
 * Text: a string of 1 to MAX_TEXT_CHARS characters.
 * Image: one `data:image/` string, or an array of 1 to MAX_IMAGE_PAGES of them.
 */
export function checkContent(content: unknown, isImage: boolean): ContentCheck {
  if (!isImage) {
    if (typeof content !== 'string' || content.length === 0) {
      return { ok: false, error: 'Missing contract content.' };
    }
    if (content.length > MAX_TEXT_CHARS) {
      return { ok: false, error: 'Contract text is too long.' };
    }
    return { ok: true, content };
  }
  if (isImageUrl(content)) return { ok: true, content };
  if (Array.isArray(content) && content.length > 0) {
    if (content.length > MAX_IMAGE_PAGES) {
      return { ok: false, error: 'Too many contract pages.' };
    }
    if (content.every(isImageUrl)) return { ok: true, content };
  }
  return { ok: false, error: 'Missing contract content.' };
}

const cleanString = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;

function cleanList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const items = v
    .map((x) => cleanString(x, MAX_ITEM_CHARS))
    .filter((x): x is string => x !== undefined)
    .slice(0, MAX_ITEMS);
  return items.length > 0 ? items : undefined;
}

function cleanRisks(v: unknown): SummaryData['risks'] {
  if (!Array.isArray(v)) return undefined;
  const risks = v
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      title: cleanString(r.title, MAX_ITEM_CHARS),
      description: cleanString(r.description, MAX_ITEM_CHARS),
    }))
    .filter((r) => r.title !== undefined || r.description !== undefined)
    .map((r) => ({ title: r.title ?? '', description: r.description ?? '' }))
    .slice(0, MAX_ITEMS);
  return risks.length > 0 ? risks : undefined;
}

/**
 * Builds a fresh SummaryData with only the known fields, cut to safe sizes.
 * Unknown fields and wrong types are dropped. Returns null if nothing usable is left.
 */
export function cleanSummaryData(raw: unknown): SummaryData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const fields: SummaryData = {
    title: cleanString(r.title, MAX_SHORT_CHARS),
    parties: cleanString(r.parties, MAX_SHORT_CHARS),
    obligations: cleanList(r.obligations),
    deadlines: cleanList(r.deadlines),
    rights: cleanList(r.rights),
    risks: cleanRisks(r.risks),
  };
  const clean: SummaryData = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
  }
  return Object.keys(clean).length > 0 ? clean : null;
}
