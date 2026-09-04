# Parity Checklist — new frontend/backend app vs. `index.html`

Work through this with both versions open side by side. **Left:** open the
original `index.html` directly in a browser (or `npx serve` from the repo root).
**Right:** run the new app —

```bash
cd backend  && npm install && cp .env.example .env   # set OPENROUTER_KEY
npm run dev
# new terminal
cd frontend && npm install && npm run dev            # http://localhost:5173
```

Any mismatch is a bug to fix, not a "close enough" (spec Parity Guarantee).
Check each row in **EN and ES**.

## Home
- [ ] Hero heading, paragraph, "Upload a Contract" button (icon + label)
- [ ] Three feature cards — labels, headings, body copy
- [ ] Divider between hero and cards; spacing / max-widths
- [ ] Nav brand "Clear**Sign**", EN/ES toggle highlight follows selection
- [ ] Footer text
- [ ] Language toggle changes every string above + the browser tab title

## Upload
- [ ] Back arrow → Home
- [ ] Heading + subcopy
- [ ] Disclaimer checkbox: drop zone is dimmed/locked, file input + "Try a
      Sample Contract" disabled until it's checked. (Known quirk carried over
      from the original: a click that lands on the disclaimer *text* toggles via
      the label and re-toggles via the wrap, netting no change — click the
      checkbox itself or the padding around the text.)
- [ ] Drag a PDF over the zone → border/background highlight; drop → proceeds
- [ ] "Browse Files" opens the file picker
- [ ] Accepted-formats row: label + PDF / JPG / PNG / WEBP tags
- [ ] "or" divider + sample button; sample button label stays
      "Try a Sample Contract" in both languages (it has no translation in the
      original either)
- [ ] Trigger an error (e.g. disconnect network, upload a text-only image) →
      red error banner appears above the disclaimer with the same message

## Loading
- [ ] Spinner + label ("Reading your contract…" → "Generating your quiz
      questions…" → "Simplifying your contract…") + "This usually takes 15–30
      seconds." subline
- [ ] Fade transition between screens (~180ms)

## Pre-Quiz
- [ ] Back arrow → Upload
- [ ] Heading + subcopy + the "Why?" intro box (bold "Why?")
- [ ] 5 questions, "Question N of 5" labels
- [ ] Pick an answer → all options lock; correct = green, your wrong pick =
      red, others dimmed
- [ ] After the 5th answer → score ring (`N / 5`), label + message for that
      score, "See the Simplified Summary" button
- [ ] Results block scrolls into view

## Summary (streaming)
- [ ] On first tokens: shimmer skeletons for title/parties and all four lists
- [ ] Title/parties fill in with a blinking cursor while incomplete
- [ ] Each list (Obligations / Deadlines / Rights) pops in when its array closes
- [ ] Risk Flags render as bordered cards (title + body)
- [ ] Section tags/titles, dividers, file chip with filename
- [ ] Final state: no cursor artifacts, "Contract Summary" fallback title if the
      model omitted one
- [ ] Quiz CTA block (label / heading / copy / "Take the Quiz" button)
- [ ] Back arrow → Upload

## Quiz
- [ ] Back "Back to Summary" arrow
- [ ] Loading spinner ("Generating your questions…") then 5 questions
- [ ] Same lock/colour behaviour as the pre-quiz
- [ ] After the 5th: score ring, label + message, "Try Again" /
      "Back to Summary" / "See Your Progress" buttons
- [ ] "Try Again" regenerates a fresh quiz

## Compare
- [ ] Heading + subcopy
- [ ] Two cards: "Before the summary" / "After the summary", each `N` + "out of 5"
- [ ] Delta line: `+N point(s)` green / "Same score" grey / `-N point(s)` orange,
      with the matching message (check +1, +2/3, same-at-5, same-other,
      negative)
- [ ] "Upload Another Contract" → Home

## Cross-cutting
- [ ] Colours exactly match (beige bg, navy/blue, warm-red risk flags,
      green/red answers)
- [ ] Fonts, weights, letter-spacing, border-radii
- [ ] `openrouter/free` can be slow / occasionally returns malformed JSON and
      shows "The AI returned an unexpected response." — this is pre-existing
      (PRD P1), not a regression
- [ ] Full run with the **sample contract** in both languages

---

When every box is checked: delete `index.html` and this file, drop the
"parity reference" notes from `README.md` / `CLAUDE.md` / `ARCHITECTURE.md` /
`PRD.md`, and rotate the OpenRouter key (`PRD.md` P0).
