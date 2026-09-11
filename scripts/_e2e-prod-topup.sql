-- Production E2E: audited top-up so the redemption step can be exercised
-- through the real Profile UI.
--
-- The tester is the only finalist in an isolated test week, so their earned
-- points are exactly score + first-place bonus (real numbers, not invented).
-- That total can land short of the cheapest reward (300 pts). This adds the
-- difference as ADMIN_ADJUSTMENT — the ledger entry type for manual
-- corrections — so the claim button in the UI is reachable. _e2e-prod-cleanup.sql
-- zeroes the account afterwards regardless of outcome.
--
-- Plain SQL on purpose: psql does not substitute :variables inside a DO $$ block.
-- Usage: psql ... -v target=300
\set ON_ERROR_STOP on
\if :{?target}
\else
  \set target 300
\endif
begin;

create temp table e2e on commit drop as
select u.id as user_id from identity.users u where u.auth_subject = 'sk-participant:e2e-prod-tester-20260911';

select pg_advisory_xact_lock(hashtext('e2e-prod-cleanup'));
select 1 from rewards.point_accounts where user_id = (select user_id from e2e) for update;

create temp table e2e_gap on commit drop as
select :target - coalesce(sum(amount) filter (
         where not (entry_type = 'REWARD_REDEMPTION' or (entry_type = 'ADMIN_REVERSAL' and reference_type = 'redemption'))), 0) as gap
from rewards.point_ledger where user_id = (select user_id from e2e);

insert into rewards.point_ledger (user_id, amount, entry_type, reference_type, reference_id, description, idempotency_key)
select (select user_id from e2e), gap, 'ADMIN_ADJUSTMENT', 'e2e', 'E2E-PROD-20260911',
       'E2E verification top-up: reach the cheapest reward threshold to exercise the real redemption UI. Reversed by cleanup.',
       'e2e-prod-20260911:topup'
from e2e_gap where gap > 0
on conflict (idempotency_key) do nothing;

insert into audit.logs (actor_type, actor_subject, action, entity_type, entity_id, metadata)
select 'SYSTEM', 'maintenance:owner-request', 'POINT_ADJUSTMENT', 'user', (select user_id from e2e)::text,
       jsonb_build_object('amount', gap, 'reason', 'E2E verification top-up', 'target', :target)
from e2e_gap where gap > 0;

-- Same arithmetic as accounting.summarizePoints.
update rewards.point_accounts a set
  balance = greatest(0, t.balance), lifetime_earned = greatest(0, t.earned), lifetime_spent = greatest(0, t.spent), updated_at = now()
from (
  select sum(amount) as balance,
         sum(case when entry_type = 'REWARD_REDEMPTION' or (entry_type = 'ADMIN_REVERSAL' and reference_type = 'redemption') then 0 else amount end) as earned,
         -sum(case when entry_type = 'REWARD_REDEMPTION' or (entry_type = 'ADMIN_REVERSAL' and reference_type = 'redemption') then amount else 0 end) as spent
  from rewards.point_ledger where user_id = (select user_id from e2e)
) t
where a.user_id = (select user_id from e2e);

select 'topup=' || gap from e2e_gap;
select 'balance=' || balance || ' lifetime=' || lifetime_earned from rewards.point_accounts where user_id = (select user_id from e2e);
commit;
