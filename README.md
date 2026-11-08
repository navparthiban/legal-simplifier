# ClearSign — Legal Contract Simplifier

[![CI](https://github.com/navparthiban/legal-simplifier/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/navparthiban/legal-simplifier/actions/workflows/ci.yml)

ClearSign reads a legal contract (PDF or image) and turns it into a plain-language
breakdown: what each party has to do, key deadlines, rights, and risk flags worth
a second look. It also quizzes you before and after reading the summary so you can
see how much your understanding actually improved.

**Live:** https://clearsignlegalsimplifier.netlify.app

> ⚠️ **Not legal advice.** ClearSign is an educational tool that helps you understand
> a contract in plain English. It does not replace a lawyer.

> The backend runs on Render's free tier, which sleeps after 15 minutes idle.
> The app pings the backend as soon as the page opens so it starts waking up while
> you pick a file, but if you upload right away after a quiet spell it may still take
> up to ~30–60s the first time, then it's fast.

## Features

- **Upload a contract** — drag-and-drop or browse for a PDF or image. Scanned PDFs
  work too (the first 8 pages are read as images), and if a contract is too long to
  analyze in full (over ~50,000 characters / 8 scanned pages) you're told so.
- **Plain-language summary** — obligations, deadlines, rights, and risk flags,
  streamed in as the AI generates them. It starts generating while you answer the
  pre-reading quiz, so it's usually ready when you click.
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
  [pdfjs-dist](https://mozilla.github.io/pdf.js/). Type set in Newsreader +
  Libre Franklin (Google Fonts); design tokens in `frontend/src/styles/global.css`.
- **Backend** — Express + TypeScript. The only AI client; the keys never reach the
  browser. Each request tries a chain of [Gemini](https://ai.google.dev/) models
  first and falls back to [OpenRouter](https://openrouter.ai/) `:free` models if
  they all fail (see `ARCHITECTURE.md`).
- No database — nothing is persisted between sessions.

## Running It Locally

Two packages, started separately. You need Node 24+ and a Gemini API key
([get one](https://aistudio.google.com/apikey)). An OpenRouter key is optional but
recommended as the fallback.

### 1. Backend

```bash
cd backend
cp .env.example .env          # then edit .env: set GEMINI_API_KEY=... (and OPENROUTER_KEY=...)
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
`http://localhost:5173` and the flow works end to end. To point the *dev*
server's proxy at a backend running somewhere else, set `VITE_BACKEND_URL`
before `npm run dev`. (That's different from `VITE_API_BASE`, below, which is
baked into a production *build* — dev always uses the proxy.)

### Production build

```bash
cd backend  && npm run build && npm start      # serves the API
cd frontend && npm run build                   # static files in frontend/dist/
```

Serve `frontend/dist/` from any static host. Unlike local dev, a deployed
frontend and backend aren't on the same address, so the frontend needs to be
told where the backend is — see `VITE_API_BASE` below.

### Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request to `main` and
every push to `main`. For both `frontend/` and `backend/` it runs `npm ci`,
`npm run typecheck` and `npm run build` on Node 24 (the minimum in `package.json`
`engines`) on a pinned `ubuntu-24.04` runner. It needs no API keys and never calls Gemini
or OpenRouter. The two checks show up on a pull request as `build (frontend)` and
`build (backend)`.

Deploys are pinned to the same Node version: `NODE_VERSION = "24"` in `netlify.toml` and
in `render.yaml`'s `envVars`. If the Render service wasn't created from the Blueprint,
set `NODE_VERSION` = `24` in its Environment settings yourself.

`main` is meant to change only through a pull request whose checks pass; GitHub branch
protection on `main` enforces this.

## Deploying (Render + Netlify)

The frontend is static (Netlify, Vercel, GitHub Pages, ...). The backend is a
real Node server that has to stay running (Render, Railway, Fly.io, ...) —
it can't run as a Netlify static site or a short-lived serverless function,
because the AI calls are too slow/stream for that. This repo is set up for
**Render (backend) + Netlify (frontend)**; `render.yaml` and `netlify.toml`
at the repo root hold the config for each.

**1. Backend → Render**
- [render.com](https://render.com) → **New → Blueprint** → connect this repo.
  Render reads `render.yaml` and creates a "clearsign-backend" web service
  rooted at `backend/`.
- When prompted for environment variables, set:
  - `GEMINI_API_KEY` — your Gemini key (tried first)
  - `OPENROUTER_KEY` — your OpenRouter key (fallback)
  - `APP_URL` — fill in after step 2, with your Netlify URL
  - `CORS_ORIGIN` — same as `APP_URL`, restricts who can call the API
- Deploy, then copy the service's URL (`https://clearsign-backend-xxxx.onrender.com`).
- *(No blueprint support? Create a Web Service manually: root directory
  `backend`, build command `npm install && npm run build`, start command
  `npm start`, same env vars.)*
- Render's free tier spins down after 15 minutes idle — the first request
  after that takes ~30–60s to wake back up. Normal, not a bug.
- Gemini's free tier allows only about 20 requests per day **per model**. When one runs
  out, the backend notes it (`[ai] … hit its quota/rate limit — skipping it for …` in the
  log) and skips that model for a while, falling back to the next one. It still works,
  but a paid Gemini key is the real fix if you expect steady traffic.

**2. Frontend → Netlify**
- [netlify.com](https://netlify.com) → **Add new site → Import an existing
  project** → connect this repo. Netlify reads `netlify.toml` (base directory
  `frontend`, build command `npm run build`, publish directory `dist`).
- Site settings → **Environment variables** → add `VITE_API_BASE` = the Render
  URL from step 1 (no trailing slash).
- Deploy, then copy the site's URL (`https://your-site.netlify.app`).

**3. Close the loop**
- Back in Render, set `APP_URL` and `CORS_ORIGIN` to the Netlify URL from
  step 2, and redeploy the backend so the CORS restriction takes effect.
- Open the Netlify URL — that's the live app.

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
