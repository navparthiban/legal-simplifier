# PRD — ClearSign

This is a living roadmap doc: current state, known gaps, and what's next. Update it
whenever scope changes — don't let it drift out of sync with reality the way
`CLAUDE.md` had.

## Current State

ClearSign is a **`frontend/` (Vite + React + TypeScript) + `backend/`
(Express + TypeScript)** app. The backend is the only OpenRouter client and
reads the API key from `backend/.env`. It was ported screen-by-screen from the
original single-file `index.html` (now removed) with a zero-drift parity
guarantee — see `docs/superpowers/`.

No persistence, no accounts — same as before.

**Working today:**
- Upload flow (drag-and-drop or browse) for PDF and image contracts.
- PDF text extraction via PDF.js; images sent to the AI as vision input.
- AI-generated plain-language summary (obligations / deadlines / rights / risk
  flags), streamed into the UI as it's generated.
- Pre-reading and post-reading 5-question quizzes, with a before/after score
  comparison screen.
- EN/ES language toggle with a full UI translation dictionary.
- "Try Sample Contract" demo mode using a bundled sample rental agreement.
- Reasonable error handling on API calls (try/catch with user-facing messages).
- XSS protection on AI-returned text via `escHtml()` before it hits `innerHTML`.

## Known Gaps / Risks

Roughly ordered by severity.

- **P0 — Rotate the previously-committed OpenRouter key.** The key that used to
  be hardcoded in `index.html` is in git history and now lives in
  `backend/.env`. It is no longer shipped to the browser, but anyone with the
  git history has it, so it must be rotated on OpenRouter and the new value put
  in `backend/.env` (and the deploy host's env vars) only.
- **P1 — Free-tier model reliability.** `openrouter/free` is used for all AI calls.
  Free-tier models can be slow, rate-limited, or produce malformed JSON — the app
  has fallback parsing (`parseJSON`) but no retry/backoff strategy.
- **P2 — No automated tests.** No unit tests, no end-to-end tests. Regressions are
  currently caught by hand.
- **P2 — No persistence.** Nothing is saved between sessions — re-uploading a
  contract re-runs the full AI pipeline and costs tokens again.
- **P2 — Accessibility unaudited.** No explicit ARIA/keyboard-nav pass has been
  done on the quiz or upload flows.

## Roadmap

### P0 — Done
- [x] Split `index.html` into a proper frontend/backend structure
      (`frontend/` Vite + React + TS, `backend/` Express + TS).
- [x] Move the OpenRouter API key into a server-side `.env` file, proxied
      through backend endpoints. `.env` is gitignored; `.env.example` committed.
- [x] Verify the new app matches `index.html` screen-by-screen (EN + ES, sample
      path, full flow); `index.html` removed.

### P0 — Open
- [ ] Rotate the OpenRouter key that was previously committed to git history
      and put the new value in `backend/.env` + the deploy host's env vars only.

### P1 — Next
- [x] Stop embedding the sample contract as a base64 JS literal — it is now
      served from `frontend/public/SampleRentalAgreement.pdf` and fetched.
- [ ] Add a retry/backoff for AI calls that return malformed JSON or hit rate
      limits.

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
