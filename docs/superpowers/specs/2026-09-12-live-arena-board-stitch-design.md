# Live Arena Board — Google Stitch Design

## Goal

Replace the existing “contoh skor” element in the Side Hustle Arena Stitch design with a live-event card that follows the supplied mockup 1:1. The card must communicate what is running now and give every active project a direct path to participation.

## Approved Direction

Use the focused Live Arena Board composition without tabs or summary metrics. Preserve the supplied mockup’s hierarchy, density, and order:

1. `LIVE ARENA BOARD` heading and current batch badge.
2. Red deadline strip with the absolute deadline and a live countdown.
3. Three active-event rows.
4. Compact recent-activity feed.

The card replaces the example-score module in its existing hero position. It does not add a second dashboard or change unrelated page sections.

## Event Row

Each row contains:

- division badge;
- estimated effort with a clock icon;
- current participant count with a blue live dot;
- project title;
- deliverable label and deliverable name;
- `Ikuti →` action.

The three visible rows use realistic Side Hustle Arena content matching the reference: Data, Product, and UI/UX. The content is presentation data in Stitch; the production implementation should use the live current-week source rather than fixed counts.

## Link Behavior

- Each `Ikuti →` action links to that project’s detail route: `/arena/projects/[slug]`.
- The board heading and batch badge may link to `/arena/projects`, giving users a path to the complete active-event list.
- The recent-activity item links to the relevant public result only when a public destination exists; otherwise it remains non-interactive.
- Links use visible hover and keyboard-focus states. The whole event row must not become a competing nested link.

## Visual Rules

- Match the supplied mockup’s pale lavender card background, navy text, blue live/CTA accents, and soft red deadline strip.
- Maintain the compact rectangular rows, subtle radius, minimal shadow, and tight vertical rhythm.
- Use proper clock and status icons rather than emoji.
- Preserve text contrast of at least 4.5:1 and a minimum 44px action target for `Ikuti`.
- Countdown and participant totals should not rely on color alone; their text labels remain visible.

## Responsive Behavior

- Desktop/tablet: preserve the reference’s single-column board with right-aligned participant counts and actions.
- Mobile: keep the row order, allow title and deliverable text to wrap, move the participant count below metadata when required, and keep `Ikuti` visible without horizontal scrolling.
- Activity timestamp stays right-aligned when space permits and moves below the activity copy on narrow screens.

## States

- No active events: retain the board shell and show `Belum ada event aktif` with a link to the project archive.
- Missing participant count: show `— Talenta`, never a fabricated number.
- Countdown unavailable: show the formatted absolute deadline only.
- More than three active events: show the first three by deadline priority and a `Lihat semua event` link below the rows.

## Acceptance Criteria

- The “contoh skor” element is fully replaced by the Live Arena Board.
- The result visually matches the supplied mockup 1:1 in information hierarchy and component structure.
- Three active events, the deadline strip, and one recent-activity row are visible in the primary state.
- Every `Ikuti` action has a distinct project-detail destination.
- The board remains legible and actionable at mobile width without horizontal overflow.
- No unrelated Side Hustle Arena sections are changed.
