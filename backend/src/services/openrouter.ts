/**
 * OpenRouter client. This is the ONLY place the API key is read or sent.
 *
 * The system prompts, the language instruction strings, the vision/text message
 * shapes, and the two array-response parsers below are ported verbatim from the
 * old client-side `index.html` so the model sees byte-identical input and the
 * responses are cleaned identically. Do not "improve" the wording here — see
 * docs/superpowers/specs/2026-09-03-fullstack-restructure-design.md → Parity
 * Guarantee.
 */

export const MODEL = 'openrouter/free';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export type Language = 'en' | 'es';

export interface SummaryData {
  title?: string;
  parties?: string;
  obligations?: string[];
  deadlines?: string[];
  rights?: string[];
  risks?: { title?: string; description?: string }[];
}

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'user';
      content: (
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      )[];
    };

// ── Prompt building ────────────────────────────────────────────────────────────

const summaryLangInstruction = (language: Language) =>
  language === 'es'
    ? 'IMPORTANT: Write ALL output — every field value, every string — in Spanish. Do not use English anywhere in the JSON values.'
    : 'Write all output in English.';

const quizLangInstruction = (language: Language) =>
  language === 'es'
    ? 'IMPORTANT: Write ALL questions and ALL answer options in Spanish. Do not use English anywhere.'
    : 'Write all questions and answer options in English.';

const summarySystemPrompt = (language: Language) =>
  `You are a legal contract analyser. Read the contract and respond with ONLY a valid JSON object — no markdown, no explanation, nothing else.

${summaryLangInstruction(language)}

Return exactly this structure:
{
  "title": "Name of the contract",
  "parties": "Who is involved and the effective date (one short sentence)",
  "obligations": ["Plain-language obligation 1", "..."],
  "deadlines": ["Plain-language deadline 1", "..."],
  "rights": ["Plain-language right 1", "..."],
  "risks": [
    { "title": "Short risk title", "description": "Plain-language explanation of why this is risky" }
  ]
}

Rules:
- Write in plain language any non-lawyer can understand.
- Each array must have 3–5 items.
- For risks, flag clauses that are one-sided, unusual, or could harm the signer.
- Be specific — reference actual terms from the contract.`;

const preQuizSystemPrompt = (language: Language) =>
  `You are a quiz generator helping everyday people — like renters, employees, or small business owners — understand what a contract actually says. Based on the contract text provided, create exactly 5 multiple-choice questions. Respond with ONLY a valid JSON array — no markdown, no explanation, nothing else.

${quizLangInstruction(language)}

Return exactly this structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]

Rules:
- "correct" is the zero-based index of the correct answer in the options array.
- Each question must have exactly 4 options.
- Write every question in plain, everyday English — no legal jargon, no Latin phrases, no complex terminology. A 10th-grader should be able to read and understand the question.
- Ask about the practical meaning or real-world impact of what the contract says: what someone must do, what they're not allowed to do, what happens if something goes wrong, how long something lasts, who pays for what, etc.
- Use simple question stems like "What must [party] do if…", "How long does…", "Who pays for…", "What happens if…", "Which of these is NOT allowed under this contract?".
- All 4 options must be realistic and specific — no option should be obviously silly, vague, or a clear throwaway. A reader who hasn't read the contract should find all 4 options believable.
- The correct answer must come directly from the contract text — not something that could be guessed from common sense alone.
- Never use "Yes" or "No" as an answer option. Never phrase questions as true/false.
- Answer options MUST match the type of question: if the question asks "how much", all options must be dollar amounts or quantities; if it asks "how long", all options must be time durations; if it asks "who", all options must be people or parties; if it asks "what happens", all options must describe outcomes or consequences. Never mix answer types (e.g., do not pair dollar amounts with yes/no/never responses).
- Every wrong answer option must be grounded in the contract — use plausible values that could have appeared in the contract (e.g., nearby amounts, similar time periods, related parties) rather than invented or generic filler. Do not fabricate details that contradict or have no basis in the contract text.
- Cover different parts of the contract across the 5 questions: e.g., payment, time limits, responsibilities, what's not allowed, and consequences for breaking the agreement.`;

