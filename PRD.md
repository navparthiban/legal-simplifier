# PRD — ClearSign

This is a living roadmap doc: current state, known gaps, and what's next. Update it
whenever scope changes — don't let it drift out of sync with reality the way
`CLAUDE.md` had.

## Current State

ClearSign is a **`frontend/` (Vite + React + TypeScript) + `backend/`
(Express + TypeScript)** app. The backend is the only AI client (Gemini first,
OpenRouter `:free` models as fallback) and reads the API keys from environment
variables (`backend/.env` locally). It was
ported screen-by-screen from the original single-file `index.html` (now removed)
with a zero-drift parity guarantee — see `docs/superpowers/`.

No persistence, no accounts — same as before.

**Deployed:**
- Frontend → Netlify (static build of `frontend/`), config in `netlify.toml`.
- Backend → Render (Node web service running `backend/`), config in
  `render.yaml`. Free tier, so it cold-starts (~30–60s) after 15 min idle.
- The two are wired by `VITE_API_BASE` (frontend build → backend URL) and
  `CORS_ORIGIN` (backend → only accepts the Netlify origin).

**Working today:**
- Upload flow (drag-and-drop or browse) for PDF and image contracts.
- PDF text extraction via PDF.js, up to 50,000 characters (≈15–20 pages); longer contracts
  show a short EN/ES note that only the first part was analyzed.
- Scanned PDFs (no real text) are rendered to page images in the browser (first 8 pages)
  and sent down the image path; images sent to the AI as vision input.
- AI-generated plain-language summary (obligations / deadlines / rights / risk
  flags), streamed into the UI as it's generated.
- Model fallback chain (fast order for the pre-quiz, quality order for the rest),
  with the winning model logged in the backend terminal. Models that hit a quota limit
  are skipped for a cooldown.
- Background generation: the summary starts while the user answers the pre-quiz
  and the post-reading quiz starts as soon as the summary finishes.
- Pre-reading and post-reading 5-question quizzes, with a before/after score
  comparison screen.
- EN/ES language toggle with a full UI translation dictionary.
- "Try Sample Contract" demo mode using a bundled sample rental agreement.
- Reasonable error handling on API calls (try/catch with user-facing messages).
- Backend wake-up: the frontend pings `/health` once on page load (silently, never
  showing an error) so Render's sleeping free-tier server starts waking while the user
  is still on the homepage. Remaining gap: a user who uploads within seconds of landing
  can still wait for the rest of the 30–60s wake-up.
- XSS protection on AI-returned text via `escHtml()` before it hits `innerHTML`.
- Abuse protection: the `/api` routes are rate-limited per IP (30 requests per 15 min by
  default; past it the user sees a translated "wait a few minutes" message and no AI call
  is made), and the backend rejects input the real frontend could never send (text over
  60,000 chars, more than 8 image pages, non-image data, junk summary fields).

## Known Gaps / Risks

Roughly ordered by severity.

- **P1 — Model names can rot.** The chain lists exact model IDs. On 2026-11-07 every
  Gemini ID in the chain was accepted. `nvidia/nemotron-3-super-120b-a12b:free`
  returned 404 ("unavailable for free") and has been removed from the chain. Gemini
  3.7/3.8 flash sometimes return 503 ("high demand"), which the chain absorbs by moving
  on. If a model ID is retired, requests will just log a failure and fall through, so
  watch the `[ai] ... failed` lines in the backend log.
