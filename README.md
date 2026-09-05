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
  - `OPENROUTER_KEY` — your key
  - `APP_URL` — fill in after step 2, with your Netlify URL
  - `CORS_ORIGIN` — same as `APP_URL`, restricts who can call the API
- Deploy, then copy the service's URL (`https://clearsign-backend-xxxx.onrender.com`).
- *(No blueprint support? Create a Web Service manually: root directory
  `backend`, build command `npm install && npm run build`, start command
  `npm start`, same env vars.)*
- Render's free tier spins down after 15 minutes idle — the first request
  after that takes ~30–60s to wake back up. Normal, not a bug.

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
