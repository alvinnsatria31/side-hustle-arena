# HR Interview Cheat Code v2.0

Source for the `ebook` reward (600 points). Design decisions and the list of v1
defects this edition fixes live in
`docs/superpowers/specs/2026-09-12-hr-interview-playbook-v2-design.md`.

## Build

```bash
node docs/rewards/hr-interview-playbook/fetch-fonts.mjs   # only to change weights
node docs/rewards/hr-interview-playbook/build.mjs         # content -> dist/playbook.html
node docs/rewards/hr-interview-playbook/render.mjs        # -> dist/HR-Interview-Cheat-Code-v2.pdf
python docs/rewards/hr-interview-playbook/verify.py       # checks + dist/preview/*.png
```

`render.mjs` exits non-zero and writes nothing when a page overflows or a font
failed to load. `verify.py` exits non-zero on Type3 or fallback fonts, glyphs
outside the embedded subsets, text printed twice, or an index entry pointing at
the wrong page. Run both before handing the PDF to anyone.

## Layout

| Path | What it holds |
|---|---|
| `content/stage2,3,4.mjs` | The twelve blueprints |
| `content/extras.mjs` | Cover, index, Stage 1, Boss Stage, worksheet, closing |
| `build.mjs` | Page templates and every diagram; assembles the HTML |
| `render.mjs` | Chromium print, with the overflow and font guards |
| `verify.py` | PDF checks and page previews |
| `styles.css` | The design system |
| `assets/fonts/` | Manrope, Plus Jakarta Sans, JetBrains Mono (SIL OFL) |

Editing text means editing `content/`. Editing how a page looks means editing
`build.mjs` and `styles.css`. Page numbers are derived from the layout array at
the bottom of `build.mjs`; never type one by hand.

## Traps worth remembering

- Fetch fonts **one weight per request**. A combined request returns a variable
  font, and Chromium prints variable-axis text as Type3 — soft glyphs, broken
  text selection.
- Ligatures stay off: the subsets carry the substitution rules but not the
  ligature glyphs, so `fi` words lose letters.
- Arrows, check marks and crosses are drawn as SVG. The embedded latin subsets
  stop at U+206F, so a typed one silently falls back to a system font.

## Delivery

The PDF is attached to a Notion page, the same pattern as the Notion kit reward:
<https://app.notion.com/p/3d9e44db112d818cb8f9dc85f5e659f8>. It is a private
draft until the owner publishes it (Share → Publish; the API cannot do this).

Once published, paste that link into the `ebook` SKU's delivery link on
`/app/admin/rewards`. Digital rewards are then emailed automatically on claim; a
SKU with no delivery link leaves the claim PENDING for manual fulfilment.
