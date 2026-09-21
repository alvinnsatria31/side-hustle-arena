# Dashboard Nav A-Premium + Leaderboard Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved A-premium nav polish plus a Leaderboard General Preview on Ringkasan, with zero regressions.

**Architecture:** Presentational changes only plus two pure helpers. No new routes, no new endpoints, no schema changes. `nav-links.ts` stays the single source of navigation truth.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, lucide-react, node:test offline suites (`scripts/*.test.mjs`, auto-discovered by `scripts/run-offline-tests.mjs`), `tsc --noEmit`, `eslint`.

**Spec:** `docs/superpowers/specs/2026-09-21-dashboard-nav-leaderboard-design.md`

**Spec deviation (approved logic, corrected mechanism):** the spec says "row-ku (highlight)". `LeaderboardEntry` (`src/lib/arena-client.ts:244-253`) carries no stable user key (only `displayName`/`avatarId`), so matching my row inside leaderboard rows would be guesswork. Instead the "Kamu" strip reads my rank/score from `ParticipantOverview.history` for the same `weekCode` (fields already used by `ParticipantLeaderboard.tsx:14` and `dashboard-view.ts:bestRanking`). Same UX, honest data.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/components/layout/nav-links.ts` | Modify | Add optional `section: 'arena' \| 'lainnya'` to `NavLink` + `APP_ALL` entries. Labels/hrefs/icons unchanged. |
| `src/components/layout/AppSidebar.tsx` | Modify | Render two groups (Ruang kerja / Lainnya) + user-card footer. |
| `src/components/layout/AppNavbar.tsx` | Modify | Class-only slim polish. Behavior unchanged. |
| `src/components/layout/MobileBottomNav.tsx` | Modify | Class-only polish. Behavior unchanged. |
| `src/lib/dashboard-view.ts` | Modify | Add pure `myWeekRanking(history, weekCode)` helper. |
| `src/components/arena/dashboard/LeaderboardPreview.tsx` | Create | Preview card + skeleton. Self-contained fetch via existing clients. |
| `src/components/arena/ParticipantDashboard.tsx` | Modify | Render `<LeaderboardPreview history={data.history} />` after `<StatStrip>`. |
| `scripts/arena-dashboard-navigation.test.mjs` | Modify | Extend: grouping assertions. |
| `scripts/arena-leaderboard-preview.test.mjs` | Create | Offline tests for `myWeekRanking`. |
| `docs/superpowers/specs/2026-09-21-dashboard-ui-audit.md` | Create (Phase 0) | UI bug audit report with `file:line` evidence. |

**Never touch:** `src/app/(app)/app/admin/**`, `e2e/*`, landing files, `LiveArenaBoard`, CV Scanner / Jobs / Store / Career Report code. The working tree already has unrelated dirty landing files — verify with `git status --short` before every commit and stage only the files listed in that task.

---

## Phase 0 — UI bug audit (read-only, no code changes)

### Task 0: Audit dashboard surfaces end-to-end (static)

- [ ] **Step 1: Audit each surface against the checklist, file by file**

Checklist (every item gets pass/fail + `file:line` evidence):
1. `src/components/layout/AppSidebar.tsx` — active state reachable for every `appNavLinks()` href via `isNavActive`; promo pill appears at most once; touch target ≥44px (`min-h-11`); focus-visible ring present; no dead href.
2. `src/components/layout/AppNavbar.tsx` — desktop dropdown contains zero nav links (slim rule); mobile dropdown contains all `appNavLinks()`; bell `aria-label` includes unread count; Escape closes menu; admin link only when `isAdmin`.
3. `src/components/layout/MobileBottomNav.tsx` — tab count ≤5; active pill + label both reflect `isNavActive`; labels don't truncate at 360px width (check `truncate` + `max-w-full` combo); `safe-bottom` padding present.
4. `src/components/arena/ParticipantDashboard.tsx` — `StatStrip` tile hrefs all resolve (profile#rewards, my-projects, career-report, leaderboard); `SectionHead` links resolve; empty states have working `action.href`; stale-while-refresh keeps old data (`opacity-60`, no collapse to spinner).
5. `src/components/arena/ParticipantLeaderboard.tsx` — unpublished states (`WEEK_NOT_FOUND`, `WEEK_NOT_FINALIZED`) show status text, not an error box; table has `<caption>`; `min-w-[540px]` scrolls horizontally on 390px without breaking page layout.
6. `src/components/arena/dashboard/SprintHero.tsx`, `StatStrip.tsx` — Indonesian copy has no leftover English; numbers use `id-ID` formatting; `CountUp` respects `motion-reduce` (check `CountUp.tsx`).
7. Cross-surface: every `href` in `nav-links.ts` (`appNavLinks`, `bottomNavLinks`) matches a real route file under `src/app/(app)/app/**`; every external URL opens in a new tab with `rel="noopener noreferrer"` (check `NavAnchor` in `src/components/layout/NavPromo.tsx`).

- [ ] **Step 2: Write the audit report**

Create `docs/superpowers/specs/2026-09-21-dashboard-ui-audit.md` with this exact shape per finding:

```markdown
## [BUG-1] Title
- **Severity:** blocker | major | minor
- **Where:** `src/path/file.tsx:123`
- **Evidence:** what the code does vs what it should do (quote both lines)
- **Fix:** one-sentence fix direction (no code)
- **Status:** accepted | rejected (owner decides)
```

Severity rules: blocker = wrong navigation target, crash, data loss, auth leak. Major = visible on common viewports, broken a11y on primary flow. Minor = polish, copy, edge viewport.

- [ ] **Step 3: Commit the audit report only**

```bash
git status --short
git add docs/superpowers/specs/2026-09-21-dashboard-ui-audit.md
git commit -m "docs(audit): dashboard UI bug audit with evidence"
```

Expected: commit contains exactly 1 file. Then owner marks each finding accepted/rejected. Each **accepted** finding becomes a fix task following the Task 3 pattern (modify → typecheck+lint+related offline test → commit). Rejected findings are closed in the report, no code.

---

## Phase 1 — Pure logic (TDD)

### Task 1: Sidebar grouping metadata in nav-links.ts

**Files:**
- Modify: `src/components/layout/nav-links.ts:29-42` (interface), `src/components/layout/nav-links.ts:90-97` (APP_ALL)
- Test: `scripts/arena-dashboard-navigation.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/arena-dashboard-navigation.test.mjs`:

```js
test('sidebar groups arena links above secondary links', () => {
  const links = appNavLinks();
  const arena = links.filter((l) => l.section !== 'lainnya');
  const secondary = links.filter((l) => l.section === 'lainnya');
  assert.deepEqual(arena.map(({ label }) => label), [
    'Ringkasan',
    'Jelajahi proyek',
    'Proyekku',
    'Peringkat',
  ]);
  assert.deepEqual(secondary.map(({ label }) => label), ['Poin & hadiah', 'Tools']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/arena-dashboard-navigation.test.mjs`
Expected: FAIL — `l.section` is undefined so `secondary` is empty.

- [ ] **Step 3: Minimal implementation**

In `src/components/layout/nav-links.ts`, extend the interface (after line 41 `highlight?: boolean;`):

```ts
/** Sidebar grouping. Links without a section render in the main group. */
section?: 'arena' | 'lainnya';
```

And set sections on `APP_ALL`:

```ts
const APP_ALL: NavLink[] = [
  { label: 'Ringkasan', href: '/app/arena', icon: Home, section: 'arena' },
  { label: 'Jelajahi proyek', href: '/app/arena/projects', icon: LayoutGrid, section: 'arena' },
  { label: 'Proyekku', href: '/app/arena/my-projects', icon: FolderOpen, section: 'arena' },
  { label: 'Peringkat', href: '/app/arena/leaderboard', icon: Trophy, section: 'arena' },
  { label: 'Poin & hadiah', href: '/app/profile#rewards', icon: Gift, section: 'lainnya' },
  { ...TOOLS, section: 'lainnya' },
];
```

`TOOLS` is a shared const also used in `PUBLIC_ALL`/`BOTTOM_ALL` — spread (`{ ...TOOLS, section: 'lainnya' }`) so the public and bottom lists are untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/arena-dashboard-navigation.test.mjs`
Expected: PASS, 3/3 tests (the 2 pre-existing tests must still pass unchanged).

