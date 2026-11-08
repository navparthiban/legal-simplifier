# ARCHITECTURE.md

Living doc — kept in sync with the actual file layout as the project changes.
Last verified against the codebase: 2026-09-05 (Home + shell visual rework).

Deployed: frontend on Netlify, backend on Render (see "Configuration" below and
README.md "Deploying").

> **History:** this app used to be a single `index.html` (HTML + CSS + JS, with
> the OpenRouter key hardcoded client-side). It was replaced by the
> `frontend/` + `backend/` split below after a screen-by-screen parity check.
> The CSS, the `TRANSLATIONS` dict, the markup, and the logic in `frontend/`
> were copied verbatim from that file — see `docs/superpowers/` for the spec,
> plan, and the parity guarantee that governed the port.
>
> **Design rework:** the parity phase is over and the visual design has been
> reworked deliberately. Direction — *a trustworthy reader marking up your
> contract*: dull document paper resolving into a clear plain-language sheet,
> set as a centered editorial column in Newsreader + Libre Franklin, hairline
> rules, one signature-blue accent, warm red reserved for risk. **All seven
> screens + the shared shell are done.** The markup is largely unchanged; the
> restyle lives in `global.css` — design tokens in `:root`, then Home, then a
> shared inner-screen system (back link, headings, kicker, buttons) reused by
> Upload / Loading / PreQuiz / Summary / Quiz / Compare. The legacy token
> aliases (`--bg`, `--navy`, …) are still defined but now just a convenience.

## File Layout

```
legal-simplifier/
├── backend/                       # Express + TypeScript — the only AI client (Gemini → OpenRouter chain)
│   ├── src/
│   │   ├── server.ts              # Express app: cors, express.json(15mb), mounts /api, :8787
│   │   ├── routes/api.ts          # POST /api/prequiz, /api/summary (SSE passthrough), /api/quiz
│   │   └── services/
│   │       ├── llm.ts             # model fallback chain: chatCompletion / chatCompletionStream, keys, timeouts, logging
│   │       └── openrouter.ts      # system prompts, message builders, response parsers (name is historical)
│   ├── .env                       # GEMINI_API_KEY=..., OPENROUTER_KEY=...  (gitignored)
│   ├── .env.example               # both keys blank (committed)
│   ├── package.json / tsconfig.json
│
├── frontend/                      # Vite + React + TypeScript
│   ├── public/SampleRentalAgreement.pdf   # served at /SampleRentalAgreement.pdf
│   ├── index.html                # Vite entry (<div id="root">)
│   ├── src/
│   │   ├── main.tsx              # React root, imports global.css, wraps <App> in <AppProvider>
│   │   ├── App.tsx              # <Nav> + current screen + <Footer>
│   │   ├── styles/global.css    # design tokens + all screen styles (Home + shell reworked; rest ported)
│   │   ├── i18n/
│   │   │   ├── translations.ts  # TRANSLATIONS dict verbatim + translate()/tStr()/tArr()
│   │   │   └── useTranslation.ts# hook binding t()/tArr() to the active language
│   │   ├── state/AppContext.tsx # all app state + the flow functions (see below)
│   │   ├── lib/
│   │   │   ├── api.ts           # fetch wrappers → backend (prequiz / summary stream / quiz) + wakeBackend()
│   │   │   ├── pdf.ts           # readPdf: text (50k-char cap) or, for scans, page JPEGs (8-page cap)
│   │   │   ├── pdfWorker.ts     # sets pdfjs workerSrc to the cdnjs 3.11.174 worker
│   │   │   ├── errors.ts        # UserError(key): an error whose message is a translation key
│   │   │   ├── image.ts         # encodeImageBase64
│   │   │   ├── parseJSON.ts     # final summary JSON parse — verbatim
│   │   │   ├── summaryStream.ts # _sumPartialStr / _sumCompleteArr / _sumExtractPartial — verbatim
│   │   │   ├── quiz.ts          # validateQuestions, escHtml — verbatim
│   │   │   ├── scoreCopy.ts     # pre-quiz / quiz / comparison copy logic — verbatim
│   │   │   └── types.ts         # Question, SummaryData, StreamingPartial
│   │   ├── components/          # Nav, Footer, Screen, QuizQuestion, SummaryLists, TruncationNote, ErrorBanner
│   │   └── screens/             # Home, Upload, Loading, PreQuiz, Summary, Quiz, Compare
│   ├── vite.config.ts           # dev proxy: /api and /health → http://localhost:8787
│   └── package.json / tsconfig*.json
│
├── SampleRentalAgreement.pdf     # canonical sample (the copy in frontend/public is what ships)
├── render.yaml                    # Render Blueprint — deploys backend/
├── netlify.toml                   # Netlify build config — deploys frontend/
├── docs/superpowers/             # spec + plan for the single-file → frontend/backend port
│   ├── specs/2026-09-03-fullstack-restructure-design.md
│   └── plans/2026-09-03-fullstack-restructure.md
└── README.md / PRD.md / ARCHITECTURE.md / CLAUDE.md
```

