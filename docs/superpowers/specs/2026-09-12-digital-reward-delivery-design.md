# Digital reward delivery by email

**Date:** 2026-09-12
**Commit:** `44c85f2`
**Scope:** Arena rewards. The owner asked for digital rewards to be delivered by email automatically, which is why this touches the rewards area.

## Problem

A `DIGITAL` reward is a page the participant opens — the Notion job-hunt kit, later the e-book. Before this change every claim of one sat in the admin queue until a human pasted a link into the fulfilment note, and the participant only learned about it by opening their profile. The reward existed; the handover did not.

## Shape

Claiming a digital reward now serves it, following the pattern voucher delivery already established:

1. `claimRedemption` commits the claim (points debited, stock reserved).
2. `deliverDigitalReward` takes the same PROCESSING lease voucher delivery uses, so an admin reversal cannot refund points underneath a fulfilment in flight.
3. It fulfils the claim with a note carrying the link, so the profile shows it.
4. `fulfillRedemption` notifies `REWARD_FULFILLED` with the link as the action URL, which queues an email.
5. `takeMilestone` flushes the outbox immediately, so the email leaves in seconds rather than waiting for the next `email-flush` tick.

The note and the email are two copies of one fact. A lost email costs a resend, never the reward.

## Decisions

- **The link lives on the SKU** (`rewards.catalog.delivery_url`, migration `0016`), not in an environment variable: an admin sets it on the Reward page with an audited reason, and it is visible where the reward is managed.
- **An unset link is not an error.** The claim stays PENDING, `REWARD_DIGITAL_DELIVERY_DEFERRED` is audited, and the admin queue holds it, exactly like an unconfigured voucher push. Nobody is served an address nobody checked.
- **Emails link only to allowlisted hosts.** `emailContent` still refuses arbitrary absolute URLs; `ARENA_EMAIL_LINK_HOSTS` (default `notion.site`, `notion.so`, `sekolahkarir.id`) names the exceptions. Anything else still reaches the participant as plain text.
- **Delivery routes by reward kind** in `takeMilestone`: voucher first, then digital, then null. A reward that nobody can deliver automatically (a service, a cash payout) still lands in the admin queue.

## Failure modes

| Situation | Result |
|---|---|
| Link not set | Claim PENDING, audited deferral, admin queue |
| Fulfilment fails mid-delivery | Lease released, audited deferral, claim stays claimable by hand |
| Claim reversed while delivering | Lease refuses the reversal until delivery finishes or its lease lapses |
| Participant has no email on file | Outbox marks the delivery SKIPPED (`NO_EMAIL_ON_FILE`); the profile note still carries the link |
| Resend unavailable | Message stays queued; the scheduler retries on its backoff ladder |
| Delivered twice | Second call returns `ALREADY_SETTLED`; one fulfilment, one notification |

## Tests

`scripts/reward-accounting.test.mjs` runs the real services against the in-memory database: a served claim (status, profile note, the emailed action URL, one queued email, repeat delivery), an unconfigured link, and a non-digital reward. `scripts/notification-email.test.mjs` covers the link allowlist, including https-only, credentials in the URL, and a host that merely ends with an allowed one.

## Rollout

1. Migration `0016` — **applied in production on 2026-09-12**, verified on `sk-arena-db`.
2. Ship the image and restart `sk-arena`. Blocked for the agent by the permission classifier; the owner runs it (see `docs/backend/LIVE_SETUP_GUIDE.md`).
3. Set the link on `/app/admin/rewards` once the Notion page is published with "Allow duplicate as template".

## Verification after deploy

The check that matters is one real claim, because it exercises the claim, the fulfilment, the notification and the sender together:

1. Set `notion-kit`'s delivery link in the admin page.
2. Create a test participant on `sk-arena-db` with an email the owner can read and enough points (`rewards.point_ledger`, 300+).
3. Mint an `sk_participant` cookie inside the `sk-arena` container (the session secret never leaves it) and `POST /api/arena/milestones/take` with `{"slug":"notion-kit"}`.
4. Expect: `delivery.status = DELIVERED`, the redemption `FULFILLED` with the link in `fulfillment_reference`, a `REWARD_FULFILLED` event whose `action_url` is the link, and its EMAIL delivery `SENT` with a Resend receipt.
5. Reverse the claim and remove the test rows.