- [ ] **Step 5: Commit**

```bash
git status --short
git add src/components/layout/nav-links.ts scripts/arena-dashboard-navigation.test.mjs
git commit -m "feat(nav): group participant sidebar links into arena and secondary sections"
```

### Task 2: myWeekRanking helper + offline tests

**Files:**
- Modify: `src/lib/dashboard-view.ts` (append helper)
- Test: create `scripts/arena-leaderboard-preview.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/arena-leaderboard-preview.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

const { myWeekRanking } = await import('../src/lib/dashboard-view.ts');

const history = [
  { week: { weekCode: 'W12' }, ranking: { rank: 7, finalScore: 82 } },
  { week: { weekCode: 'W11' }, ranking: { rank: 2, finalScore: 91 } },
  { week: { weekCode: 'W10' }, ranking: null },
];

test('returns my rank and score for the requested week', () => {
  assert.deepEqual(myWeekRanking(history, 'W12'), { rank: 7, finalScore: 82 });
});

test('returns null when the week has no ranking', () => {
  assert.equal(myWeekRanking(history, 'W10'), null);
  assert.equal(myWeekRanking(history, 'W09'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/arena-leaderboard-preview.test.mjs`
Expected: FAIL with "myWeekRanking is not a function" (import succeeds, export missing). If the import itself fails, the hook setup is broken — stop and report, do not proceed.