## Screens

There is no router. `AppContext` holds `screen` (one of `home | upload |
loading | prequiz | summary | quiz | compare`) and `App.tsx` renders exactly
one screen component for it. `showScreen(name)` reproduces the original 180ms
fade: it clears `screen-visible` (fade out), waits `FADE` ms, swaps `screen`,
scrolls to top, then re-adds `screen-visible` (fade in). The CSS
(`.screen` / `.screen.active` / `.screen.active.screen-visible`) is unchanged
from `index.html`.

| Screen | Purpose |
|---|---|
| `Home` | Landing — centered column: hero statement, the "The contract says → In plain terms" annotation device, and the "What you get" ledger rows |
| `Upload` | Disclaimer-gated drag-and-drop / browse, "Try a Sample Contract", error banner |
| `Loading` | Spinner + label during extraction and the first API call |
| `PreQuiz` | 5 questions from the **raw contract text**, before the summary |
| `Summary` | Plain-language breakdown, streamed in progressively |
| `Quiz` | 5 questions from the **summary**, after reading it |
| `Compare` | Pre-quiz vs. post-quiz score |

Because only the active screen is mounted, screen-local UI state resets on
navigation the way the original's explicit reset code did. Data that must
survive a flow (contract text, pre-quiz picks/score, summary, quiz picks/score)
lives in `AppContext`.

## Data Flow

```
Page load (main.tsx) → lib/api.wakeBackend(): one fire-and-forget GET ${API_BASE}/health,
   so a sleeping Render free-tier backend starts waking while the user is on the homepage.
   Runs once per page load, ignores the response, never shows an error.
        │
        ▼
Upload (or "Try a Sample Contract" → fetch('/SampleRentalAgreement.pdf'))
        │
        ▼
AppContext.handleFile(file)
   ├─ file.type 'application/pdf' → lib/pdf.readPdf()
   │     · text PDF   → text, cut at a word boundary past 50,000 chars
   │     · scanned PDF (avg < 40 non-space chars/page) → first 8 pages rendered
   │       to JPEG data URLs in the browser (content is an array, isImage true)
   └─ file.type 'image/*'         → lib/image.encodeImageBase64()  (data URL)
        │  sets { fileName, content, isImage, truncation }
        │  (truncation → <TruncationNote/> on the PreQuiz + Summary screens, EN/ES)
        ▼
POST /api/prequiz { content, isImage, language }
   backend: buildPreQuizMessages → chatCompletion → parsePreQuizJSON
        │  → { questions }  → validateQuestions → PreQuiz screen
        │  PreQuiz screen appears; handleFile immediately calls runSummary()
        │  in the background (the summary is NOT shown yet)
        ▼
POST /api/summary { content, isImage, language }          ← runs while the user
   backend: streams the winning model's SSE response straight through   answers
   frontend: lib/api.streamSummary reads response.body, parses `data:` /  the
             `[DONE]` exactly as the old callOpenRouterStream did; each   pre-quiz
             chunk feeds lib/summaryStream._sumExtractPartial →
             `streamingPartial` state
        │  on done: lib/parseJSON(accumulated) → summaryData, then
        │  runQuiz() starts immediately in the background
        ▼
POST /api/quiz { summaryData, language }                  ← runs while the user
   backend: buildQuizMessages → chatCompletion → parseQuizJSON   reads the summary
        │  → { questions } → validateQuestions → `quizQuestions` state
        ▼
User clicks "See summary" → AppContext.loadSummary()
   · done                → Summary screen shows it at once
   · still streaming     → Summary screen shows what's there, keeps filling in
   · failed / lang changed → retries in the foreground (loading screen)
User clicks "Take the Quiz" → AppContext.startQuiz()
   · done → Quiz screen shows at once · loading → spinner until it lands
   · failed → retries in the foreground · Retry button → always fetches fresh
        ▼
Compare screen: lib/scoreCopy.comparison(language, preQuizScore, quizScore)
```