- **P1 — Gemini free-tier daily quota (~20 requests/day per model).** Handled, not
  solved: a model that returns a quota/rate-limit error is skipped for a cooldown
  (the provider's retry time, clamped 15 s–6 h; else 1 h for "per day", else 60 s) so
  requests stop wasting a call on it, and the chain falls through to the next model. The
  cooldown is in memory, so it resets on restart (one cheap failed call re-learns it).
  The limit itself still exists; a paid Gemini key is the real fix.
- **P2 — gemini-3.5-flash-lite had one slow call.** It is first in the FAST chain (15s
  limit). On 2026-11-07 one early call took ~9.9s, but 8 later calls (including a
  quiz-sized prompt, 6 in a row) took 1.2–3.1s, so it looks like a one-off cold start.
  Not a problem today; if pre-quizzes ever feel slow, look for lite timeouts in the
  backend log and consider moving gemini-3.5-flash first.
- **P1 — Mid-stream failure ends the summary.** The summary stream commits to the first
  model that sends text; if it dies partway, the user sees a failed summary and a
  retry, not a silent switch to another model.
- **P2 — No retry/backoff within one model.** The chain moves on instead of retrying,
  and malformed JSON from a model that *did* answer is not retried on the next model.
- **P2 — No automated tests.** No unit tests, no end-to-end tests. CI now catches type
  errors and build breaks on every PR, but behavior regressions are still caught by hand.
- **P2 — Confirm the Render backend really runs Node 24.** `render.yaml` now sets
  `NODE_VERSION=24`, but Render only applies it if the service is managed by the Blueprint;
  otherwise it uses the newest Node allowed by `engines` (`>=24`, probably 26 already).
  Check Blueprints / the service's Environment tab and the first lines of the next deploy log.
- **P2 — Rate limit is per-IP and in memory.** The counter resets when the server
  restarts or sleeps, and visitors behind one shared IP (an office, a school) share one
  limit. It only works per visitor if Express sees the real IP: `render.yaml` sets
  `TRUST_PROXY=1`, but whether Render needs `1` or more hops is not confirmed yet. After the
  next deploy, check that the `[rate-limit] blocked <ip>` log line shows a visitor's real
  public IP, not a Render/Cloudflare address.
- **P2 — Node 24 reaches end-of-life in April 2028.** Move `engines`, CI, `netlify.toml` and
  `render.yaml` to the next LTS (Node 26) well before then.
- **P2 — CI could be pinned harder.** Actions are on major tags (`@v7`), not commit SHAs,
  and the runner is `ubuntu-24.04` (Ubuntu 26.04 is available; move on purpose, not by drift).
- **P2 — Long contracts and scans are only partly read.** Text past 50,000 characters and
  scanned pages past 8 are not analyzed (the user is told). Scanned requests are larger and
  use more AI quota than text; there is no OCR, so a scan is only as readable as the model
  finds the page image. Image requests were only exercised against Gemini; the OpenRouter
  vision fallback has not been tried with multi-page input.
- **P2 — Error detail is not shown.** User-facing errors are translated headlines only;
  the server's specific (English) reason goes to the browser console. If support ever
  needs it, add a small translated "details" disclosure.
- **P2 — No persistence.** Nothing is saved between sessions — re-uploading a
  contract re-runs the full AI pipeline and costs tokens again.
- **P2 — Accessibility unaudited.** No explicit ARIA/keyboard-nav pass has been
  done on the quiz or upload flows.

## Roadmap

### P0 — Done
- [x] Split `index.html` into a proper frontend/backend structure
      (`frontend/` Vite + React + TS, `backend/` Express + TS).
- [x] Move the OpenRouter API key server-side (env var, read only in
      `backend/src/services/openrouter.ts`). `.env` gitignored; `.env.example`
      committed blank.
- [x] Verify the new app matches `index.html` screen-by-screen (EN + ES, sample
      path, full flow); `index.html` removed.
- [x] Rotate the OpenRouter key that was previously committed in `index.html`.
      The old key is disabled — the copy still in git history is now a dead
      string. The new key exists only in `backend/.env` and the Render dashboard.
- [x] Deploy: frontend on Netlify, backend on Render.

### P1 — Next
- [x] Stop embedding the sample contract as a base64 JS literal — it is now
      served from `frontend/public/SampleRentalAgreement.pdf` and fetched.
- [x] Replace `openrouter/free` with a Gemini → OpenRouter fallback chain (fast and
      quality orders, per-model timeouts, image-aware skipping, logging).
- [x] Generate the summary and the post-reading quiz in the background.
- [x] Drop `nvidia/nemotron-3-super-120b-a12b:free` (404 as of 2026-11-07).
- [x] Start gemini-3.7-flash / 3.8-flash at `reasoning_effort=low` (they reject `minimal`).
- [x] Wake the sleeping Render backend on page load (`wakeBackend()` → `/health`).
- [x] Raise the PDF text cap from 12,000 to 50,000 characters and tell the user when a
      contract was cut off.
- [x] Support scanned PDFs by rendering up to 8 pages to images in the browser.
- [x] Skip a Gemini model for a cooldown after a quota/rate-limit error, and reorder the
      quality chain (3.5-flash → 3.5-flash-lite → 3.7-flash → 3.8-flash).
- [x] Disable "Take the quiz" (with a spinner + note) until the summary has finished
      streaming; it used to silently do nothing.
- [x] Add a favicon (removes the `/favicon.ico` 404).
- [x] GitHub Actions CI on every PR/push to `main`: `npm ci`, typecheck and build for
      frontend and backend (no API keys, no AI calls), plus a README status badge.
- [x] Branch protection on `main`: require a pull request and the two CI checks (set up
      with `gh` after the CI PR merges and has run on `main`).
- [x] Protect the backend from abuse: per-IP rate limit on `/api` (`express-rate-limit`,
      `TRUST_PROXY` for Render) and input checks in `services/validate.ts`.
- [ ] Retry on the next model when a model answers with malformed JSON, not only
      when it errors or times out.

### Design rework (post-parity)

The 1:1 port is done; the UI is now being redesigned deliberately. Direction —
*a trustworthy reader marking up your contract*: dull document paper resolving
into a clear plain-language sheet, set as a centered editorial column. New
palette + type tokens and web fonts (Newsreader / Libre Franklin) live in
`global.css`.

- [x] Home screen + shared shell (`Nav`, `Footer`, tokens, fonts).
- [x] Upload screen.
- [x] Loading screen.
- [x] PreQuiz screen.
- [x] Summary screen (incl. streaming skeleton / risk flags).
- [x] Quiz screen.
- [x] Compare screen.
- [x] EN copy sweep to sentence case for headings and primary labels.
- [ ] Retire the legacy token aliases (`--bg`, `--navy`, …) — mechanical
      find-and-replace across the now-reworked screen rules.
- [ ] Accessibility pass on quiz/upload (see P2) — `:focus-visible` and
      `prefers-reduced-motion` are handled; ARIA/labels still unaudited.
- [x] `disclaimer-wrap` label, the "or" divider and the sample button on the Upload
      screen moved into `TRANSLATIONS` (EN + ES). Swept the rest of the frontend for
      hardcoded English: quiz filler option, error messages, `<html lang>`.
- [x] Replace `window.alert` with the in-page `<ErrorBanner/>` (translated, with the
      retry control next to it). This also fixes a quiz failure that set an error
      nobody could see, and a stuck loading screen when a request failed instantly.

### P2 — Later
- [ ] Basic automated tests (at minimum: `parseJSON`, `escHtml`, quiz scoring,
      the `_sum*` streaming extractors, `scoreCopy.comparison`). The split makes
      this straightforward — the logic now lives in importable `lib/` modules.
- [ ] Save/export a summary (e.g. as PDF or plain text) instead of losing it on
      refresh.
- [ ] Accessibility pass on quiz and upload screens.
- [ ] Consider additional languages beyond EN/ES if there's real demand.

### Explicitly out of scope for now
- User accounts / login.
- Storing uploaded contracts server-side (privacy — contracts are sensitive
  documents; avoid persisting them until there's a real reason to).
