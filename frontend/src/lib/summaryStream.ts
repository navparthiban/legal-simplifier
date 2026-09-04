/**
 * Streaming-summary partial extractors, ported VERBATIM from index.html
 * (`_sumPartialStr`, `_sumCompleteArr`, `_sumExtractPartial`). These read
 * an in-progress JSON string as it streams so the summary screen can fill in
 * fields the moment they complete.
 */
import type { Risk, StreamingPartial } from './types';

// Reads an in-progress JSON string value for `field` from `text`.
// Returns { value, complete } when the opening quote is found, or null if the
// field hasn't started yet.
export function _sumPartialStr(
  text: string,
  field: string,
): { value: string; complete: boolean } | null {
  const idx = text.indexOf(`"${field}"`);
  if (idx === -1) return null;
  const colonPos = text.indexOf(':', idx + field.length + 2);
  if (colonPos === -1) return null;
  const rest = text.slice(colonPos + 1).trimStart();
  if (!rest.startsWith('"')) return null;

  let out = '',
    i = 1;
  while (i < rest.length) {
    const c = rest[i];
    if (c === '\\' && i + 1 < rest.length) {
      const esc = rest[i + 1];
      out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc;
      i += 2;
    } else if (c === '"') {
      return { value: out, complete: true };
    } else {
      out += c;
      i++;
    }
  }
  return out.length ? { value: out, complete: false } : null;
}

// Returns a parsed array for `field` once the closing ] is found, else null.
export function _sumCompleteArr(text: string, field: string): any[] | null {
  const idx = text.indexOf(`"${field}"`);
  if (idx === -1) return null;
  const start = text.indexOf('[', idx);
  if (start === -1) return null;

  let depth = 0,
    inStr = false,
    esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\' && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      if (--depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function _sumExtractPartial(text: string): StreamingPartial {
  return {
    title: _sumPartialStr(text, 'title'),
    parties: _sumPartialStr(text, 'parties'),
    obligations: _sumCompleteArr(text, 'obligations') as string[] | null,
    deadlines: _sumCompleteArr(text, 'deadlines') as string[] | null,
    rights: _sumCompleteArr(text, 'rights') as string[] | null,
    risks: _sumCompleteArr(text, 'risks') as Risk[] | null,
  };
}
