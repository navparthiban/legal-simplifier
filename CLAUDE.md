# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Docs

This project keeps living docs that must stay in sync with the code:

- **`ARCHITECTURE.md`** — file layout, screen flow, data flow, key functions.
  **Update this whenever you change the file structure or add/remove/rename a
  screen or major function.** Don't let it drift the way it previously did.
- **`PRD.md`** — current state, known gaps/risks, and the prioritized roadmap.
  Update the roadmap checkboxes as items are completed, and add new gaps as
  they're discovered.
- **`README.md`** — user/portfolio-facing overview. Update if features, setup
  steps, or the tech stack change.

## Project Overview

ClearSign reads a legal contract (PDF or image) and produces a plain-language
summary plus before/after comprehension quizzes.

The app is a **`frontend/` (Vite + React + TypeScript) + `backend/` (Express +
TypeScript)** pair. The backend is the only AI client; the API keys
(`GEMINI_API_KEY`, `OPENROUTER_KEY`) live in `backend/.env` (gitignored) and are
never shipped to the browser.

**CI:** `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck` and
`npm run build` for `frontend/` and `backend/` (Node 24, `ubuntu-24.04`) on every PR to
`main` and push to `main`. The project requires Node 24 (`engines` `>=24`), and deploys are
pinned to it (`NODE_VERSION = "24"` in `netlify.toml` and `render.yaml`). It uses no
secrets and makes no AI calls. `main` changes only through a pull
request whose `build (frontend)` and `build (backend)` checks pass (branch protection).

> This app was ported from a single `index.html` (all HTML/CSS/JS in one file,
> OpenRouter key hardcoded client-side) with a strict zero-drift parity
> guarantee. That file has been removed; its git history plus
> `docs/superpowers/` (spec + plan) are the record of what the CSS, copy,
> markup, and logic were ported from.

### Current structure

```
backend/   Express + TS. src/server.ts, src/routes/api.ts, src/services/{llm,openrouter}.ts
frontend/  Vite + React + TS. src/{screens,components,lib,i18n,state,styles}
```

Full details in `ARCHITECTURE.md`. Summary:

- **No router.** `AppContext` holds `screen`; `App.tsx` renders one screen
  component. `showScreen()` reproduces the original 180ms fade.
- **7 screens:** Home, Upload, Loading, PreQuiz, Summary, Quiz, Compare.
- **EN/ES i18n:** `frontend/src/i18n/translations.ts` holds the `TRANSLATIONS`
  dict copied verbatim from `index.html`; `useTranslation()` binds it to the
  active language.
- **All AI calls go frontend → backend → Gemini/OpenRouter.** The frontend
  (`src/lib/api.ts`) never talks to a model provider directly. New AI features add a
  backend route in `src/routes/api.ts` + a helper in `src/services/` (prompts/parsers in `openrouter.ts`, model calls via `llm.ts`).

### Data flow

0. On page load `main.tsx` calls `lib/api.wakeBackend()` — one silent, fire-and-forget
   `GET ${API_BASE}/health` so Render's sleeping free-tier backend starts waking.
1. User uploads a PDF/image, or clicks "Try a Sample Contract" (which does
   `fetch('/SampleRentalAgreement.pdf')` from `frontend/public/` — no base64
   literal any more).
2. `AppContext.handleFile(file)` dispatches to `lib/pdf.readPdf()` (pdfjs-dist; returns
   text, or — for a scanned PDF — up to 8 page JPEGs) or `lib/image.encodeImageBase64()`.
   If the contract was cut off, `contract.truncation` drives `<TruncationNote/>`.
3. `POST /api/prequiz` generates a quiz from the raw contract text, answered
   before the user sees any summary. As soon as the pre-quiz appears,
   `AppContext.runSummary` starts the summary in the background (hidden until the
   user clicks).
4. `POST /api/summary` streams the plain-language summary; the backend relays
   winning model's SSE stream unchanged and `lib/api.streamSummary` parses it with
   the same `data:` / `[DONE]` logic as the old `callOpenRouterStream`.
   `lib/summaryStream._sumExtractPartial` drives the progressive render;
   `lib/parseJSON.parseJSON` does the final authoritative parse.
5. The Summary screen renders from `streamingPartial` while streaming, then from
   `summaryData` once parsed. "See summary" shows it instantly if done, shows the
   partial text and keeps streaming if in progress, or retries if it failed.
6. When the summary finishes, `runQuiz` immediately calls `POST /api/quiz`
   (→ `lib/quiz.validateQuestions`). "Take the Quiz" → `startQuiz()` shows it
   instantly if ready, waits if still loading, or retries if it failed.
7. Compare screen shows the pre-quiz vs. post-quiz score via
   `lib/scoreCopy.comparison()`.

### External dependencies

- **pdfjs-dist 3.11.174** — frontend npm dependency. The worker is still loaded
  from cdnjs (`.../pdf.js/3.11.174/pdf.worker.min.js`); set in `lib/pdfWorker.ts`.