The API keys are read only in `backend/src/services/llm.ts`
(`process.env.GEMINI_API_KEY` / `OPENROUTER_KEY`) and never leave the server.

## Model Fallback Chain (`backend/src/services/llm.ts`)

Every AI call walks a list of models in order and moves to the next one if the
current model errors, times out, or returns nothing. Gemini goes first (Google's
OpenAI-compatible endpoint, `GEMINI_API_KEY`); OpenRouter `:free` models are the
last resort (`OPENROUTER_KEY`). `openrouter/free` is never used. Because both
providers speak the OpenAI chat format, the prompts, message shapes, SSE stream
format and JSON parsers are identical for all of them.

| Chain | Timeout / model | Used by | Gemini order |
|---|---|---|---|
| `fast` | 15 s | `/api/prequiz` (user is waiting) | 3.5-flash-lite → 3.5-flash → 3.7-flash → 3.8-flash |
| `quality` | 25 s | `/api/summary`, `/api/quiz` (run in the background) | 3.5-flash → 3.7-flash → 3.5-flash-lite → 3.8-flash |

Both end with `nvidia/nemotron-3.5-super-vl:free` (reads images) and
`dots-studio/dots-3-note-preview:free` (treated as text-only).

- **Images:** models flagged `vision: false` are skipped for image uploads.
- **Missing key:** a provider with no key is skipped (logged); if nothing is
  usable the request fails with a message pointing at `backend/.env`.
- **Streaming (`/api/summary`):** the timeout is *time to first text chunk*. Once
  text arrives the model is committed to — if it dies mid-stream the response
  just ends (the frontend then reports a failed summary) rather than mixing
  models. SSE headers are only sent after a model commits, so a total failure is
  still a normal JSON error.
- **Thinking level:** the `fast` chain asks Gemini for the lowest `reasoning_effort`
  each model accepts: `"minimal"` for 3.5-flash-lite and 3.5-flash, `"low"` for
  3.7-flash and 3.8-flash (they reject `minimal` with a 400, so they start at `low`
  rather than wasting a call). Each model's `efforts` list is the order to try; if a
  400 mentions thinking/reasoning, the next value is tried, finally omitting the
  field. The `quality` chain sends nothing (model default).
- **Logging:** each failure and the winner are printed in the backend terminal,
  e.g. `[ai] prequiz answered by gemini-3.5-flash-lite (reasoning_effort=minimal) (1.2s)`.

## API

