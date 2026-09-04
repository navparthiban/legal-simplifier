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
TypeScript)** pair. The backend is the only OpenRouter client; the API key
lives in `backend/.env` (gitignored) and is never shipped to the browser.

> This app was ported from a single `index.html` (all HTML/CSS/JS in one file,
> OpenRouter key hardcoded client-side) with a strict zero-drift parity
> guarantee. That file has been removed; its git history plus
> `docs/superpowers/` (spec + plan) are the record of what the CSS, copy,
> markup, and logic were ported from.

### Current structure

```
backend/   Express + TS. src/server.ts, src/routes/api.ts, src/services/openrouter.ts
frontend/  Vite + React + TS. src/{screens,components,lib,i18n,state,styles}
```

Full details in `ARCHITECTURE.md`. Summary:

- **No router.** `AppContext` holds `screen`; `App.tsx` renders one screen
  component. `showScreen()` reproduces the original 180ms fade.
- **7 screens:** Home, Upload, Loading, PreQuiz, Summary, Quiz, Compare.
- **EN/ES i18n:** `frontend/src/i18n/translations.ts` holds the `TRANSLATIONS`
  dict copied verbatim from `index.html`; `useTranslation()` binds it to the
  active language.
- **All AI calls go frontend → backend → OpenRouter.** The frontend
  (`src/lib/api.ts`) never talks to OpenRouter directly. New AI features add a
  backend route in `src/routes/api.ts` + a helper in `src/services/openrouter.ts`.

### Data flow

1. User uploads a PDF/image, or clicks "Try a Sample Contract" (which does
   `fetch('/SampleRentalAgreement.pdf')` from `frontend/public/` — no base64
   literal any more).
2. `AppContext.handleFile(file)` dispatches to `lib/pdf.extractPdfText()`
   (pdfjs-dist) or `lib/image.encodeImageBase64()`.
3. `POST /api/prequiz` generates a quiz from the raw contract text, answered
   before the user sees any summary.
4. `POST /api/summary` streams the plain-language summary; the backend relays
   OpenRouter's SSE stream unchanged and `lib/api.streamSummary` parses it with
   the same `data:` / `[DONE]` logic as the old `callOpenRouterStream`.
   `lib/summaryStream._sumExtractPartial` drives the progressive render;
   `lib/parseJSON.parseJSON` does the final authoritative parse.
5. The Summary screen renders from `streamingPartial` while streaming, then from
   `summaryData` once parsed.
6. "Take the Quiz" → `AppContext.startQuiz()` → `POST /api/quiz` using the stored
   summary → `lib/quiz.validateQuestions` → Quiz screen.
7. Compare screen shows the pre-quiz vs. post-quiz score via
   `lib/scoreCopy.comparison()`.

### External dependencies

- **pdfjs-dist 3.11.174** — frontend npm dependency. The worker is still loaded
  from cdnjs (`.../pdf.js/3.11.174/pdf.worker.min.js`); set in `lib/pdfWorker.ts`.
- **OpenRouter API** — `https://openrouter.ai/api/v1/chat/completions`, model
  `openrouter/free`, called **only** from `backend/src/services/openrouter.ts`.
  Images use the vision `image_url` content block; PDFs use plain text messages.

### Key implementation details

- **Parity mandate.** This app was ported from the old single-file `index.html`
  with a strict "zero visual/content/functional drift" guarantee
  (`docs/superpowers/specs/2026-09-03-fullstack-restructure-design.md`). CSS
  (`frontend/src/styles/global.css`), the `TRANSLATIONS` dict, markup structure,
  and logic bodies were copied verbatim. Keep it that way — if you change
  behavior, make it intentional and documented. The original is recoverable
  from git history if you need to check something.
- **PDF text cap:** 12,000 characters (`lib/pdf.extractPdfText`).
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
  `streamingPartial`, `summaryData`, `quizQuestions`/`quizPicks`, `error`.
  Screen-local state resets on navigation because only the active screen mounts.

### Secrets

- **Never hardcode API keys in client-shipped code.** The key lives in
  `backend/.env` (gitignored), read via `process.env.OPENROUTER_KEY` in
  `backend/src/services/openrouter.ts` only. `backend/.env.example` is the
  committed template (blank value).
- The key currently in `backend/.env` was ported from the old client-side
  constant and is in git history — it must be rotated on OpenRouter (`PRD.md`
  P0). Deploy hosts get the key via their own env-var settings, never a commit.
- Root `.gitignore` covers `node_modules/`, `.env`, `dist/`, `build/`.

## Color Palette

```css
--bg:      #f5f0e8;   /* warm beige page background */
--surface: #faf7f2;   /* card / nav surface */
--navy:    #1c2b3a;
--blue:    #2d5f8a;
--text:    #2c3a47;
--muted:   #7a8694;
--border:  #e3ddd4;
```

Risk flags use warm red tones (`#fef6f2` background, `#c95f30` left border). Correct answers use `#edf7ed` / `#6aad6a`; wrong answers use `#fef1ee` / `#d87a5a`.

Defined verbatim in `frontend/src/styles/global.css` (copied from `index.html`).