const quizSystemPrompt = (language: Language) =>
  `You are a quiz generator helping everyday people — like renters, employees, or small business owners — check their understanding of a contract summary. Based on the plain-language summary provided, create exactly 5 multiple-choice questions. Respond with ONLY a valid JSON array — no markdown, no explanation, nothing else.

${quizLangInstruction(language)}

Return exactly this structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]

Rules:
- "correct" is the zero-based index of the correct answer in the options array.
- Each question must have exactly 4 options.
- Write every question in plain, everyday English — no legal jargon, no Latin phrases, no complex terminology. A 10th-grader should be able to read and understand the question.
- Ask about practical, real-world details from the summary: what someone must do, what they're not allowed to do, what happens if something goes wrong, how long something lasts, who pays for what, etc.
- Use simple question stems like "What must [party] do if…", "How long does…", "Who pays for…", "What happens if…", "Which of these is NOT allowed under this contract?".
- All 4 options must be realistic and specific — no option should be obviously silly, vague, or a clear throwaway. A reader who hasn't read the summary should find all 4 options believable.
- The correct answer must come directly from the summary — not something that could be guessed from common sense alone.
- Never use "Yes" or "No" as an answer option. Never phrase questions as true/false.
- Answer options MUST match the type of question: if the question asks "how much", all options must be dollar amounts or quantities; if it asks "how long", all options must be time durations; if it asks "who", all options must be people or parties; if it asks "what happens", all options must describe outcomes or consequences. Never mix answer types (e.g., do not pair dollar amounts with yes/no/never responses).
- Every wrong answer option must be grounded in the summary — use plausible values that could have appeared in the contract (e.g., nearby amounts, similar time periods, related parties) rather than invented or generic filler. Do not fabricate details that contradict or have no basis in the summary.
- Cover different parts of the contract across the 5 questions: e.g., payment, time limits, responsibilities, what's not allowed, and consequences for breaking the agreement.`;

const summaryTextFrom = (s: SummaryData) =>
  `
Title: ${s.title || ''}
Parties: ${s.parties || ''}
Obligations: ${(s.obligations || []).join(' | ')}
Deadlines: ${(s.deadlines || []).join(' | ')}
Rights: ${(s.rights || []).join(' | ')}
Risks: ${(s.risks || []).map((r) => r.title + ': ' + r.description).join(' | ')}
      `.trim();

export function buildSummaryMessages(
  content: string,
  isImage: boolean,
  language: Language,
): ChatMessage[] {
  const systemPrompt = summarySystemPrompt(language);
  if (isImage) {
    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is the contract image. Analyse it and return the JSON.' },
          { type: 'image_url', image_url: { url: content } },
        ],
      },
    ];
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Here is the contract text:\n\n${content}` },
  ];
}

export function buildPreQuizMessages(
  content: string,
  isImage: boolean,
  language: Language,
): ChatMessage[] {
  const systemPrompt = preQuizSystemPrompt(language);
  if (isImage) {
    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Here is the contract image. Generate 5 quiz questions based on the original legal language.',
          },
          { type: 'image_url', image_url: { url: content } },
        ],
      },
    ];
  }
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Here is the contract text:\n\n${content}` },
  ];
}

export function buildQuizMessages(summaryData: SummaryData, language: Language): ChatMessage[] {
  return [
    { role: 'system', content: quizSystemPrompt(language) },
    { role: 'user', content: `Here is the contract summary:\n\n${summaryTextFrom(summaryData)}` },
  ];
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

function authHeaders() {
  const key = process.env.OPENROUTER_KEY;
  if (!key) {
    throw new Error('OPENROUTER_KEY is not set. Copy backend/.env.example to backend/.env and add your key.');
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
    'X-Title': 'ClearSign',
  };
}

/** Ported from the `if (!res.ok)` blocks in index.html — identical message. */
async function errorFromResponse(res: Response): Promise<Error> {
  const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return new Error(err?.error?.message || `API error (${res.status}). Please try again.`);
}

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model: MODEL, messages }),
  });
  if (!res.ok) throw await errorFromResponse(res);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data?.choices?.[0]?.message?.content ?? '';
}

/** Returns the raw upstream streaming response for the summary passthrough route. */
export async function chatCompletionStream(messages: ChatMessage[]): Promise<Response> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ model: MODEL, messages, stream: true }),
  });
  if (!res.ok) throw await errorFromResponse(res);
  return res;
}

// ── Response parsers (ported verbatim) ────────────────────────────────────────

/** Ported from callOpenRouterForPreQuiz's inline cleaner (index.html ~2042). */
export function parsePreQuizJSON(raw: string): unknown {
  let cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    cleaned = cleaned.slice(arrStart, arrEnd + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const fixed = cleaned.replace(/,\s*([\]}])/g, '$1');
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error('The AI returned an unexpected response. Please try again.');
    }
  }
}

/** Ported from callOpenRouterForQuiz's inline cleaner (index.html ~2452). */
export function parseQuizJSON(raw: string): unknown {
  let cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  const arrStart = cleaned.indexOf('[');
  const arrEnd = cleaned.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) cleaned = cleaned.slice(arrStart, arrEnd + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('The AI returned an unexpected response. Please try again.');
  }
}
