# Frontend Wiring Phase 9a — Public Reads (DONE)

Scope: public Arena surfaces read live backend data. Visuals frozen; only
data sources moved. Authenticated `/app/*` screens stay on `DemoProvider`
mocks until Phase 9b (they need a browser SSO session).

## Seam

`src/lib/arena-view.ts` (server-only): backend services → the view models
the approved components already render. Pages stay thin; components stay
dumb; the adapter owns every mapping decision.

## Honest mappings (nothing invented)

- `points` / `participants` REMOVED from public UI where the backend has no
  source. Per-project points were mock-only; PRD pays points by rank (§34),
  and no live participant counter exists. The types document this
  (`points?`, `participants?`).
- `difficulty`: schema knows only `STANDARD` today → shown as Intermediate
  until the generator phase ships real bands.
- `week`: ISO week number of `opensAt`. Deadline label renders the real
  `submissionDeadlineAt` (`Jumat · 23.59` WIB).
- `estimatedTime`: from `estimated_minutes` (`180` → `3 jam`).
- Detail `deliverables` ← submission requirements (label + instructions);
  `resources` ← empty (no backend source yet, renders empty state as before).
- Rubric weights normalized to /100 for the existing `{weight} pts` badge.

## Wired pages (verified live over HTTP on production build)

- `/arena`: stats (live project count, live deadline, live division count),
  `KanbanPreview` (live top-4 + live week label + live total), live week badge.
- `/arena/projects`: `ProjectBrowser` with live projects + live division
  groups (search/filters/counts all work off live data).
- `/arena/projects/[slug]`: fully live (hero, tabs, rubric, requirements,
  skills). Unknown slug → branded 404 UI + `noindex`.
- Public catalog/leaderboard have APIs but no public UI yet (needs product
  copy + design pass; tracked for 9b).

## Backward-compatible component props

`ProjectBrowser`, `KanbanPreview`, `DetailTabs` accept live data via props
and default to mocks — `(app)` demo screens render untouched. `CtaActions`
(enroll = write path) intentionally left for 9b.

## Known issue (SEO polish, hardening phase)

Unknown project slugs render the correct branded 404 UI with `noindex`, but
the HTTP status line stays 200 in this Next setup instead of 404. User-facing
behavior is right; status-code fidelity is tracked for production hardening.

## Next (Phase 9b)

Enrollment/workspace/submission/result/profile/notifications/milestones
screens behind the Arena session: service client + session context replacing
`DemoProvider` reads/actions, preserving routes and visuals.
