# Dashboard UI Bug Audit — 2026-09-21

Static, read-only audit of the CURRENT dashboard surfaces (branch `feat/dashboard-nav-premium`,
HEAD `1d1cdf0`). The redesign (sidebar grouping, LeaderboardPreview) is not yet in the tree, so
only real bugs in what exists today are flagged — not deviations from the future design.

Reference implementations read first, in full: `src/components/layout/nav-links.ts`,
`src/components/layout/NavPromo.tsx`, `src/lib/dashboard-view.ts`.

Counts: 0 blocker · 0 major · 1 minor · 27 pass.

---

## [BUG-1] Dashboard copy uses "project", nav source-of-truth uses "proyek" for the same destination
- **Severity:** minor
- **Where:** `src/components/arena/ParticipantDashboard.tsx:288`
- **Evidence:** the nav source of truth spells it `proyek` — `src/components/layout/nav-links.ts:92`
  `{ label: 'Jelajahi proyek', href: '/app/arena/projects', icon: LayoutGrid },` — but the
  dashboard heading for that same href spells it `project` (`ParticipantDashboard.tsx:288`
  `title="Jelajahi project lain"`, same href at `:289`), as do the tiles
  (`src/components/arena/dashboard/StatStrip.tsx:84` `label: 'Project selesai',` and `:86`
  ``caption: attempted ? `dari ${attempted} project yang diambil` : ...``) and the hero
  (`src/components/arena/dashboard/SprintHero.tsx:91` `'Pilih project untuk sprint ini.'`). Both
  spellings are used for the same product concept on adjacent surfaces.
- **Fix:** Pick one spelling for user-facing copy (recommend `proyek`, matching `nav-links.ts`) and apply it consistently across dashboard headings, tiles, and hero.
- **Status:** pending (owner decides: accepted | rejected)

---

## PASS table (every other checklist item, with evidence)

