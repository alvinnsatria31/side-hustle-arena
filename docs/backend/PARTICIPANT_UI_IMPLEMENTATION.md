# Participant UI Implementation

Updated: 2026-09-05 (wiring pass: history-aware enrollment, live CTA, slug deep links)

## Completed Implementation

- Replaced demo dashboard, Arena home, and profile routes with live participant components using the existing server-provided participant identity.
- Added authenticated, no-store GET `/api/arena/me`: owned enrollment history joined with projects, divisions, weeks, workspace, submission state, finalized rankings, ledger aggregates, finalized ranking-linked skill evidence, and redemption history.
- Available points sum ledger amounts. Lifetime earned counts positive awards/adjustments excluding reversals and redemption refunds. No point-account cache is used.
- Added weekly leaderboard with a historical selector sourced from enrollment history and an explicit unpublished state.
- Added inbox consuming `items.type`, `items.actionUrl`, and `unread`, with unread filtering, incremental loading up to the API's 100-item limit, individual/all mark-read actions, and local action URL validation.
- Profile consumes the existing milestone ladder/take endpoints, disables duplicate claims, refreshes points and redemption history after claim attempts, and uses native POST `/auth/logout`.
- Result/workspace/submission pages resolve enrollment via `getMyEnrollmentForProject` (`src/lib/arena-client.ts`): current endpoint first, `/api/arena/me` history fallback, 401 propagates for signed-out state.
- Public project CTA (`CtaActions`) uses live `getCurrentEnrollment()` for the enrolled label; `DemoProvider` is no longer read. Anonymous behavior unchanged.
- Inbox deep links (submit + finalize) use canonical project slugs.
- Preserved existing design tokens and arrow-free command labels. No AppNavbar, AppChrome, layout, arena-client, or reward-service edits. (Correction: AppNavbar itself was edited earlier to native logout — `src/components/layout/AppNavbar.tsx:124`.)

## Verification

- Read repository AGENTS.md and bundled Next route-handler, server/client component, and data-fetching guides before implementation.
- Wiring pass: `typecheck` clean, `lint` clean, production `build` clean. Browser verification of populated screens still pending.
- No deployment or live database mutations authorized or performed (dev-DB test fixtures and migration 0007 excepted).

## Pending

- Run checks and fix issues within owned files.
- Verify responsive loading/error/empty/populated screens and mocked mutations without live database writes.
- Confirm compatibility with the concurrent reward worker's final ledger/refund contract.
- No deployment or live database mutations authorized or performed.
