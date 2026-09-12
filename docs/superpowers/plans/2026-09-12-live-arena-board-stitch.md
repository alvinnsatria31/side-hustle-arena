# Live Arena Board Google Stitch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Side Hustle Arena “contoh skor” visual in Google Stitch with the approved 1:1 Live Arena Board and working project links.

**Architecture:** Edit a new Stitch variant of the existing screen so the source design remains recoverable. Keep one self-contained hero-side board with a header, deadline strip, three live event rows, and activity feed; attach explicit destinations to its navigational elements.

**Tech Stack:** Google Stitch visual editor, Side Hustle Arena web route conventions, responsive web layout.

---

### Task 1: Create the editable Stitch variant

**Artifacts:**
- Source: existing Side Hustle Arena Stitch screen
- Create: one named screen variant, `Live Arena Board`

- [ ] **Step 1: Open the existing Side Hustle Arena project and select the screen containing “contoh skor”.**

  Expected: the current hero and “contoh skor” element are visible in the editor.

- [ ] **Step 2: Create an editable variant named `Live Arena Board`.**

  Expected: the original screen remains available and the new variant is selected.

- [ ] **Step 3: Record a before-state screenshot.**

  Expected: screenshot visibly captures the element being replaced and its surrounding hero layout.

### Task 2: Replace “contoh skor” with the approved board

**Artifacts:**
- Modify: Stitch screen variant `Live Arena Board`
- Reference: `docs/superpowers/specs/2026-09-12-live-arena-board-stitch-design.md`

- [ ] **Step 1: Replace the selected element using this exact Stitch prompt.**

  ```text
  Replace only the existing “contoh skor” module with a LIVE ARENA BOARD card. Keep every other section, hero copy, navigation element, background, and page width unchanged.

  Match the supplied reference 1:1 in information hierarchy and density: a white rounded outer card with a pale lavender tint and soft shadow; header “LIVE ARENA BOARD” on the left and “BATCH 34” badge on the right; a full-width soft-red deadline strip reading “DEADLINE JUMAT 23:59 WIB” with a clock icon and countdown “3h 11m 38d”; then three stacked pale-lavender event cards.

  Event 1: DATA, clock icon, 6 Jam, blue live dot, 142 Talenta, title “Analisis Pola Permintaan & Buffer Stock Retail”, deliverable “SQL + Tableau Executive Deck”, CTA “Ikuti →”.
  Event 2: PRODUCT, clock icon, 5 Jam, blue live dot, 118 Talenta, title “Prioritas Fitur Kasir POS UMKM (RICE Matrix)”, deliverable “1-Page PRD + Release Plan”, CTA “Ikuti →”.
  Event 3: UI/UX, clock icon, 6 Jam, blue live dot, 94 Talenta, title “Micro-interaction Mood Tracker FinTech”, deliverable “Interactive Figma Prototype”, CTA “Ikuti →”.

  Add a compact activity feed below: blue live dot, bold “Dimas K.”, text “baru saja sync”, blue linked title “Fintech PRD”, text “(Skor: 94/100)”, and right-aligned “1m lalu”. Use navy text, accessible blue accents, proper vector clock/status icons, compact spacing, subtle 8–12px radii, and no emoji. Preserve the board as a single column. On mobile, wrap metadata and deliverables cleanly with no horizontal overflow and keep every “Ikuti” target at least 44px tall.
  ```

  Expected: only the score example is replaced; the board contains all three rows and the activity feed.

- [ ] **Step 2: Compare structure against the supplied mockup.**

  Expected: order is header → deadline → three event rows → activity feed, with no tabs, charts, summary tiles, extra gradients, or invented sections.

- [ ] **Step 3: Correct any generation drift with a targeted follow-up prompt.**

  ```text
  Keep the current page unchanged outside Live Arena Board. Inside the board, remove any extra content and restore this exact order: header and batch badge, one deadline strip, exactly three stacked event cards, one activity feed. Match the reference’s compact spacing and pale lavender surfaces.
  ```

  Expected: no unrelated page section changes and no extra board elements remain.

### Task 3: Add navigation targets

**Artifacts:**
- Modify: Stitch prototype links on `Live Arena Board`

- [ ] **Step 1: Link the board heading and `BATCH 34` badge to `/arena/projects`.**

  Expected: both elements navigate to the complete active-project list in preview mode.

- [ ] **Step 2: Link each `Ikuti →` independently.**

  ```text
  DATA    → /arena/projects/analisis-pola-permintaan-buffer-stock-retail
  PRODUCT → /arena/projects/prioritas-fitur-kasir-pos-umkm
  UI/UX   → /arena/projects/micro-interaction-mood-tracker-fintech
  ```

  Expected: each CTA has a distinct destination and no event row contains a nested competing link.

- [ ] **Step 3: Leave the activity row non-interactive unless its public result screen already exists in the Stitch project.**

  Expected: no dead or fabricated result link is introduced.

### Task 4: Verify desktop and mobile output

**Artifacts:**
- Verify: Stitch preview for desktop and mobile breakpoints

- [ ] **Step 1: Preview the desktop screen.**

  Expected: the board fits the former score-module area, labels do not collide, CTA text remains visible, and the rest of the page is unchanged.

- [ ] **Step 2: Preview the mobile screen.**

  Expected: no horizontal scrolling; long titles and deliverables wrap; participant totals and timestamps remain readable; `Ikuti` remains easy to tap.

- [ ] **Step 3: Activate every prototype link.**

  Expected: heading and badge open `/arena/projects`; the three CTA links open their three distinct project routes.

- [ ] **Step 4: Record an after-state screenshot.**

  Expected: screenshot visibly shows the final 1:1 board in context and provides evidence for handoff.