- [ ] **Step 3: Minimal implementation**

Append to `src/lib/dashboard-view.ts`:

```ts
/**
 * My placing for one week, read from overview history.
 *
 * Leaderboard rows carry no user key, so the preview never guesses which row
 * is mine — the "Kamu" strip comes from here instead.
 */
export function myWeekRanking(
  history: Array<{
    week: { weekCode: string };
    ranking: { rank: number; finalScore: number } | null | undefined;
  }>,
  weekCode: string,
): { rank: number; finalScore: number } | null {
  const row = history.find((entry) => entry.week.weekCode === weekCode);
  if (!row?.ranking) return null;
  return { rank: row.ranking.rank, finalScore: row.ranking.finalScore };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/arena-leaderboard-preview.test.mjs`
Expected: PASS, 2/2. Then run the full offline suite later in Task 7 (this file is auto-discovered, no registration needed).

- [ ] **Step 5: Commit**

```bash
git status --short
git add src/lib/dashboard-view.ts scripts/arena-leaderboard-preview.test.mjs
git commit -m "feat(dashboard): add myWeekRanking helper for leaderboard preview"
```

---

## Phase 2 — Components

Verification rule for TSX tasks (no component test infra exists): `npm run typecheck` + `npm run lint` must pass, the related offline test must still pass, and the diff must touch only the task's files. Browser check is conditional on a running dev DB; if unavailable, say so in the commit message body as `Verified: typecheck+lint+offline (no live browser)`.

### Task 3: AppSidebar grouped sections + user card footer

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Replace the flat nav with two groups**

Replace the `<nav aria-label="Navigasi Arena" className="space-y-1">…</nav>` block (`AppSidebar.tsx:40-66`) with:

```tsx
<nav aria-label="Navigasi Arena" className="space-y-6">
  <div>
    <p className="mb-3 mt-11 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.17em] text-[#7d9abf]">
      Ruang kerja
    </p>
    <div className="space-y-1">
      {appNavLinks()
        .filter((link) => link.section !== 'lainnya')
        .map((link) => (
          <SidebarLink key={link.href} link={link} pathname={pathname} />
        ))}
    </div>
  </div>
  <div>
    <p className="mb-3 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.17em] text-[#7d9abf]">
      Lainnya
    </p>
    <div className="space-y-1">
      {appNavLinks()
        .filter((link) => link.section === 'lainnya')
        .map((link) => (
          <SidebarLink key={link.href} link={link} pathname={pathname} />
        ))}
    </div>
  </div>
</nav>
```

