# ARCHITECTURE.md

Living doc — kept in sync with the actual file layout as the project changes.
Last verified against the codebase: 2026-09-03.

> **History:** this app used to be a single `index.html` (HTML + CSS + JS, with
> the OpenRouter key hardcoded client-side). It was replaced by the
> `frontend/` + `backend/` split below after a screen-by-screen parity check.
> The CSS, the `TRANSLATIONS` dict, the markup, and the logic in `frontend/`
> were copied verbatim from that file — see `docs/superpowers/` for the spec,
> plan, and the parity guarantee that governed the port.

## File Layout

```
legal-simplifier/
├── backend/                       # Express + TypeScript — the only OpenRouter client
│   ├── src/
│   │   ├── server.ts              # Express app: cors, express.json(15mb), mounts /api, :8787
│   │   ├── routes/api.ts          # POST /api/prequiz, /api/summary (SSE passthrough), /api/quiz
│   │   └── services/openrouter.ts # MODEL, fetch wrappers, system prompts, response parsers
│   ├── .env                       # OPENROUTER_KEY=...  (gitignored)
│   ├── .env.example               # OPENROUTER_KEY=     (committed, blank)
│   ├── package.json / tsconfig.json
│
├── frontend/                      # Vite + React + TypeScript
│   ├── public/SampleRentalAgreement.pdf   # served at /SampleRentalAgreement.pdf
│   ├── index.html                # Vite entry (<div id="root">)
│   ├── src/
│   │   ├── main.tsx              # React root, imports global.css, wraps <App> in <AppProvider>
│   │   ├── App.tsx              # <Nav> + current screen + <Footer>
│   │   ├── styles/global.css    # the entire original <style> block, verbatim
│   │   ├── i18n/
│   │   │   ├── translations.ts  # TRANSLATIONS dict verbatim + translate()/tStr()/tArr()
│   │   │   └── useTranslation.ts# hook binding t()/tArr() to the active language
│   │   ├── state/AppContext.tsx # all app state + the flow functions (see below)
│   │   ├── lib/
│   │   │   ├── api.ts           # fetch wrappers → backend (prequiz / summary stream / quiz)
│   │   │   ├── pdf.ts           # extractPdfText (pdfjs-dist, 12k cap)  — verbatim
│   │   │   ├── pdfWorker.ts     # sets pdfjs workerSrc to the cdnjs 3.11.174 worker
│   │   │   ├── image.ts         # encodeImageBase64 — verbatim
│   │   │   ├── parseJSON.ts     # final summary JSON parse — verbatim
│   │   │   ├── summaryStream.ts # _sumPartialStr / _sumCompleteArr / _sumExtractPartial — verbatim
│   │   │   ├── quiz.ts          # validateQuestions, escHtml — verbatim
│   │   │   ├── scoreCopy.ts     # pre-quiz / quiz / comparison copy logic — verbatim
│   │   │   └── types.ts         # Question, SummaryData, StreamingPartial
│   │   ├── components/          # Nav, Footer, Screen, QuizQuestion, SummaryLists
│   │   └── screens/             # Home, Upload, Loading, PreQuiz, Summary, Quiz, Compare
│   ├── vite.config.ts           # dev proxy: /api → http://localhost:8787
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
| `Home` | Landing — hero, feature cards |
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
Upload (or "Try a Sample Contract" → fetch('/SampleRentalAgreement.pdf'))
        │
        ▼
AppContext.handleFile(file)
   ├─ file.type 'application/pdf' → lib/pdf.extractPdfText()   (12k cap)
   └─ file.type 'image/*'         → lib/image.encodeImageBase64()  (data URL)
        │  sets { fileName, content, isImage }
        ▼
POST /api/prequiz { content, isImage, language }
   backend: buildPreQuizMessages → chatCompletion → parsePreQuizJSON
        │  → { questions }  → validateQuestions → PreQuiz screen
        ▼  (user answers 5 questions on the raw contract)
AppContext.loadSummary()
        ▼
POST /api/summary { content, isImage, language }
   backend: streams OpenRouter's SSE response straight through
   frontend: lib/api.streamSummary reads response.body, parses `data:` /
             `[DONE]` exactly as the old callOpenRouterStream did; each chunk
             feeds lib/summaryStream._sumExtractPartial → Summary screen
             renders the skeleton / stream-cursor / partial fields
        │  on done: lib/parseJSON(accumulated) → summaryData
        ▼
AppContext.startQuiz()
        ▼
POST /api/quiz { summaryData, language }
   backend: buildQuizMessages → chatCompletion → parseQuizJSON
        │  → { questions } → validateQuestions → Quiz screen
        ▼
Compare screen: lib/scoreCopy.comparison(language, preQuizScore, quizScore)
```

