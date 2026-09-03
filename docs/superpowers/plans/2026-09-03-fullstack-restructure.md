# ClearSign Full-Stack Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move ClearSign from a single `index.html` (hardcoded OpenRouter key,
client-side AI calls) to a React+TS frontend / Express+TS backend split with the
key server-side, preserving every screen's look, copy, and behavior exactly.

**Architecture:** Two independent npm packages in one repo (`backend/`,
`frontend/`), no monorepo tooling. Frontend calls only the backend; backend is
the sole OpenRouter client. `index.html` stays untouched and runnable as the
parity reference until the user confirms the migration end-to-end.

**Tech Stack:** Backend — Node 24, Express 4, TypeScript, tsx (dev), dotenv,
cors. Frontend — Vite 5, React 18, TypeScript, pdfjs-dist 3.11.174.

**Spec:** `docs/superpowers/specs/2026-09-03-fullstack-restructure-design.md`

## Global Constraints

- **Zero visual/content/functional drift.** CSS values copied byte-for-byte from
  `index.html` into `frontend/src/styles/global.css`. Every `TRANSLATIONS` string
  (en + es) copied verbatim into `frontend/src/i18n/translations.ts`. Markup
  structure (element types, class names, nesting, SVG paths) carried over
  mechanically into JSX. Logic bodies (`parseJSON`, streaming partial extractors,
  `validateQuestions`, quiz scoring, `showComparison` branching) ported
  unchanged — only the *mechanism* changes where forced (DOM class toggle →
  React state; base64 literal → fetched static file).
- **`index.html` is not edited or deleted** in this plan. It is the reference.
- **No automated test suite** (PRD P2, out of scope). Verification is: both
  packages build and type-check clean, the three backend routes respond to curl,
  and a screen-by-screen manual checklist is handed to the user.
- **PDF text cap:** 12,000 characters (`extractPdfText`).
- **Model:** `openrouter/free`. **Secrets:** `OPENROUTER_KEY` from
  `backend/.env` via `process.env`, never inlined. `.env` gitignored;
  `.env.example` committed blank.
- **Quiz answer shape:** `[{ question, options: [4], correct: <0-based idx> }]`.
- Node/npm confirmed present: node v24.14.1, npm 11.11.0.

---

## File Structure