| # | Item | Evidence |
|---|------|----------|
| 1a | Sidebar: active state reachable for every internal `appNavLinks()` href | `AppSidebar.tsx:43` `const active = isNavActive(link.href, pathname);` + `isNavActive` (`nav-links.ts:140-148`): `/app/arena` exact-matches `:146-147`; `/app/arena/projects`, `/my-projects`, `/leaderboard` prefix-match `:148`; `/app/profile#rewards` exact-matches target `/app/profile` via `:146-147`. External `TOOLS` returns `false` by documented design (`nav-links.ts:36-38`, `:141-143`) — never active, never wrong. |
| 1b | Sidebar: promo pill appears at most once | `TOOLS` (`highlight: true`, `nav-links.ts:56-62`) is a single entry in `APP_ALL` (`:90-97`); `AppSidebar.tsx:41` maps the list once, pill branch at `:51-52` + `NewBadge` at `:61`. |
| 1c | Sidebar: touch target ≥44px | Row class `min-h-11` (`AppSidebar.tsx:50`); footer links `min-h-11` (`:71`, `:79`); logo link `min-h-12` (`:19`). |
| 1d | Sidebar: focus-visible ring present | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white` (`AppSidebar.tsx:50`, logo `:19`). |
| 1e | Sidebar: no dead href | All six `APP_ALL` hrefs resolve (see cross-surface rows 7a–7b); `TOOLS` URL is sanctioned. |
| 2a | Navbar: desktop dropdown contains zero nav links | Nav links render only inside `<div className="md:hidden">` (`AppNavbar.tsx:147-173`); desktop menu holds only Admin (`:175-184`), Profil (`:185-192`), Keluar (`:193-201`). |
| 2b | Navbar: mobile dropdown contains all `appNavLinks()` | `const links = appNavLinks();` (`AppNavbar.tsx:31`) mapped in full (`:148-171`) with `NavAnchor` preserving external handling (`:152`). |
| 2c | Navbar: bell `aria-label` includes unread count | `aria-label={\`Notifikasi, ${unread} belum dibaca\`}` (`AppNavbar.tsx:95`); badge `99+` cap (`:101`). |
| 2d | Navbar: Escape closes menu | `if (e.key === 'Escape') setMenuOpen(false);` (`AppNavbar.tsx:67`), listener wired `:70`/removed `:73`. |
| 2e | Navbar: admin link only when `isAdmin` | `{isAdmin && (<Link href="/app/admin" …` (`AppNavbar.tsx:175-184`). |
| 3a | Bottom nav: tab count ≤5 | `BOTTOM_ALL` holds 5 entries (`nav-links.ts:103-109`); `bottomNavLinks()` enforces `.slice(0, 5)` (`:113`); `COLS` covers 1–5 (`MobileBottomNav.tsx:16-22`). |
| 3b | Bottom nav: active pill + label both reflect `isNavActive` | `const active = isNavActive(tab.href, pathname);` (`:37`); pill `active && 'bg-sk-blue-tint'` (`:54`); label `active ? 'text-sk-blue' : …` (`:47`); `aria-current` (`:43`). |
| 3c | Bottom nav: labels don't truncate at 360px | Labels are 5–9 chars (`Ringkasan/Proyek/Proyekku/Peringkat/Profil`) at `text-[9.5px]` (`:45`); `max-w-full truncate` (`:59`) degrades to ellipsis instead of breaking layout — no overflow path. |
| 3d | Bottom nav: `safe-bottom` padding present | Class on nav (`MobileBottomNav.tsx:31`); definition exists (`src/app/globals.css:131-133`). |
| 4a | Dashboard: `StatStrip` tile hrefs all resolve | `/app/profile#rewards` (`StatStrip.tsx:79`), `/app/arena/my-projects` (`:87`), `/app/career-report` (`:95`), `/app/arena/leaderboard` (`:105`) — route files `app/profile/page.tsx`, `app/arena/my-projects/page.tsx`, `app/career-report/page.tsx`, `app/arena/leaderboard/page.tsx` all exist. |
| 4b | Dashboard: `SectionHead` links resolve | `/app/arena/projects` (`ParticipantDashboard.tsx:289`), `/app/arena/my-projects` (`:316`) — both route files exist. |
| 4c | Dashboard: empty states have working `action.href` | `EnrollmentHistory` → `/app/arena/projects` (`:183`); explore section → `/app/arena/projects` (`:302`); history section → `/app/arena/projects` (`:331`); `EmptyState` renders action as `Link` (`EmptyState.tsx:42-50`). |
| 4d | Dashboard: empty-state vs data branches can't both render | Mutually exclusive ternaries: `available.length ? … : <EmptyState/>` (`:291-304`), `past.length ? … : <EmptyState/>` (`:318-334`), `history.length ? … : <EmptyState/>` (`:172-185`), `!data ? skeleton : data` (`:265-269`). |
| 4e | Dashboard: stale-while-refresh keeps old data | `<ResourceState loading={false} …` (`:264`) never swaps body for a spinner; data wrapper uses `aria-busy` + `opacity-60` (`:270-273`); `DashboardSkeleton` only on first load (`:265-268`). |
| 4f | Dashboard extras audited, no bug | `RefreshButton` `anim-spin` class is real (`globals.css:262-264`, used `ParticipantDashboard.tsx:125`); `QuickActions` external WA link has `target`+`rel` (`QuickActions.tsx:72`); internal `?view=saved` href keeps existing route (`:29`); `value.toLocaleString('id-ID')` (`ParticipantStats`, `:158`). |
| 5a | Leaderboard: unpublished states show status text, not error box | `error={unpublished ? null : leaderboard.error}` (`ParticipantLeaderboard.tsx:28`) suppresses the error box; status paragraph `role="status"` (`:29`) covers both `WEEK_NOT_FOUND`/`WEEK_NOT_FINALIZED` (`:15`). |
| 5b | Leaderboard: table has `<caption>` | `<caption className="sr-only">Peringkat {leaderboard.data.weekCode}</caption>` (`:34`). |
| 5c | Leaderboard: `min-w-[540px]` scrolls without breaking page | Table `min-w-[540px]` (`:33`) inside `overflow-x-auto` wrapper (`:32`); page shell is `min-w-0 [overflow-wrap:anywhere]` (`ParticipantDashboard.tsx:49,263`); `th scope="col"` present (`:35`). |
| 6a | SprintHero/StatStrip: no leftover English copy | Statuses (`SprintHero.tsx:11-18`), `STEP_SHORT` product terms (`dashboard-view.ts:15-21`), hero/tiles/buttons all Indonesian; `brief`/`project` are product terms used consistently for routes/pages (one `proyek`/`project` spelling inconsistency filed as BUG-1, minor). |
| 6b | SprintHero/StatStrip: numbers use `id-ID` formatting | `CountUp` renders `shown.toLocaleString('id-ID')` + sr-only real value (`CountUp.tsx:41-42`); caption `lifetimeEarned.toLocaleString('id-ID')` (`StatStrip.tsx:78`); stats same (`ParticipantDashboard.tsx:158`). |
| 6c | Motion/loading: reduced-motion respected, no stale-data issue | `CountUp` short-circuits on `reduce` (`CountUp.tsx:22-25`) via `useSettledReducedMotion` (`Reveal.tsx:46-53`); `ProgressRing` disables transition under reduce (`ProgressRing.tsx:68`); spinner `motion-reduce:animate-none` (`ParticipantDashboard.tsx:108`); stale data handled at dashboard level (4e). |
| 7a | Cross-surface: every `appNavLinks`/`bottomNavLinks` href matches a real route | `/app/arena`→`app/arena/page.tsx`, `/projects`→`app/arena/projects/page.tsx`, `/my-projects`→`app/arena/my-projects/page.tsx`, `/leaderboard`→`app/arena/leaderboard/page.tsx`, `/app/profile`(+`#rewards`)→`app/profile/page.tsx`; `TOOLS` sanctioned, not flagged. |
| 7b | Cross-surface: external URLs open in new tab with `rel` | `NavAnchor` renders external as `<a target="_blank" rel="noopener noreferrer">` + sr-only new-tab hint (`NavPromo.tsx:70-84`); sidebar WA link (`AppSidebar.tsx:75-79`), footer WA link (`Footer.tsx:70-74`), floating WA link (`FloatingWhatsApp.tsx:5-9`), `QuickActions` external (`QuickActions.tsx:72`) all carry `target="_blank" rel="noopener noreferrer"`. |