The API key is read only in `backend/src/services/openrouter.ts`
(`process.env.OPENROUTER_KEY`) and never leaves the server.

## API

| Route | Body | Returns |
|---|---|---|
| `POST /api/prequiz` | `{ content: string, isImage: boolean, language: 'en'\|'es' }` | `{ questions: [...] }` |
| `POST /api/summary` | `{ content, isImage, language }` | `text/event-stream` — the OpenRouter SSE stream, relayed unchanged |
| `POST /api/quiz` | `{ summaryData: {...}, language }` | `{ questions: [...] }` |

Errors are returned as `{ error: <message> }` with the message string ported
from `index.html` (`err?.error?.message` from OpenRouter, else
`API error (<status>). Please try again.`, else the parser's
`The AI returned an unexpected response. Please try again.`).

Image contracts are sent as base64 data URLs in the `content` field with
`isImage: true`; the backend forwards them in OpenRouter's vision
`image_url` message format.

## Configuration

| Var | Where | Purpose |
|---|---|---|
| `OPENROUTER_KEY` | `backend/.env` | the only secret; never committed |
| `PORT` | `backend/.env` | backend listen port (Render sets its own) |
| `APP_URL` | `backend/.env` | `HTTP-Referer` sent to OpenRouter |
| `CORS_ORIGIN` | `backend/.env` | restricts the backend to one origin; unset = any |
| `VITE_API_BASE` | `frontend/.env` / build-time | prefixes every `/api/*` call in the **built** bundle — set this to the deployed backend's URL. Unset in local dev, where relative paths go through the Vite proxy instead |
| `VITE_BACKEND_URL` | shell env before `npm run dev` | only affects `vite.config.ts`'s **dev-server proxy target**, not the built bundle |

`render.yaml` / `netlify.toml` deploy `backend/` and `frontend/` respectively
— see README.md "Deploying".

## Key Functions (by role)

**i18n** — `TRANSLATIONS` (verbatim dict), `translate(lang, key)` /
`tStr` / `tArr`, `useTranslation()` hook, `AppContext.setLanguage`.
`document.title` is updated from `page-title` on every language change.

**Screen / flow control** (`AppContext`) — `showScreen`, `showError` /
`hideError`, `loadingLabel`, and the flows `handleFile`, `loadSampleContract`,
`loadSummary`, `startQuiz`.

**File input** — `lib/pdf.extractPdfText` (pdfjs-dist, 12,000-char cap),
`lib/image.encodeImageBase64`.

**AI calls** (`lib/api.ts` → backend) — `fetchPreQuiz`, `streamSummary`,
`fetchQuiz`. `MODEL = 'openrouter/free'` lives in
`backend/src/services/openrouter.ts`.

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
- `error` — the upload-screen error banner text.

## External Dependencies

- **pdfjs-dist 3.11.174** (frontend npm dep). Worker still loaded from
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`.
- **React 18 / Vite 5** (frontend), **Express 4** (backend), TypeScript on both.
- **OpenRouter API** — `https://openrouter.ai/api/v1/chat/completions`, model
  `openrouter/free`, called from the backend only.

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

Risk flags use warm red tones (`#fef6f2` background, `#c95f30` left border).
Correct quiz answers use `#edf7ed` / `#6aad6a`; wrong answers use
`#fef1ee` / `#d87a5a`. All defined verbatim in `frontend/src/styles/global.css`.