- **Gemini API** (OpenAI-compatible endpoint) and **OpenRouter** (`:free` models) —
  called **only** from `backend/src/services/llm.ts`, which walks a model fallback
  chain (Gemini first, OpenRouter last; `openrouter/free` is never used). Two orders:
  *fast* (15 s/model, pre-quiz) and *quality* (25 s/model, summary + quiz; Gemini order
  3.5-flash → 3.5-flash-lite → 3.7-flash → 3.8-flash); the summary timeout is
  time-to-first-chunk. A model that hits a quota/rate-limit error (429, not a 503) is
  skipped for a cooldown (provider's retry time, clamped 15 s–6 h; else 1 h for "per day",
  else 60 s), kept in memory in `llm.ts`. Models that can't read images are skipped
  for image uploads. The winning model is logged per request. Prompts and parsers
  stay in `services/openrouter.ts`. Images use the vision `image_url` content block;
  PDFs use plain text messages, except scanned PDFs, which are sent as an array of page
  images (`content: string[]`, one `image_url` block per page).

### Key implementation details

- **Parity mandate (now lifted for visual design).** This app was ported from
  the old single-file `index.html` with a strict "zero visual/content/functional
  drift" guarantee
  (`docs/superpowers/specs/2026-09-03-fullstack-restructure-design.md`). That
  parity phase is **complete**. The **visual design has been reworked
  deliberately** — direction: *a trustworthy reader marking up your contract*,
  a centered editorial column in Newsreader + Libre Franklin, hairline rules,
  one signature-blue accent, warm red for risk only. All seven screens + the
  shared shell are done (see `ARCHITECTURE.md`). Still keep **logic and
  data-flow** behavior stable unless a change is intentional and documented;
  the `TRANSLATIONS` dict is now editable but keep EN and ES in sync. The
  original is recoverable from git history.
- **PDF limits (`lib/pdf.ts`):** text is capped at 50,000 characters (cut at a word
  boundary); a PDF averaging < 40 non-space characters per page is treated as scanned
  and its first 8 pages are rendered to JPEG (≤1600 px, quality 0.7, ≤8 MB total). Both
  set `contract.truncation` when they cut something off.
- **JSON parsing:** `lib/parseJSON.parseJSON` (summary) and
  `services/openrouter.ts` `parsePreQuizJSON` / `parseQuizJSON` (quizzes) strip
  ` ```json ` fences, isolate the first `{...}` / `[...]` block, and tolerate
  trailing commas — each ported from its original inline cleaner.
- **XSS:** The original injected AI strings via `innerHTML` behind `escHtml()`.
  The React port renders them as JSX text children, which React escapes —
  equivalent. `escHtml` is kept in `lib/quiz.ts` for reference. The only
  `dangerouslySetInnerHTML` is `prequiz-intro` (a static translation string).
- **Quiz answer format:** `[{ "question": "...", "options": ["A","B","C","D"],
  "correct": 0 }]` — `correct` is a zero-based index. `validateQuestions` pads /
  trims to exactly 4 options.
- **State:** `AppContext` holds `contract`, `preQuizQuestions`/`preQuizPicks`,
  `streamingPartial`, `summaryData`, `quizQuestions`/`quizPicks`, `error` (a translation
  *key*, shown by `<ErrorBanner/>`). Screen-local state resets on navigation because only
  the active screen mounts.
- **Errors & copy rules:** never use `window.alert`; show failures through
  `<ErrorBanner/>` with an `err-*` key (throw `UserError(key)` from `lib/`). No hardcoded
  English in the UI — every visible string goes through `TRANSLATIONS` in both EN and ES.

### Secrets

- **Never hardcode API keys in client-shipped code.** The keys (`GEMINI_API_KEY`,
  `OPENROUTER_KEY`) live in `backend/.env` (gitignored), read via `process.env` in
  `backend/src/services/llm.ts` only. `backend/.env.example` is the committed
  template (blank values). Deploy hosts get the keys via their own env-var
  settings (see `render.yaml`), never a commit.
- Root `.gitignore` covers `node_modules/`, `.env`, `dist/`, `build/`.

## Color Palette

Design tokens in `frontend/src/styles/global.css` `:root` (see `ARCHITECTURE.md`
→ Color Palette / Typography for the full list and rationale):

```css
--paper:     #edece5;   /* page background — dull document stock */
--clear:     #ffffff;   /* the "explained" surface */
--ink:       #1b1a17;   /* headings & body */
--ink-soft:  #5c5a52;   /* secondary text */
--rule:      #d7d5cb;   /* hairlines */
--signature: #28407a;   /* the one accent — pen-blue */
--flag:      #c13b24;   /* risk only */
```

Legacy names (`--bg`, `--surface`, `--navy`, `--blue`, `--text`, `--muted`,
`--border`) are aliased onto these for the screens not yet reworked. Correct
quiz answers use `#edf7ed` / `#6aad6a`; wrong answers `#fef1ee` / `#d87a5a`.

Fonts: **Newsreader** (display) + **Libre Franklin** (body), via Google Fonts
in `frontend/index.html`, exposed as `--font-display` / `--font-sans`.
