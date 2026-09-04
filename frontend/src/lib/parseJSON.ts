/**
 * Ported VERBATIM from index.html `parseJSON` (the final authoritative parse of
 * the streamed summary). Strips markdown code fences, skips preamble before the
 * first `{`/`[`, tolerates trailing commas, and falls back to extracting the
 * outermost `{...}` block. Do not "clean up".
 */
export function parseJSON(raw: string): any {
  // Strip all backtick fences wherever they appear
  let s = raw.replace(/```(?:json)?/gi, '').trim();
  // Skip any preamble text before the first { or [
  const obj = s.indexOf('{'),
    arr = s.indexOf('[');
  if (obj !== -1 || arr !== -1) {
    const start = obj === -1 ? arr : arr === -1 ? obj : Math.min(obj, arr);
    s = s.slice(start);
  }
  // Remove trailing commas before } or ] — common LLM formatting mistake
  s = s.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(s);
  } catch {
    // Last-resort: extract the outermost {...} block and retry
    const match = s.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0].replace(/,(\s*[}\]])/g, '$1'));
      } catch {
        /* fall through */
      }
    }
    throw new Error('The AI returned an unexpected response. Please try again.');
  }
}
