# ClearSign — Full-Stack Restructure Design

Date: 2026-09-03

## Problem

ClearSign is currently a single static file (`index.html`, ~2,570 lines) that
calls OpenRouter directly from the browser using a hardcoded API key. This
means:

- The API key is exposed to anyone with view-source access to the deployed
  page, regardless of git repo visibility (`PRD.md` P0).
- There is no backend, so there's a hard ceiling on what the app can do.
- All markup/styles/logic for 7 screens live in one file, which is hard to
  navigate and hard to test (`PRD.md` P1).
- The sample contract is duplicated as a ~215,000-character base64 string
  literal inside the JS, in addition to the actual PDF file in the repo
  (`PRD.md` P1).

## Goals

1. Move the OpenRouter API key server-side, out of any client-shipped code.
2. Split the app into a conventional frontend/backend structure, matching what
   a college full-stack course / internship would expect to see.
3. Use React + TypeScript on the frontend and Express + TypeScript on the
   backend — chosen deliberately for internship resume value, even though it's
   a bigger lift than staying with vanilla JS (explicit tradeoff the user
   accepted).
4. Preserve all existing functionality and UX: 7-screen flow, streaming
   summary, pre/post quiz with comparison, EN/ES i18n, sample contract demo.
5. Fix the sample-contract duplication by serving the real PDF as a static
   asset instead of an embedded base64 blob.
6. Add `.env` / `.env.example` / `.gitignore` so secrets are never committed
   going forward.
7. Document local dev and deployment (Render for backend, Vercel or Render
   static site for frontend).

## Non-Goals

- User accounts / auth.
- Persisting uploaded contracts server-side (privacy — explicitly out of scope
  per `PRD.md`).
- Automated test suite (tracked separately as `PRD.md` P2 — this restructure
  should not block on it, though it makes future testing much easier).
- Migrating off `openrouter/free` or changing the AI prompts/behavior.

## Architecture

Two independent npm packages in one repo, no monorepo tooling:

```
legal-simplifier/
├── backend/
│   ├── src/
│   │   ├── server.ts               # Express app, CORS, mounts routes
│   │   ├── routes/api.ts           # POST /api/prequiz, /api/summary, /api/quiz
│   │   └── services/openrouter.ts  # MODEL const, fetch wrapper, defensive JSON parsing
│   ├── .env                        # OPENROUTER_KEY=... (gitignored)
│   ├── .env.example                # OPENROUTER_KEY=          (committed)
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx / App.tsx
│   │   ├── screens/                # Home, Upload, Loading, PreQuiz, Summary, Quiz, Compare
│   │   ├── components/             # shared: Nav, RiskFlag, QuizQuestion
│   │   ├── i18n/translations.ts    # ported TRANSLATIONS dict + t()
│   │   ├── state/AppContext.tsx    # replaces module-level vars
│   │   ├── lib/api.ts              # fetch wrappers calling the backend (not OpenRouter)
│   │   ├── lib/pdf.ts              # extractPdfText via pdfjs-dist
│   │   └── styles/global.css       # ported CSS variables + styles
│   ├── public/SampleRentalAgreement.pdf
│   ├── tsconfig.json
│   └── package.json
├── README.md / PRD.md / ARCHITECTURE.md / CLAUDE.md
└── .gitignore
```

## API Design

The frontend never calls OpenRouter directly — only the backend does.

| Route | Body | Returns |
|---|---|---|
| `POST /api/prequiz` | `{ content: string }` | `{ questions: [...] }` — quiz from raw contract text |
| `POST /api/summary` | `{ content: string }` | Server-Sent Events stream of summary chunks, same progressive-render UX as today |
| `POST /api/quiz` | `{ summaryData: {...} }` | `{ questions: [...] }` — quiz from the summary |

`services/openrouter.ts` centralizes the `MODEL` constant, the `Authorization`
header (reading `process.env.OPENROUTER_KEY`), and the existing defensive
`parseJSON`-style fallback logic (strip markdown fences → regex-match first
`{...}`/`[...]` block → tolerate trailing commas). The frontend receives
already-clean JSON from `/api/prequiz` and `/api/quiz`.

Images (vision input) are sent from the frontend as base64 data URLs in the
request body, same as today — the backend forwards them to OpenRouter using
the existing vision message format.

## Frontend State

- `currentScreen` (in `AppContext`) replaces `showScreen()` / `.screen.active`
  — screens render conditionally instead of toggling a DOM class.
- `AppContext` holds: `currentScreen`, `currentSummaryData`, `preQuizScore`,
  `postQuizScore`, `language` — replacing the old module-level variables
  (`currentSummaryData`, `quizAnswered`, `quizScore`, active language).
- `i18n/translations.ts` ports `TRANSLATIONS` as-is; a `useTranslation()` hook
  wraps `t(key)` against `AppContext`'s `language`.

## Streaming

The backend's `/api/summary` route makes a streaming request to OpenRouter
(same as today's `callOpenRouterStream`) and relays chunks to the frontend as
a chunked HTTP response. Since the request needs a POST body (`content` can be
up to 12,000 characters), the frontend uses `fetch()` and reads
`response.body` as a `ReadableStream` — not `EventSource`, which only supports
GET. Each chunk feeds the existing `_applyStreamingSummary`-style incremental
render logic, ported into the `Summary` screen component.

## Sample Contract

`SampleRentalAgreement.pdf` moves to `frontend/public/`. "Try Sample Contract"
does a `fetch('/SampleRentalAgreement.pdf')` and feeds the resulting blob
through the same upload path as a real file — no base64 literal anywhere in
source.

## Secrets

- `backend/.env` holds `OPENROUTER_KEY=...`, gitignored.
- `backend/.env.example` is committed with the variable name but no value.
- Root `.gitignore` covers `node_modules/`, `.env`, `dist/`, `build/`.
- The key currently committed in git history should be rotated on OpenRouter
  once the client-side key is fully removed (`PRD.md` P1 — tracked, not part
  of this restructure's code changes since it's an account action the user
  takes directly on OpenRouter).

## Migration Approach

Built and verified in phases, not a big-bang rewrite:

1. **Backend first** — scaffold Express + TypeScript, implement all three
   routes against the real OpenRouter API, verify each with a manual request
   (e.g. curl/Postman) before any frontend work starts.
2. **Frontend scaffold** — Vite + React + TypeScript, port global styles and
   the color palette, get `App.tsx` rendering a static Home screen calling
   nothing yet.
3. **Port screens one at a time** against the running backend, checking each
   one against the current live `index.html` behavior before moving to the
   next: Home → Upload → Loading → PreQuiz → Summary (streaming) → Quiz →
   Compare.
4. **Port i18n** and verify the EN/ES toggle across all screens.
5. **Docs pass** — update `ARCHITECTURE.md` to describe the new structure,
   check off the completed `PRD.md` roadmap items, update `README.md` run/deploy
   instructions, update `CLAUDE.md`'s "pre-restructure state" section.

## Deployment

- **Backend** → Render (Node web service), `OPENROUTER_KEY` set via Render's
  environment variable UI, not committed anywhere.
- **Frontend** → Vercel or Render static site, built with `vite build`,
  configured with the deployed backend's URL as its API base.
- Documented as a README section; not deployed automatically as part of this
  work unless requested.

## Testing

No automated test suite is being added as part of this restructure (tracked
separately, `PRD.md` P2). Verification is manual: each ported screen is
exercised in the browser against the real backend before moving to the next,
and the full 7-screen flow (including EN/ES toggle and the sample contract
path) is walked end-to-end once the migration is complete.
