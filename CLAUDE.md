# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClearSign is a single-file web application (`index.html`) — no build step, no dependencies to install, no framework. Open the file directly in a browser to run it. All HTML, CSS, and JavaScript live in one file.

## Architecture

The app is a single-page application built with a screen-switching pattern. There is no router — screens are shown/hidden with a CSS class:

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

### Screens (in DOM order)

| Screen ID | Purpose |
|---|---|
| `#home-screen` | Landing page with hero and feature cards |
| `#upload-screen` | Drag-and-drop / browse file upload area |
| `#loading-screen` | Spinner shown during PDF extraction and API calls |
| `#summary-screen` | AI-generated plain-language contract breakdown |
| `#quiz-screen` | 5-question MCQ generated from the summary |

### Data flow

1. User uploads a PDF or image on the upload screen.
2. `handleFile(file)` dispatches to either `extractPdfText()` (PDF.js) or `encodeImageBase64()` (FileReader).
3. The extracted text or base64 data URL is sent to OpenRouter via `callOpenRouter()`.
4. The API returns a JSON object; `parseJSON()` strips markdown fences and falls back to regex extraction.
5. `populateSummary()` fills the summary screen DOM and stores the data in `currentSummaryData`.
6. On the summary screen, "Take the Quiz" calls `startQuiz()`, which calls `callOpenRouterForQuiz()` with the stored summary, then `renderQuiz()` builds the question DOM.

### External dependencies (CDN only)

- **PDF.js 3.11.174** — `pdf.min.js` + `pdf.worker.min.js` from cdnjs. Worker URL must be set via `pdfjsLib.GlobalWorkerOptions.workerSrc`.
- **OpenRouter API** — `https://openrouter.ai/api/v1/chat/completions`, model `openrouter/free`. API key is hardcoded in `API_KEY`. Images use the vision message format (`image_url` content block); PDFs use plain text messages.

### Key implementation details

- **PDF text cap:** Extracted text is capped at 12,000 characters to stay within free-tier token limits.
- **JSON parsing:** `parseJSON()` strips ` ```json ` fences first, then falls back to matching the first `{...}` or `[...]` block in the response.
- **XSS:** All API-returned strings must go through `escHtml()` before being set as `innerHTML`.
- **Quiz state:** `currentSummaryData`, `quizAnswered`, and `quizScore` are module-level variables reset at the start of each `startQuiz()` call.
- **Quiz answer format:** The API is asked to return `[{ "question": "...", "options": ["A","B","C","D"], "correct": 0 }]` — `correct` is a zero-based index.

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

Risk flags use warm red tones (`#fef6f2` background, `#c95f30` left border). Correct answers use `#edf7ed` / `#6aad6a`; wrong answers use `#fef1ee` / `#d87a5a`.