| Route | Body | Returns |
|---|---|---|
| `POST /api/prequiz` | `{ content: string \| string[], isImage: boolean, language: 'en'\|'es' }` | `{ questions: [...] }` |
| `POST /api/summary` | `{ content, isImage, language }` | `text/event-stream` — the winning model's SSE stream, relayed unchanged |
| `POST /api/quiz` | `{ summaryData: {...}, language }` | `{ questions: [...] }` |
| `GET /health` | — | `{ ok: true }` — no AI call; pinged once on page load by `wakeBackend()` and used as Render's health check |

Errors are returned as `{ error: <message> }` with the message string ported
from `index.html` (`err?.error?.message` from the provider, else
`API error (<status>). Please try again.`, else the parser's
`The AI returned an unexpected response. Please try again.`).

Image contracts are sent as base64 data URLs in the `content` field with
`isImage: true`; the backend forwards them in the vision `image_url` message format
(Gemini's OpenAI-compatible endpoint takes the same shape). `content` is a single
string for text or a one-image upload, or an **array of strings** — one data URL
per page — for a scanned PDF; the backend emits one `image_url` block per page and
the prompt wording is unchanged. Text-only models are skipped for image requests.

## Configuration

| Var | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `backend/.env` / Render | tried first; if unset, Gemini models are skipped |
| `OPENROUTER_KEY` | `backend/.env` / Render | fallback after every Gemini model fails; never committed |
| `PORT` | `backend/.env` | backend listen port (Render sets its own) |
| `APP_URL` | `backend/.env` | `HTTP-Referer` sent to OpenRouter |
| `CORS_ORIGIN` | `backend/.env` | restricts the backend to one origin; unset = any |
| `VITE_API_BASE` | `frontend/.env` / build-time | prefixes every `/api/*` call **and the `/health` wake-up ping** in the **built** bundle — set this to the deployed backend's URL. Unset in local dev, where relative paths go through the Vite proxy instead |
| `VITE_BACKEND_URL` | shell env before `npm run dev` | only affects `vite.config.ts`'s **dev-server proxy target**, not the built bundle |

`render.yaml` / `netlify.toml` deploy `backend/` and `frontend/` respectively
— see README.md "Deploying".

## Key Functions (by role)

**i18n** — `TRANSLATIONS` (verbatim dict), `translate(lang, key)` /
`tStr` / `tArr`, `useTranslation()` hook, `AppContext.setLanguage`.
`document.title` is updated from `page-title` on every language change.

**Screen / flow control** (`AppContext`) — `showScreen`, `showError` /
`hideError`, `loadingLabel`, and the flows `handleFile`, `loadSampleContract`,
`loadSummary`, `startQuiz`, plus the background runners `runSummary` (streams the
summary while the user answers the pre-quiz) and `runQuiz` (starts when the summary
finishes). Stale results are dropped via a generation counter (`genRef`) and
`AbortController`s, so a new upload or language change can't show an old result.

**Errors** — no `window.alert`. Every user-facing failure is shown in-page by
`<ErrorBanner/>` (the `.error-banner` style) on the screen where the retry control lives:
Upload (bad/unreadable file, sample failed, pre-quiz failed, server unreachable),
PreQuiz above "See summary" (summary failed), Summary above "Take the quiz" (quiz
failed). `lib/pdf.ts` / `lib/image.ts` throw `UserError(key)`; `AppContext.errorKeyFor`
maps `UserError` → its key, a fetch `TypeError` → `err-network`, anything else → the
flow's fallback key (`err-generic`, `err-prequiz`, `err-summary`, `err-quiz`). The raw
server message is only `console.error`-ed (it's English, so it isn't shown in the UI).
The `err-*` keys live in `TRANSLATIONS` in both languages. `showScreen` also cancels a
pending swap when asked for the screen it's already on, so a request that fails
before its fade finishes can't strand the user on the loading screen.
`document.documentElement.lang` follows the active language.

**File input** — `lib/pdf.readPdf` (pdfjs-dist): `MAX_TEXT_CHARS = 50_000`,
scan detection `SCAN_AVG_CHARS_PER_PAGE = 40` (judged by the per-page average so a
"Scanned with …" footer or page numbers don't hide a scan), `MAX_SCAN_PAGES = 8`,
pages rendered at ≤1600 px, JPEG quality 0.7, ≤8 MB total. `lib/image.encodeImageBase64`.

**AI calls** (`lib/api.ts` → backend) — `fetchPreQuiz`, `streamSummary`,
`fetchQuiz` (the last two take an optional `AbortSignal`). The model chain lives in
`backend/src/services/llm.ts`.

**Parsing / rendering** — `lib/parseJSON.parseJSON`,
`lib/summaryStream._sumExtractPartial`, `lib/quiz.validateQuestions`,
`lib/quiz.escHtml` (kept for parity; React escapes text nodes on the render
path so it isn't needed there), `lib/scoreCopy` for the score labels/messages
and the comparison delta branching.

## Module-Level State (all in `AppContext`)

- `contract` — `{ fileName, content, isImage }`, reused for the summary + quiz calls.
- `preQuizQuestions` / `preQuizPicks` — the pre-quiz and the answers picked so far;
  `preQuizScore` / `preQuizAnswered` are derived.
- `streamingPartial` — the in-progress summary while it streams; `null` once the
  final `summaryData` is parsed.
- `summaryData` — the parsed summary, reused to generate the post-reading quiz.
- `quizQuestions` / `quizPicks` — same shape as the pre-quiz; `quizScore` derived.
- `error` — a **translation key** (e.g. `err-summary`), not a sentence. `<ErrorBanner/>`
  renders `t(error)` so the message follows the language toggle. Cleared whenever the
  user navigates to a different screen and at the start of every retry.
- Background-generation refs (not React state; nothing renders from them):
  `summaryStatus` / `quizStatus` (`idle|running|done|error`), `summaryHasText`,
  `summaryLang` / `quizLang`, `genRef`, the two `AbortController`s, and the
  `summaryHooks` / `quizHooks` callbacks a foreground click installs.

## External Dependencies

- **pdfjs-dist 3.11.174** (frontend npm dep). Worker still loaded from
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`.
- **Google Fonts** — Newsreader + Libre Franklin, `<link>`ed in
  `frontend/index.html` (preconnect + one stylesheet).
- **React 18 / Vite 5** (frontend), **Express 4** (backend), TypeScript on both.
- **Gemini API** (OpenAI-compatible endpoint) — `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
  called from the backend only; first in every chain.
- **OpenRouter API** — `https://openrouter.ai/api/v1/chat/completions`, `:free` models
  only, called from the backend only; last-resort fallback.

## Color Palette

Design tokens (`:root` in `frontend/src/styles/global.css`):

```css
--paper:      #edece5;   /* dull document stock — page background */
--clear:      #ffffff;   /* the "explained" surface — a fresh sheet */
--ink:        #1b1a17;   /* warm near-black — headings & body */
--ink-soft:   #5c5a52;   /* secondary text */
--rule:       #d7d5cb;   /* hairlines, ruled-pad lines */
--signature:  #28407a;   /* the one accent — pen-blue */
--flag:       #c13b24;   /* risk only */
```

The legacy names the not-yet-reworked screens still use are aliased onto these:
`--bg → --paper`, `--surface → --clear`, `--navy/--text → --ink`,
`--blue → --signature`, `--muted → --ink-soft`, `--border → --rule`.

Correct quiz answers use `#edf7ed` / `#6aad6a`; wrong answers use
`#fef1ee` / `#d87a5a` (unchanged, in the ported screen styles).

## Typography

Two web fonts, loaded from Google Fonts in `frontend/index.html`:

- **Newsreader** — display headings and the "voice" of quoted legalese (italic).
- **Libre Franklin** — body, UI, labels (the plain-language voice).

Exposed as `--font-display` / `--font-sans`.
