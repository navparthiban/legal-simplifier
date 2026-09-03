# PRD — ClearSign

This is a living roadmap doc: current state, known gaps, and what's next. Update it
whenever scope changes — don't let it drift out of sync with reality the way
`CLAUDE.md` had.

## Current State

ClearSign is a single-file static web app (`index.html`, ~2,570 lines) with no
backend, no build step, and no persistence. It runs entirely in the browser.

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

- **P0 — API key exposed client-side.** The OpenRouter API key is a hardcoded
  string in `index.html`, sent from the browser on every request. Anyone with
  view-source access to the deployed page can read and reuse it, regardless of
  whether the git repo itself is public. There is no way to truly hide a secret
  in client-only code — this requires a backend to proxy the API call.
  **In progress:** restructuring into a frontend/backend split so the key lives
  server-side in a `.env` file (see Roadmap below).
- **P0 — No backend at all.** Everything (extraction, AI calls, quiz scoring) runs
  client-side. This caps what the app can ever do (no accounts, no saved history,
  no rate limiting, no usage tracking) and is the root cause of the API key issue.
- **P1 — Duplicated sample contract data.** `SAMPLE_PDF_B64` in `index.html` is the
  entire `SampleRentalAgreement.pdf` re-encoded as a ~215,000-character base64
  string literal — duplicating the PDF file that already sits in the repo. This
  alone accounts for a large share of `index.html`'s 311KB size and has to be
  hand-regenerated if the sample contract ever changes.
- **P1 — One giant file.** All markup, styles, and logic for 7 screens live in one
  `index.html`. It works, but it's hard to navigate, hard to test, and every
  change risks touching unrelated code. Restructuring is planned (see Roadmap).
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

### P0 — In Progress
- [ ] Split `index.html` into a proper frontend/backend structure.
- [ ] Move the OpenRouter API key into a server-side `.env` file, proxied through
      a backend endpoint. Add `.env` to `.gitignore`.

### P1 — Next
- [ ] Stop embedding the sample contract as a base64 JS literal — load
      `SampleRentalAgreement.pdf` as a static asset / fetched file instead.
- [ ] Add a retry/backoff for AI calls that return malformed JSON or hit rate
      limits.
- [ ] Rotate the OpenRouter key that was previously committed to git history,
      once the client-side key is removed.

### P2 — Later
- [ ] Basic automated tests (at minimum: `parseJSON`, `escHtml`, quiz scoring).
- [ ] Save/export a summary (e.g. as PDF or plain text) instead of losing it on
      refresh.
- [ ] Accessibility pass on quiz and upload screens.
- [ ] Consider additional languages beyond EN/ES if there's real demand.

### Explicitly out of scope for now
- User accounts / login.
- Storing uploaded contracts server-side (privacy — contracts are sensitive
  documents; avoid persisting them until there's a real reason to).
