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

- Vanilla HTML / CSS / JavaScript — no framework, no build step.
- [PDF.js](https://mozilla.github.io/pdf.js/) for client-side PDF text extraction.
- [OpenRouter](https://openrouter.ai/) for the AI summary and quiz generation.

## Running It

This project is currently a single static file with no dependencies to install.

1. Clone the repo.
2. Open `index.html` in a browser (or serve it with any static file server —
   PDF.js's worker requires `http://` rather than `file://` in some browsers).

No build step, no `npm install`.

> **Note:** the app currently talks to OpenRouter directly from the browser using
> an API key baked into the page. That key is being moved server-side — see
> [`PRD.md`](./PRD.md) for the in-progress restructure. Until that lands, don't
> rely on this app with a key you care about, and don't fork it with your own key
> committed to a public repo.

## Project Docs

- [`PRD.md`](./PRD.md) — current state, known gaps, and the roadmap.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — how the code is laid out and how data
  flows through the app.
- [`CLAUDE.md`](./CLAUDE.md) — instructions for Claude Code when working in this repo.

## License

Personal / educational project. No license specified yet.
