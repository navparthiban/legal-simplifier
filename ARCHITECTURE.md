# ARCHITECTURE.md

Living doc — kept in sync with the actual file layout as the project changes.
Last verified against the codebase: 2026-09-03.

> **Note:** A restructure from single-file to a frontend/backend split is in
> progress (see `PRD.md` → Roadmap → P0). This doc currently describes the
> **pre-restructure** state. It will be rewritten once the split lands.

## File Layout (current)

```
legal-simplifier/
├── index.html                 # entire app: HTML + CSS + JS (~2,570 lines)
├── SampleRentalAgreement.pdf  # sample contract used by "Try Sample Contract"
│                               # (also duplicated as base64 inside index.html — known issue, see PRD)
├── README.md
├── PRD.md
├── ARCHITECTURE.md
└── CLAUDE.md
```

`index.html` itself has three regions:
- `<style>` (head) — all CSS, including the `:root` color palette.
- `<body>` — markup for all 7 screens, in DOM order (see below).
- `<script>` (end of body) — all JS: translations, screen switching, file
  handling, API calls, rendering, quiz logic.

## Screens

There is no router. Screens are `<section>`s toggled with a CSS class:

```css
.screen { display: none; }
.screen.active { display: flex; flex-direction: column; }
```

```js
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}
```

| Screen ID | Purpose |
|---|---|
| `#home-screen` | Landing page — hero, feature cards, language toggle |
| `#upload-screen` | Drag-and-drop / browse upload, disclaimer checkbox gate, "Try Sample Contract" |
| `#loading-screen` | Spinner during PDF extraction and the initial API call |
| `#prequiz-screen` | 5-question quiz generated from the **raw contract text**, before the user sees the summary |
| `#summary-screen` | AI-generated plain-language breakdown, streamed in progressively |
| `#quiz-screen` | 5-question quiz generated from the **summary**, after the user has read it |
| `#compare-screen` | Pre-quiz vs. post-quiz score comparison |

## Data Flow

```
Upload (or Sample Contract)
        │
        ▼
handleFile(file) ──► extractPdfText()  [PDF via PDF.js]
        │        └─► encodeImageBase64() [image via FileReader]
        ▼
callOpenRouterForPreQuiz(file, content)  ──► showPreQuiz() ──► renderPreQuiz()
        │  (user answers 5 questions on the raw contract)
        ▼
callOpenRouterStream(file, content, onChunk)  ──► _applyStreamingSummary()
        │  (summary streams into the UI as it's generated)
        ▼
parseJSON() ──► populateSummary() ──► currentSummaryData (stored)
        │
        ▼
"Take the Quiz" ──► startQuiz() ──► callOpenRouterForQuiz(currentSummaryData)
        │
        ▼
renderQuiz() ──► showResults() ──► showComparison()
        (pre-quiz score vs. post-quiz score)
```

All four OpenRouter call sites (`callOpenRouter`, `callOpenRouterForPreQuiz`,
`callOpenRouterStream`, `callOpenRouterForQuiz`) send the same `Authorization:
Bearer ${API_KEY}` header — currently a hardcoded client-side constant (see PRD
P0).

## Key Functions (by role)

**i18n**
- `TRANSLATIONS` — `{ en: {...}, es: {...} }` dictionary keyed by string IDs
  used in `data-i18n` / `data-i18n-html` attributes throughout the markup.
- `t(key)` — looks up the active language, falling back to English.
- `applyTranslations()` — walks the DOM and fills in `data-i18n[-html]` elements.
- `setLanguage(lang)` — swaps the active language and re-applies translations.

**Screen / flow control**
- `showScreen(name)`, `toggleUploadLock()`, `setLoadingLabel()`, `showError()` /
  `hideError()`.

**File input**
- `handleFile(file)` — dispatches to PDF or image handling based on MIME type.
- `extractPdfText(file)` — PDF.js extraction, capped at 12,000 characters.
- `encodeImageBase64(file)` — FileReader → base64 data URL for vision input.
- `loadSampleContract()` — decodes `SAMPLE_PDF_B64` (see PRD P1: this duplicates
  `SampleRentalAgreement.pdf`) and feeds it through the same `handleFile` path.

**AI calls** (`MODEL = 'openrouter/free'`)
- `callOpenRouter(file, content)` — non-streaming summary call.
- `callOpenRouterStream(file, content, onChunk)` — streaming summary call, used
  on the real (non-sample) path; feeds `_applyStreamingSummary`.
- `callOpenRouterForPreQuiz(file, content)` — quiz from raw contract text.
- `callOpenRouterForQuiz(summaryData)` — quiz from the generated summary.

**Parsing / rendering**
- `parseJSON(raw)` — strips ` ```json ` fences, falls back to regex-matching the
  first `{...}` / `[...]` block, tolerates trailing commas.
- `validateQuestions(questions)` — sanity-checks quiz shape before rendering.
- `populateSummary()`, `fillList()`, `fillRisks()` — fill the summary screen DOM.
- `escHtml(str)` — **must** wrap any AI-returned string before it's set via
  `innerHTML`, to prevent XSS from a malicious/compromised model response.
- `renderPreQuiz()` / `renderQuiz()`, `selectPreAnswer()` / `selectAnswer()`,
  `showPreQuizResults()` / `showResults()`, `showComparison()`.

## Module-Level State

- `currentSummaryData` — the parsed summary object, reused when generating the
  post-reading quiz.
- Pre-quiz score / post-quiz score — held in module scope, read by
  `showComparison()`.
- `quizAnswered`, `quizScore` — reset at the start of each `startQuiz()` call.

## External Dependencies (CDN only)

- **PDF.js 3.11.174** — `pdf.min.js` + `pdf.worker.min.js` from cdnjs. Worker URL
  is set via `pdfjsLib.GlobalWorkerOptions.workerSrc`.
- **OpenRouter API** — `https://openrouter.ai/api/v1/chat/completions`,
  model `openrouter/free`. Images use the vision `image_url` content block;
  PDFs use plain text messages.

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
`#fef1ee` / `#d87a5a`.
