# Reward content: HR Interview Cheat Code v2.0

**Date:** 2026-09-12
**Reward:** `ebook` (DIGITAL, 600 points, UNLIMITED) — first of the two volumes
**Source:** `docs/rewards/hr-interview-playbook/`
**Output:** `dist/HR-Interview-Cheat-Code-v2.pdf`, 21 pages, A4

## Goal

Replace the v1 playbook PDF with an edition that is worth 600 points: better
looking, more useful, less dense, and free of the defects that shipped in v1.

## What was wrong with v1

Found by reading the file, not by guessing:

- The index labelled Stage 4 with an empty box, and printed Q06 (Stage 2) in the
  middle of the Stage 3 pages.
- The cover headline faked an outline by stacking a second copy of the text, so
  copying from the PDF produced `CCHHEEAATTCCOODDEE`.
- Diagrams were ASCII art. Every one of them was misaligned.
- Emoji carried meaning (stop signs, swords, targets) and render differently in
  every PDF viewer.
- Line breaks produced broken words such as `endto-end`.
- Several pages were half empty while others were wall-to-wall text.

## Decisions

- **Premium editorial, not arcade.** Hairline borders, one soft elevation, one
  accent colour per stage, generous white space. No pixel type, no pixel art,
  no chunky offset shadows.
- **Every diagram is markup or SVG.** Flows, the teamwork cycle, the Yerkes–Dodson
  curve, the UVP venn, the research quadrants, the CAR proportion bars.
- **Icons are drawn, never typed.** The embedded latin subsets stop at U+206F, so
  a literal arrow or check mark falls back to a system font.
- **Fonts live in the repository** (`assets/fonts/`, SIL OFL) and are fetched one
  weight per request. A combined request returns a variable font, and Chromium
  rasterises variable-axis text into Type3 fonts when printing — soft glyphs and
  broken text selection.
- **Ligatures off.** The subsets carry the substitution rules but not the ligature
  glyphs, so "biografi" printed as "biograf".
- **Page numbers are derived.** The layout array is built first; the index, the
  footers and the progress bar all read from it. v1's index pointed at pages that
  had moved.
- **The example candidate stays one person** (Alvi, fresh graduate) across all
  twelve blueprints, so the reader sees one story from twelve angles.
- **Voice stays formal** ("Anda"), as in v1 and the rest of Sekolah Karir's
  editorial products.

## Structure (21 pages)

| Pages | Content |
|---|---|
| 01–02 | Cover, index with three reading routes |
| 03–04 | Stage 1: pause rule, confidence matrix, rescue lines, presence, prep checklist, online setup |
| 05–08 | Stage 2: self introduction, career choice, target company, company research |
| 09–12 | Stage 3: teamwork, conflict, defining success, unique value proposition |
| 13–16 | Stage 4: handling challenge, motivation, decision making, STAR/CAR/PAR master template |
| 17–18 | Boss Stage: weakness, salary expectation, thin experience, reverse questions |
| 19–20 | Story Bank worksheet, closing checklist, follow-up email template |
| 21 | Back cover |

Each blueprint page carries five layers: the hidden question, traps vs. what is
judged, the framework drawn, one worked answer, then a pro move and an Arena tie-in.

## New in v2

- **Boss Stage.** The four questions that decide offers and were missing from v1:
  weakness, salary expectation, thin experience, and reverse questions (with a
  bank of what to ask and what to save for the offer stage).
- **Rescue lines.** What to say when you do not know the answer, lose the thread,
  are asked something outside your field, or face silence.
- **Online interview setup**, **Story Bank worksheet**, **self-scoring card**, and a
  **follow-up email template**.
- Frameworks are now named where they have real names (Yerkes–Dodson,
  Challenge-Based Learning, Vroom–Yetton, noted as simplified from five styles).

## Pipeline

```
node docs/rewards/hr-interview-playbook/fetch-fonts.mjs   # once
node docs/rewards/hr-interview-playbook/build.mjs         # content -> dist/playbook.html
node docs/rewards/hr-interview-playbook/render.mjs        # -> dist/*.pdf, refuses on overflow
python docs/rewards/hr-interview-playbook/verify.py       # checks + dist/preview/*.png
```

`render.mjs` refuses to write the PDF when content overflows a page or a font
failed to load, and reports pages whose blocks are spread thin. `verify.py`
checks the embedded fonts, rejects Type3 and system fallbacks, catches glyphs
outside the embedded subsets, catches text printed twice, and confirms every
index entry points at the page that actually holds it.

`dist/` is git-ignored; the PDF is reproducible from the source files.

## Open items

- The catalog SKU is titled "E-Book Banting Stir Karir & HR Interview Guide". Only
  the HR Interview volume exists. Either the second volume gets written or the SKU
  is renamed — an owner decision, not made here.
- Delivery follows the `notion-kit` pattern: the PDF is attached to a Notion page
  the owner publishes (private draft:
  <https://app.notion.com/p/3d9e44db112d818cb8f9dc85f5e659f8>). The published link
  then goes into the SKU's delivery link on `/app/admin/rewards`, which emails the
  reward automatically on claim.
