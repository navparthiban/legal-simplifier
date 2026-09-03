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

**⚠️ Architecture is mid-migration.** The app currently runs as a single static
file (`index.html`) with the OpenRouter API key hardcoded client-side. A
frontend/backend restructure is in progress to move the API key server-side
(see `PRD.md` → Roadmap → P0). Check `ARCHITECTURE.md` for whichever state is
current before assuming the single-file description below still applies —
update that section (and this one) once the restructure lands.

### Pre-restructure state (current, as of 2026-09-03)

Single-file web app (`index.html`) — no build step. All HTML, CSS, and JS live
in one file. Full details in `ARCHITECTURE.md`; summary:

- No router — screens are `<section>`s toggled via a `.screen.active` CSS class.
- 7 screens: home, upload, loading, pre-quiz, summary, quiz, comparison.
- EN/ES i18n via a `TRANSLATIONS` dictionary and `data-i18n` attributes.
- AI calls go straight from the browser to OpenRouter using a hardcoded
  `API_KEY` constant — **do not add new features that assume this is safe.**
  Any new AI-call code should be written assuming it'll move behind a backend
  endpoint shortly.

### Data flow (current)

1. User uploads a PDF/image, or clicks "Try Sample Contract" (which decodes a
   bundled base64 PDF — see `PRD.md` P1 for why that's flagged as tech debt).
2. `handleFile(file)` dispatches to `extractPdfText()` (PDF.js) or
   `encodeImageBase64()`.
3. `callOpenRouterForPreQuiz()` generates a quiz from the raw contract text,
   answered before the user sees any summary.
4. `callOpenRouterStream()` streams the plain-language summary into the UI;
   `parseJSON()` strips markdown fences and falls back to regex extraction.
5. `populateSummary()` fills the summary screen DOM and stores the result in
   `currentSummaryData`.
6. "Take the Quiz" → `startQuiz()` → `callOpenRouterForQuiz()` using the stored
   summary → `renderQuiz()`.
7. `showComparison()` shows the pre-quiz vs. post-quiz score.

### External dependencies (CDN only)

- **PDF.js 3.11.174** — `pdf.min.js` + `pdf.worker.min.js` from cdnjs. Worker URL
  must be set via `pdfjsLib.GlobalWorkerOptions.workerSrc`.
- **OpenRouter API** — `https://openrouter.ai/api/v1/chat/completions`, model
  `openrouter/free`. Images use the vision `image_url` content block; PDFs use
  plain text messages.

### Key implementation details

- **PDF text cap:** Extracted text is capped at 12,000 characters to stay within
  free-tier token limits.
- **JSON parsing:** `parseJSON()` strips ` ```json ` fences first, then falls
  back to matching the first `{...}` or `[...]` block in the response.
- **XSS:** All API-returned strings must go through `escHtml()` before being set
  as `innerHTML`.
- **Quiz state:** `currentSummaryData`, `quizAnswered`, and `quizScore` are
  module-level variables reset at the start of each `startQuiz()` call.
- **Quiz answer format:** The API is asked to return
  `[{ "question": "...", "options": ["A","B","C","D"], "correct": 0 }]` —
  `correct` is a zero-based index.

### Secrets

- **Never hardcode API keys in client-shipped code.** The current `API_KEY`
  constant in `index.html` is known tech debt (`PRD.md` P0), not a pattern to
  copy. New backend code should read secrets from `.env` (gitignored) via
  `process.env`, never inline.

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