### backend/
| File | Responsibility |
|---|---|
| `package.json` | deps: express, cors, dotenv; devDeps: typescript, tsx, @types/*. Scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist). |
| `tsconfig.json` | NodeNext, strict, `outDir dist`, `src` root. |
| `.env` | `OPENROUTER_KEY=sk-or-v1-...` (the existing key). **gitignored.** |
| `.env.example` | `OPENROUTER_KEY=` — committed. |
| `src/server.ts` | Express app: `cors()`, `express.json({ limit: '15mb' })` (image data URLs), mount `routes/api.ts` at `/api`, listen on `process.env.PORT ?? 8787`. |
| `src/services/openrouter.ts` | `MODEL` const; `chatCompletion(messages, { stream })` fetch wrapper adding `Authorization: Bearer ${process.env.OPENROUTER_KEY}`, `HTTP-Referer`, `X-Title`; the three response parsers ported verbatim: `parseSummaryJSON` (from `parseJSON`), `parsePreQuizJSON` (from the prequiz cleaner), `parseQuizJSON` (from the quiz cleaner); `buildMessages(kind, { content, isImage, language })` producing the exact system prompts + vision/text user messages from `index.html`. |
| `src/routes/api.ts` | `POST /api/prequiz` → `{ questions }`; `POST /api/summary` → pipe OpenRouter SSE bytes straight to the response (passthrough); `POST /api/quiz` → `{ questions }`. Error shape mirrors `index.html`: `{ error: <message> }`, message = `err?.error?.message || 'API error (<status>). Please try again.'`. |

### frontend/
| File | Responsibility |
|---|---|
| `package.json` / `tsconfig.json` / `tsconfig.node.json` / `vite.config.ts` | Vite React-TS. Dev proxy: `/api` and `/SampleRentalAgreement.pdf` → `http://localhost:8787`. |
| `index.html` | Vite entry (minimal — real markup is in components). `<div id="root">`. |
| `public/SampleRentalAgreement.pdf` | Copied from repo root. |
| `src/main.tsx` | React root, imports `styles/global.css`, wraps `<App/>` in `<AppProvider>`. |
| `src/pdfWorker.ts` | Sets `pdfjsLib.GlobalWorkerOptions.workerSrc` to the cdnjs 3.11.174 worker URL (same as `index.html`). |
| `src/styles/global.css` | All CSS from `index.html` `<style>` verbatim, minus nothing. Global (not CSS-modules) so selectors match. |
| `src/i18n/translations.ts` | `TRANSLATIONS` dict verbatim; `t(lang, key)` = exact `t()` logic. |
| `src/i18n/useTranslation.ts` | Hook: reads `language` from context, returns `t` bound + `language`. |
| `src/state/AppContext.tsx` | Provider holding `currentScreen`, `screenVisible`, `language`, `currentFile` (name only kept for display), `currentContent`, `isImage`, `currentSummaryData`, `preQuizScore`, `postQuizScore`, `error`. Exposes `showScreen(name)` replicating the 180ms fade dance + upload-screen reset side effects, `setLanguage`, `showError`/`hideError`, and setters. |
| `src/lib/api.ts` | `fetchPreQuiz({content,isImage,language})` → `Question[]`; `streamSummary({content,isImage,language}, onChunk)` → accumulated string (reads `response.body` ReadableStream, same SSE parse as `callOpenRouterStream`); `fetchQuiz({summaryData,language})` → `Question[]`. Throws `Error(message)` on non-ok, message ported from `index.html`. |
| `src/lib/pdf.ts` | `extractPdfText(file)` verbatim (12k cap, same errors). |
| `src/lib/image.ts` | `encodeImageBase64(file)` verbatim. |
| `src/lib/parseJSON.ts` | `parseJSON(raw)` verbatim (final summary parse). |
| `src/lib/summaryStream.ts` | `_sumPartialStr`, `_sumCompleteArr`, `_sumExtractPartial` verbatim. |
| `src/lib/quiz.ts` | `validateQuestions` verbatim; `escHtml` verbatim (used for parity even though React escapes — see note). |
| `src/lib/scoreCopy.ts` | pure helpers wrapping the label/message array lookups for pre-quiz, quiz, and `showComparison` delta branching — logic identical to `index.html`. |
| `src/components/Nav.tsx` | `<nav>` verbatim markup, brand click → `showScreen('home')`, lang toggle buttons. |
| `src/components/Footer.tsx` | `<footer>` verbatim. |
| `src/components/Screen.tsx` | Wrapper `<main class="screen active screen-visible">` applying the fade classes from context state. |
| `src/components/QuizQuestion.tsx` | One question card: `q-number`, `q-text`, four `q-option` buttons with the exact `opt-correct`/`opt-wrong`/`opt-dimmed`/disabled locking behavior from `selectAnswer`/`selectPreAnswer`. Reused by PreQuiz + Quiz. |
| `src/components/RiskItem.tsx` | `.risk-item` markup. |
| `src/components/SummaryList.tsx` | `.summary-list` `<ul>` renderer (mirrors `fillList`). |
| `src/screens/Home.tsx` | Hero + feature cards, verbatim markup + SVGs + `data-i18n` keys as `t(...)` calls. |
| `src/screens/Upload.tsx` | Back btn, heading, error banner (only rendered here — matches `index.html`), disclaimer checkbox gating `dropZone`/`fileInput`/`btnSample`, drop zone with drag handlers, accepted-types tags, sample row. Drives `handleFile`. |
| `src/screens/Loading.tsx` | Spinner + `loadingLabel` (from context) + `loading-sub`. |
| `src/screens/PreQuiz.tsx` | Back btn, inline loading state, heading, `prequiz-intro` (html), questions, results ring + "See the Simplified Summary" → `loadSummary`. |
| `src/screens/Summary.tsx` | Back btn, file chip, title/parties (with streaming skeleton + `stream-cursor`), the 4 sections, risk list, quiz CTA → `startQuiz`. Hosts streaming render. |
| `src/screens/Quiz.tsx` | Back btn, inline loading, heading, questions, results ring + Try Again / Back to Summary / See Your Progress. |
| `src/screens/Compare.tsx` | Two score cards, delta + message (positive/neutral/negative branching), Upload Another → `showScreen('home')`. |
| `src/App.tsx` | `<Nav/>`, then the current screen component chosen by `currentScreen`, then `<Footer/>`. Owns the `handleFile` / `loadSummary` / `startQuiz` / `showComparison` flow orchestration (the old top-level async functions), calling `lib/api` + context setters. |

### root
| File | Responsibility |
|---|---|
| `.gitignore` | `node_modules/`, `.env`, `dist/`, `build/`, `.DS_Store`. |
| `ARCHITECTURE.md` / `PRD.md` / `README.md` / `CLAUDE.md` | Updated in Phase 6. |

**Note on `escHtml`:** In `index.html` AI strings are injected via `innerHTML`,
so `escHtml` is a security necessity. In React, `{value}` in JSX is escaped
automatically, so rendering text nodes is already safe. The port renders all AI
strings as JSX text children (no `dangerouslySetInnerHTML` for AI content), which
is behaviorally equivalent to `escHtml` + `innerHTML`. `prequiz-intro` is the
only `dangerouslySetInnerHTML` (static translation string, matches
`data-i18n-html`). `escHtml` is kept in `lib/quiz.ts` for reference/parity but
not required on the render path.

---

## Phase 1 — Backend

**Deliverable:** three routes answering correctly against real OpenRouter, keyed
from `.env`.

- [ ] **1.1** Create root `.gitignore` (`node_modules/`, `.env`, `dist/`, `build/`, `.DS_Store`).
- [ ] **1.2** `backend/package.json` + `backend/tsconfig.json`. Scripts: `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`).
- [ ] **1.3** `backend/.env` with the existing key from `index.html:1467`; `backend/.env.example` blank. Verify `.env` is gitignored (`git status` shows it untracked/ignored).
- [ ] **1.4** `npm install` in `backend/`.
- [ ] **1.5** `src/services/openrouter.ts`: `MODEL`, `chatCompletion`, `buildMessages`, `parseSummaryJSON` / `parsePreQuizJSON` / `parseQuizJSON` — each ported verbatim from the corresponding block in `index.html` (summary system prompt lines 1838–1858 / 2255–2275; prequiz prompt 1977–2001; quiz prompt 2401–2425; prequiz parser 2042–2059; quiz parser 2452–2462; `parseJSON` 1905–1926).
- [ ] **1.6** `src/routes/api.ts`: the three handlers. `/api/summary` sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, and pipes the upstream `res.body` through unchanged. `/api/prequiz` and `/api/quiz` return `{ questions }`.
- [ ] **1.7** `src/server.ts`: wire it up, `express.json({ limit: '15mb' })`, `cors()`, listen on 8787.
- [ ] **1.8** `npm run typecheck` in `backend/` — expect clean.
- [ ] **1.9** Start `npm run dev`; curl each route:
  - `curl -s localhost:8787/api/prequiz -H 'content-type: application/json' -d '{"content":"Tenant shall pay $1200 rent on the 1st. Lease term 12 months. No pets.","isImage":false,"language":"en"}'` → JSON array of 5 questions.
  - `curl -N -s localhost:8787/api/summary -H 'content-type: application/json' -d '{"content":"<same>","isImage":false,"language":"en"}'` → streamed `data:` SSE lines ending `[DONE]`.
  - `curl -s localhost:8787/api/quiz -H 'content-type: application/json' -d '{"summaryData":{"title":"Lease","parties":"L and T","obligations":["Pay $1200 on the 1st"],"deadlines":["12 month term"],"rights":["Quiet enjoyment"],"risks":[{"title":"No pets","description":"Pets prohibited"}]},"language":"en"}'` → JSON array of 5 questions.
- [ ] **1.10** Commit: `feat(backend): Express + TS proxy for OpenRouter (prequiz/summary/quiz)`.

## Phase 2 — Frontend scaffold

**Deliverable:** `npm run dev` serves a static, pixel-correct Home screen; nav +
footer + language toggle work; nothing calls the backend yet.

- [ ] **2.1** Scaffold `frontend/` (Vite react-ts): `package.json`, `tsconfig*.json`, `vite.config.ts` (proxy `/api` + `/SampleRentalAgreement.pdf` → `:8787`), `index.html`, `src/main.tsx`, `src/vite-env.d.ts`. Add `pdfjs-dist@3.11.174`. `npm install`.
- [ ] **2.2** `src/styles/global.css` — paste the entire `<style>` block from `index.html` (lines 9–1067) verbatim. Add nothing.
- [ ] **2.3** `src/i18n/translations.ts` + `useTranslation.ts` — `TRANSLATIONS` verbatim (lines 1480–1661), `t()` logic verbatim (1664–1666).
- [ ] **2.4** `src/state/AppContext.tsx` — state + `showScreen` (fade dance from 1686–1714, incl. upload reset), `setLanguage` (1678–1683 minus DOM class lines), `showError`/`hideError`.
- [ ] **2.5** `src/components/Nav.tsx`, `Footer.tsx`, `Screen.tsx`.
- [ ] **2.6** `src/screens/Home.tsx` — verbatim markup from lines 1102–1140.
- [ ] **2.7** `src/App.tsx` rendering Nav + (Home only for now) + Footer. `src/pdfWorker.ts` imported in main.
- [ ] **2.8** `npm run build` (runs `tsc && vite build`) — expect clean. `npm run dev` and eyeball Home against `index.html` open side by side (EN + ES toggle).
- [ ] **2.9** Commit: `feat(frontend): Vite + React scaffold, ported styles/i18n, Home screen`.

## Phase 3 — Port screens (against running backend)

**Deliverable:** full 7-screen flow works end to end with the backend.

Port in flow order; after each, check against `index.html`.

- [ ] **3.1** `lib/pdf.ts`, `lib/image.ts`, `lib/parseJSON.ts`, `lib/summaryStream.ts`, `lib/quiz.ts`, `lib/scoreCopy.ts`, `lib/api.ts` — all verbatim ports per the File Structure table.
- [ ] **3.2** `components/QuizQuestion.tsx`, `RiskItem.tsx`, `SummaryList.tsx`.
- [ ] **3.3** `screens/Upload.tsx` + wire `handleFile` in `App.tsx` (lines 1772–1801): disclaimer gate, drop handlers (1751–1769), sample button. `loadSampleContract` (1723–1745) → `fetch('/SampleRentalAgreement.pdf')` → `File` → same `handleFile` path.
- [ ] **3.4** `screens/Loading.tsx` + `setLoadingLabel` via context.
- [ ] **3.5** `screens/PreQuiz.tsx` — `showPreQuiz`/`renderPreQuiz`/`selectPreAnswer`/`showPreQuizResults` (2086–2151) as component state.
- [ ] **3.6** `screens/Summary.tsx` — skeleton (2218–2229), `_applyStreamingSummary` (2231–2247), `loadSummary` (2332–2360) incl. the `alert()` on failure and final `parseJSON` reconciliation.
- [ ] **3.7** `screens/Quiz.tsx` — `startQuiz`/`renderQuiz`/`selectAnswer`/`showResults` (2363–2520).
- [ ] **3.8** `screens/Compare.tsx` — `showComparison` branching (2523–2552).
- [ ] **3.9** `npm run build` clean. Manual walk: sample contract → prequiz → summary (watch streaming) → quiz → compare, in EN then ES.
- [ ] **3.10** Commit: `feat(frontend): port upload/loading/prequiz/summary/quiz/compare screens`.

## Phase 4 — i18n sweep

- [ ] **4.1** Toggle EN/ES on every screen, confirm every `data-i18n` key from `index.html` has a corresponding `t()` call and renders identical text. Confirm the sample button label stays hardcoded "Try a Sample Contract" (no `data-i18n` in the original) — parity, not a bug to fix.
- [ ] **4.2** Confirm `document.title` updates on language switch (matches `applyTranslations` line 1669).
- [ ] **4.3** Commit if any fixes: `fix(frontend): i18n parity corrections`.

## Phase 5 — Sample contract asset

- [ ] **5.1** Confirm `frontend/public/SampleRentalAgreement.pdf` is byte-identical to the repo-root file (`git hash-object` match). No base64 literal anywhere in `frontend/src`.
- [ ] **5.2** Sample flow works from a clean `vite build` preview (not just dev).
- [ ] Folded into the Phase 3 commit if no separate changes.

## Phase 6 — Docs

- [ ] **6.1** `ARCHITECTURE.md` — rewrite for the split (backend routes, frontend structure, data flow through `/api/*`, where state lives). Remove the "pre-restructure" note.
- [ ] **6.2** `PRD.md` — check off both P0 roadmap items; move the sample-contract-base64 P1 item to done; add any new gaps found.
- [ ] **6.3** `README.md` — new Tech Stack (React/TS + Express/TS), local dev (`backend/` then `frontend/`, `.env` setup), deploy notes (Render backend, Vercel/Render static frontend).
- [ ] **6.4** `CLAUDE.md` — replace the "Pre-restructure state (current)" section with the new structure; keep the color palette and key-safety sections.
- [ ] **6.5** Note in `PRD.md` that `index.html` is retained pending the user's end-to-end visual confirmation, then removable.
- [ ] **6.6** Commit: `docs: update ARCHITECTURE/PRD/README/CLAUDE for the fullstack split`.

## Phase 7 — Handoff

- [ ] **7.1** Produce the screen-by-screen parity checklist (7 screens × EN/ES × key interactions) for the user to run against `index.html`.
- [ ] **7.2** Summarize: what changed, how to run both packages, the key-rotation reminder (PRD P1), and that `index.html` stays until they confirm.

---

## Self-Review

**Spec coverage:**
- Key server-side → Phase 1.3/1.5/1.7. ✓
- Frontend/backend split → Phases 1–3. ✓
- React+TS / Express+TS → Tech Stack + Phases 1–2. ✓
- Preserve 7-screen flow, streaming, pre/post quiz + compare, EN/ES, sample →
  Phases 3–5. ✓
- Sample contract as static asset → Phase 5. ✓
- `.env` / `.env.example` / `.gitignore` → Phase 1.1/1.3. ✓
- Local dev + deploy docs → Phase 6.3. ✓
- Parity guarantee (verbatim CSS/copy/markup/logic, `index.html` untouched) →
  Global Constraints + per-task "verbatim" callouts + line refs. ✓
- Streaming via `fetch` + `ReadableStream` not `EventSource` → `lib/api.ts`
  `streamSummary`. ✓
- Non-goals (auth, persistence, test suite, prompt changes) — not in plan. ✓

**Placeholder scan:** line references given for every verbatim port; no "TBD"/
"handle errors appropriately". Verification commands are concrete curl lines.

**Type consistency:** `Question` type (`{ question: string; options: string[];
correct: number }`) shared by `lib/api.ts`, `lib/quiz.ts`, `QuizQuestion.tsx`.
`SummaryData` type (`{ title, parties, obligations[], deadlines[], rights[],
risks: {title,description}[] }`) shared by `lib/api.ts`, `lib/parseJSON.ts`,
`Summary.tsx`, `Compare.tsx`, backend `parseQuizJSON` input. Screen-name union
`'home'|'upload'|'loading'|'prequiz'|'summary'|'quiz'|'compare'` in `AppContext`.
