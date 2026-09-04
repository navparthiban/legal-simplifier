# ClearSign — Legal Contract Simplifier

ClearSign reads a legal contract (PDF or image) and turns it into a plain-language
breakdown: what each party has to do, key deadlines, rights, and risk flags worth
a second look. It also quizzes you before and after reading the summary so you can
see how much your understanding actually improved.

> ⚠️ **Not legal advice.** ClearSign is an educational tool that helps you understand
> a contract in plain English. It does not replace a lawyer.

## Features

- **Upload a contract** — drag-and-drop or browse for a PDF or image.
- **Plain-language summary** — obligations, deadlines, rights, and risk flags,
  streamed in as the AI generates them.
- **Pre-reading quiz** — 5 questions based on the raw legal text, before you see
  the summary, so you have a baseline.
- **Post-reading quiz** — 5 questions based on the summary, to check comprehension.
- **Before/after comparison** — see your score improve once you understand what
  you're reading.
- **Bilingual UI** — English / Spanish toggle.
- **Try a sample contract** — no upload needed, demo with a bundled sample rental
  agreement.

## Tech Stack

- **Frontend** — Vite + React + TypeScript. PDF text extraction with
  [pdfjs-dist](https://mozilla.github.io/pdf.js/).
- **Backend** — Express + TypeScript. The only [OpenRouter](https://openrouter.ai/)
  client; the API key never reaches the browser.
- No database — nothing is persisted between sessions.

## Running It Locally

Two packages, started separately. You need Node 20+ and an OpenRouter API key.

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit .env and set OPENROUTER_KEY=...
npm install
npm run dev                   # http://localhost:8787
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

The frontend dev server proxies `/api/*` to the backend on `:8787`, so open
`http://localhost:5173` and the flow works end to end. To point at a backend on
a different host, set `VITE_BACKEND_URL` before `npm run dev`.

### Production build

```bash
cd backend  && npm run build && npm start      # serves the API
cd frontend && npm run build                   # static files in frontend/dist/
```

Serve `frontend/dist/` from any static host and make sure `/api/*` reaches the
backend (reverse proxy, or set the API base at build time).

## Deployment

- **Backend** → a Node web service (e.g. Render). Set `OPENROUTER_KEY` (and
  optionally `APP_URL` for the OpenRouter `HTTP-Referer` header) via the host's
  environment-variable UI — never commit it.
- **Frontend** → a static site (e.g. Vercel or a Render static site), built with
  `vite build`. Route `/api/*` to the deployed backend URL.

## Project Docs

- [`PRD.md`](./PRD.md) — current state, known gaps, and the roadmap.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the code is laid out and how data
  flows through the app.
- [`CLAUDE.md`](./CLAUDE.md) — instructions for Claude Code when working in this repo.

> The app was previously a single `index.html` with the OpenRouter key baked
> into the page. That version was replaced by this `frontend/` + `backend/`
> split after a screen-by-screen parity check; its history is in
> `docs/superpowers/`.

## License

Personal / educational project. No license specified yet.