Extract the existing `NavAnchor` rendering (`AppSidebar.tsx:44-65`) verbatim into a `SidebarLink` component in the same file:

```tsx
import type { NavLink } from '@/components/layout/nav-links';

function SidebarLink({ link, pathname }: { link: NavLink; pathname: string }) {
  const Icon = link.icon;
  const active = isNavActive(link.href, pathname);
  return (
    <NavAnchor
      link={link}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        link.highlight
          ? cn('duration-200', PROMO_PILL)
          : 'text-[#b9cbe3] hover:bg-white/10 hover:text-white',
        !link.highlight &&
          active &&
          'bg-[#2a6bea] text-white shadow-[0_8px_22px_rgba(12,69,157,0.28)] hover:bg-[#2a6bea]',
      )}
    >
      <Icon size={18} strokeWidth={active || link.highlight ? 2.3 : 2} aria-hidden />
      {link.label}
      {link.highlight && <NewBadge className="ml-auto" />}
      {link.external && <ExternalMark />}
    </NavAnchor>
  );
}
```

Class strings are copied byte-for-byte from the current file — no visual change to rows, only grouping. `NavLink` is exported as an interface from `nav-links.ts:29` (verified).

- [ ] **Step 2: Replace the footer links with a user card**

Add imports (verified against `AppNavbar.tsx:9-12` usage):

```tsx
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { useParticipant } from '@/features/arena/participant';
```

Inside `AppSidebar`, after `const pathname = usePathname();` add:

```tsx
const user = useParticipant();
const name = user.displayName ?? 'Peserta';
```

Replace the footer `<div className="mt-auto space-y-1 border-t border-white/10 pt-5">…</div>` (`AppSidebar.tsx:68-83`) with:

```tsx
<div className="mt-auto border-t border-white/10 pt-5">
  <div className="flex items-center gap-2.5 px-3 py-2">
    {user.avatarId ? (
      <AvatarBadge avatarId={user.avatarId} size="sm" />
    ) : (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[14px] font-bold text-white">
        {name.slice(0, 1).toUpperCase()}
      </span>
    )}
    <div className="min-w-0">
      <p className="truncate text-[13px] font-bold text-white">{name}</p>
      <p className="truncate font-mono text-[10.5px] text-[#7d9abf]">{user.email}</p>
    </div>
  </div>
  <div className="mt-1 space-y-1">
    <Link
      href="/app/profile"
      className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#b9cbe3] transition-colors hover:bg-white/10 hover:text-white"
    >
      <UserRound size={18} aria-hidden /> Profil
    </Link>
    <a
      href={WHATSAPP_SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#b9cbe3] transition-colors hover:bg-white/10 hover:text-white"
    >
      <CircleHelp size={18} aria-hidden /> Bantuan
    </a>
  </div>
</div>
```

`user.email` and `user.displayName` are used identically in `AppNavbar.tsx:77,140` — both exist on the participant object. `AvatarBadge` with `size="sm"` and no `className` renders its default size (used identically in `AppNavbar.tsx:141`).

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx eslint src/components/layout/AppSidebar.tsx src/components/layout/nav-links.ts`
Expected: no errors.
Run: `node --test scripts/arena-dashboard-navigation.test.mjs`
Expected: PASS 3/3.

- [ ] **Step 4: Commit**

```bash
git status --short
git add src/components/layout/AppSidebar.tsx
git commit -m "feat(nav): group sidebar sections and add user card footer"
```

### Task 4: AppNavbar slim polish (classes only)

**Files:**
- Modify: `src/components/layout/AppNavbar.tsx`

- [ ] **Step 1: Apply the polish edits (no behavior change)**

1. Header (`AppNavbar.tsx:80`): change `bg-white/90` to `bg-white/85`, add `shadow-[0_1px_12px_rgba(16,37,68,0.06)]`. Keep `sticky top-0 z-40 border-b border-sk-border backdrop-blur-md`.
2. Breadcrumb (`AppNavbar.tsx:86-88`): keep as-is (already the slim context bar).
3. Bell button (`AppNavbar.tsx:91-104`): keep logic; badge class unchanged.
4. Dropdown container (`AppNavbar.tsx:131-135`): change `rounded-[var(--radius-sk-lg)]` to `rounded-[var(--radius-sk-xl)]`, `shadow-sk-lg` stays. Keep `fixed right-4 top-16 z-50 w-60`.
5. Do NOT touch: polling effect, menu open/close logic, `links` mobile-only block, admin/profile/logout items.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx eslint src/components/layout/AppNavbar.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git status --short
git add src/components/layout/AppNavbar.tsx
git commit -m "style(nav): slim premium polish for app topbar"
```

### Task 5: MobileBottomNav polish (classes only)

**Files:**
- Modify: `src/components/layout/MobileBottomNav.tsx`

- [ ] **Step 1: Apply the polish edits (no behavior change)**

1. Nav (`MobileBottomNav.tsx:30-34`): keep `fixed inset-x-0 bottom-0 z-40`, background `rgba(255,255,255,0.95)`; add `shadow-[0_-4px_20px_rgba(16,37,68,0.08)]`.
2. Link (`MobileBottomNav.tsx:41-51`): keep all classes and `aria-current`; add `active:translate-y-0` nothing — do not add press animations (keep `transition-colors` only).
3. Do NOT touch: `COLS` mapping, `bottomNavLinks()` call, empty-list early return.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx eslint src/components/layout/MobileBottomNav.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git status --short
git add src/components/layout/MobileBottomNav.tsx
git commit -m "style(nav): premium shadow polish for mobile bottom nav"
```

### Task 6: LeaderboardPreview component + dashboard wiring

**Files:**
- Create: `src/components/arena/dashboard/LeaderboardPreview.tsx`
- Modify: `src/components/arena/ParticipantDashboard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/arena/dashboard/LeaderboardPreview.tsx` with this exact content (all imports verified against existing usage: `useParticipantResource` from `@/lib/participant-client` per `ParticipantDashboard.tsx:10-14`; `ArenaApiError, getLeaderboard` from `@/lib/arena-client` per `ParticipantLeaderboard.tsx:4`; `AvatarBadge` from `../AvatarBadge` per `ParticipantLeaderboard.tsx:6`; `myWeekRanking` from `@/lib/dashboard-view`; `Trophy, ArrowRight, RefreshCw` from `lucide-react`; `Link` from `next/link`):

```tsx
'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { ArrowRight, RefreshCw, Trophy } from 'lucide-react';
import { AvatarBadge } from '../AvatarBadge';
import { ArenaApiError, getLeaderboard } from '@/lib/arena-client';
import { useParticipantResource, type ParticipantOverview } from '@/lib/participant-client';
import { myWeekRanking } from '@/lib/dashboard-view';

/**
 * Compact leaderboard spotlight for the Ringkasan dashboard.
 *
 * Shows the top 3 of the latest finalized week plus a "Kamu" strip read from
 * overview history (leaderboard rows carry no user key, so the strip never
 * guesses which row is mine). Placed after StatStrip: Hero → Stat →
 * Leaderboard → Explore.
 */
export function LeaderboardPreview({ history }: { history: ParticipantOverview['history'] }) {
  const loader = useCallback(() => getLeaderboard(undefined), []);
  const board = useParticipantResource(loader);
  const unpublished =
    board.error instanceof ArenaApiError &&
    ['WEEK_NOT_FOUND', 'WEEK_NOT_FINALIZED'].includes(board.error.code);

  if (board.loading && !board.data) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="mt-10" aria-busy="true">
        <p className="eyebrow">Papan peringkat</p>
        <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        <ul className="mt-5 space-y-3" aria-label="Memuat peringkat">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-4">
              <span className="h-5 w-8 animate-pulse rounded bg-sk-bg" />
              <span className="h-9 w-9 animate-pulse rounded-full bg-sk-bg" />
              <span className="h-4 flex-1 animate-pulse rounded bg-sk-bg" />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (board.error && !unpublished) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="mt-10">
        <p className="eyebrow">Papan peringkat</p>
        <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        <div role="alert" className="mt-5 flex flex-wrap items-center gap-4 rounded-[var(--radius-sk-xl)] border border-sk-error-border bg-sk-error-wash p-5">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-sk-error">
            Peringkat gagal dimuat.
          </p>
          <button
            onClick={() => void board.refresh()}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold text-sk-error"
          >
            <RefreshCw size={14} aria-hidden /> Coba lagi
          </button>
        </div>
      </section>
    );
  }

  if (unpublished || !board.data || board.data.rows.length === 0) {
    return (
      <section aria-labelledby="leaderboard-preview-title" className="mt-10">
        <p className="eyebrow">Papan peringkat</p>
        <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
          Peringkat minggu ini
        </h2>
        <div className="mt-5 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-sk-navy">
            <Trophy size={15} aria-hidden /> Peringkat minggu ini belum diumumkan.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-sk-muted">
            Fokus selesaikan kirimanmu dulu — begitu final, posisimu muncul di sini.
          </p>
          <Link
            href="/app/arena/leaderboard"
            className="mt-3 inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
          >
            Lihat halaman peringkat <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  const weekCode = board.data.weekCode;
  const top = board.data.rows.slice(0, 3);
  const me = myWeekRanking(history, weekCode);
  const gap = me ? board.data.rows[0].finalScore - me.finalScore : null;

  return (
    <section aria-labelledby="leaderboard-preview-title" className="mt-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Papan peringkat · {weekCode}</p>
          <h2 id="leaderboard-preview-title" className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
            Peringkat minggu ini
          </h2>
        </div>
        <Link
          href="/app/arena/leaderboard"
          className="inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
        >
          Lihat lengkap <ArrowRight size={15} aria-hidden />
        </Link>
      </div>
      <ol className="space-y-3">
        {top.map((row) => (
          <li
            key={row.rank}
            className="flex min-h-[56px] items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white px-4 py-3"
          >
            <span className="w-8 shrink-0 font-mono text-[15px] font-bold tabular-nums text-sk-navy">
              #{row.rank}
            </span>
            <AvatarBadge avatarId={row.avatarId} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold text-sk-navy">
                {row.displayName}
              </span>
              <span className="block truncate text-[11.5px] text-sk-muted">{row.projectTitle}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-[15px] font-bold tabular-nums text-sk-navy">
                {row.finalScore}
              </span>
              <span className="block font-mono text-[11px] font-semibold tabular-nums text-sk-success">
                +{row.pointsAwarded}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <div
        className="mt-3 flex min-h-[56px] items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-blue/30 bg-sk-blue-tint px-4 py-3"
        aria-label={me ? `Peringkat kamu ${me.rank}` : 'Kamu belum masuk peringkat'}
      >
        <span className="w-8 shrink-0 font-mono text-[15px] font-bold tabular-nums text-sk-blue-700">
          {me ? `#${me.rank}` : '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-sk-navy">Kamu</span>
          <span className="block truncate text-[11.5px] text-sk-muted">
            {me
              ? gap !== null && gap > 0
                ? `skor ${me.finalScore} · selisih ${gap} dari #1`
                : `skor ${me.finalScore} · kamu memimpin!`
              : 'selesaikan satu sprint dulu'}
          </span>
        </span>
      </div>
    </section>
  );
}
```

Notes the worker must not "improve": `eyebrow` class is used in `ParticipantDashboard.tsx:214`; `sk-blue-tint`, `sk-error-wash`, `sk-error-border`, radius vars are used across dashboard files; `useParticipantResource` returns `{ data, loading, error, refresh }` (verified in `ParticipantLeaderboard.tsx:11-16`); `getLeaderboard(undefined)` matches the `week || undefined` latest-finalized call in `ParticipantLeaderboard.tsx:11`.

- [ ] **Step 2: Wire into the dashboard**

In `src/components/arena/ParticipantDashboard.tsx`:
1. Add import (after the `StatStrip` import at line 23): `import { LeaderboardPreview } from '@/components/arena/dashboard/LeaderboardPreview';`
2. After `<StatStrip data={data} />` (line 282), insert on its own line with matching indentation: `<LeaderboardPreview history={data.history} />`

`data.history` is `ParticipantOverview['history']` (used at line 257, 260) — matches the prop type exactly.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.
Run: `npx eslint src/components/arena/dashboard/LeaderboardPreview.tsx src/components/arena/ParticipantDashboard.tsx`
Expected: no errors.
Run: `node --test scripts/arena-leaderboard-preview.test.mjs scripts/arena-dashboard-navigation.test.mjs scripts/arena-dashboard-focus.test.mjs`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git status --short
git add src/components/arena/dashboard/LeaderboardPreview.tsx src/components/arena/ParticipantDashboard.tsx
git commit -m "feat(dashboard): add leaderboard general preview to Ringkasan"
```

---

## Phase 3 — Full verification (zero-mistake gate)

### Task 7: Offline suite + typecheck + lint + diff audit

- [ ] **Step 1: Run the full offline suite**

Run: `npm run test:offline`
Expected: all suites pass; no new skips. If any suite fails, stop — check whether it fails on the base commit too (`git stash` the task files is forbidden; instead `git status` to confirm the failing suite's files are untouched by this plan, then report).

- [ ] **Step 2: Run typecheck and lint**

Run: `npm run typecheck`
Expected: clean.
Run: `npm run lint`
Expected: clean (pre-existing warnings outside touched files are reported, not fixed).

- [ ] **Step 3: Diff audit — prove nothing else changed**

Run: `git log --oneline -8` and `git show --stat HEAD~5..HEAD` (adjust range to this plan's commits)
Expected: every commit touches only its task's files; no admin, landing, e2e, CV/Jobs/Store/Report files appear.

- [ ] **Step 4: Conditional browser pass**

Only if a dev database is reachable: `npm run dev`, then manually verify at 390px / 768px / 1280px on `/app/arena`: sidebar groups render, preview card renders top-3 + Kamu strip, bottom nav has 5 tabs. If the DB is unreachable, record `Verified: typecheck+lint+offline (no live browser)` and stop — do not fake it with screenshots of other pages.

---

## Phase 4 — Accepted audit fixes

Each finding the owner marked **accepted** in `2026-09-21-dashboard-ui-audit.md` becomes Task 8+n:
1. Modify only the finding's file.
2. If logic changed, extend the relevant offline test first (TDD, Task 1/2 pattern).
3. Verify: `npm run typecheck` + `npx eslint <file>` + related offline suite.
4. Commit: `fix(dashboard): <finding title>` + set finding Status to fixed in the audit report (same commit).

---

## Self-review

1. **Spec coverage:** nav grouping (§4) → Tasks 1+3. Topbar slim (§5) → Task 4. Bottom nav (§6) → Task 5. Leaderboard preview (§7) → Tasks 2+6 (position after StatStrip, top-3, Kamu strip, unpublished/empty/loading/error states, no endpoint). Content/motion (§8) → untouched, verified in Task 7. Data/edge (§9) → Task 2 helper + `enabled()` untouched. Testing (§10) → Task 7. Out of scope (§11) → File map "Never touch" + per-task do-not-touch notes.
2. **Placeholder scan:** no TBD/TODO; every code step shows complete code with exact paths; every run step states the command and expected output; no "similar to Task N".
3. **Type consistency:** `myWeekRanking` signature in Task 2 matches its import and call in Task 6 (`history: ParticipantOverview['history']` is assignable — history rows carry `week.weekCode` and `ranking` per `ParticipantLeaderboard.tsx:14` and `bestRanking` usage; `row.ranking` may be null, covered by `| null | undefined`). `SidebarLink` prop type `NavLink` imported from the same module that exports the interface. `AvatarBadge avatarId` accepts `string | null` (passed possibly-null in both navbar and preview, same as existing `ParticipantLeaderboard.tsx:36` which passes `row.avatarId` directly).
