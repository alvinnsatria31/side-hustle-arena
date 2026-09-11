-- Production E2E cleanup (2026-09-11). Leaves nothing live and nothing owed:
--   * the tester's reward claim is reversed and refunded (so no admin ever sees
--     it in the fulfilment queue),
--   * the tester's remaining points are zeroed with one audited adjustment,
--   * the test week and its project are archived, so no current, leaderboard or
--     showcase view can pick them up,
--   * the tester account is suspended, so its session resolves to nobody.
-- Every step writes an audit row. Ledger rows are appended, never deleted.
\set ON_ERROR_STOP on
begin;

create temp table e2e on commit drop as
select u.id as user_id, w.id as week_id
from identity.users u, arena.weeks w
where u.auth_subject = 'sk-participant:e2e-prod-tester-20260911' and w.week_code = 'E2E-PROD-20260911';

do $$ begin
  if (select count(*) from e2e) <> 1 then raise exception 'E2E fixture not found'; end if;
end $$;

select pg_advisory_xact_lock(hashtext('e2e-prod-cleanup'));
select 1 from rewards.point_accounts where user_id = (select user_id from e2e) for update;

-- 1. Reverse open claims: the refund entry the service would write, then status.
insert into rewards.point_ledger (user_id, amount, entry_type, reference_type, reference_id, description, idempotency_key)
select r.user_id, r.points_spent, 'ADMIN_REVERSAL', 'redemption', r.id::text, 'E2E cleanup: test claim reversed', 'redemption:' || r.id || ':refund'
from rewards.redemptions r
where r.user_id = (select user_id from e2e) and r.status in ('PENDING', 'PROCESSING')
  and exists (select 1 from rewards.point_ledger l where l.idempotency_key = 'redemption:' || r.id || ':debit')
on conflict (idempotency_key) do nothing;

insert into audit.logs (actor_type, actor_subject, action, entity_type, entity_id, metadata)
select 'SYSTEM', 'maintenance:owner-request', 'REWARD_REVERSED', 'redemption', r.id::text,
       jsonb_build_object('reason', 'E2E cleanup', 'previousStatus', r.status, 'pointsRefunded', r.points_spent)
from rewards.redemptions r where r.user_id = (select user_id from e2e) and r.status in ('PENDING', 'PROCESSING');

update rewards.redemptions set status = 'ADMIN_REVERSED', updated_at = now()
where user_id = (select user_id from e2e) and status in ('PENDING', 'PROCESSING');

-- 2. Zero whatever balance remains (week award plus the audited top-up).
insert into rewards.point_ledger (user_id, amount, entry_type, reference_type, reference_id, description, idempotency_key)
select (select user_id from e2e), -sum(amount), 'ADMIN_ADJUSTMENT', 'e2e', 'E2E-PROD-20260911', 'E2E cleanup: test account balance zeroed', 'e2e-prod-20260911:zero'
from rewards.point_ledger where user_id = (select user_id from e2e)
having sum(amount) <> 0
on conflict (idempotency_key) do nothing;

-- Same arithmetic as accounting.summarizePoints: redemption debits and their
-- refunds are spending; everything else is earning.
update rewards.point_accounts a set
  balance = greatest(0, t.balance), lifetime_earned = greatest(0, t.earned), lifetime_spent = greatest(0, t.spent), updated_at = now()
from (
  select sum(amount) as balance,
         sum(case when entry_type = 'REWARD_REDEMPTION' or (entry_type = 'ADMIN_REVERSAL' and reference_type = 'redemption') then 0 else amount end) as earned,
         -sum(case when entry_type = 'REWARD_REDEMPTION' or (entry_type = 'ADMIN_REVERSAL' and reference_type = 'redemption') then amount else 0 end) as spent
  from rewards.point_ledger where user_id = (select user_id from e2e)
) t
where a.user_id = (select user_id from e2e);

-- 3. Archive the week and its project.
update arena.projects set status = 'ARCHIVED', updated_at = now() where week_id = (select week_id from e2e);
update arena.weeks set status = 'ARCHIVED', updated_at = now() where id = (select week_id from e2e);

-- 4. Suspend the tester.
update identity.users set status = 'SUSPENDED', updated_at = now() where id = (select user_id from e2e);

insert into audit.logs (actor_type, actor_subject, action, entity_type, entity_id, metadata)
select 'SYSTEM', 'maintenance:owner-request', 'E2E_FIXTURE_CLEANED', 'week', week_id::text,
       jsonb_build_object('weekCode', 'E2E-PROD-20260911', 'testerSubject', 'sk-participant:e2e-prod-tester-20260911',
         'actions', jsonb_build_array('claims reversed', 'balance zeroed', 'week and project archived', 'tester suspended'))
from e2e;

select 'week=' || w.status, 'user=' || u.status, 'balance=' || a.balance, 'lifetime=' || a.lifetime_earned,
       'open_claims=' || (select count(*) from rewards.redemptions r where r.user_id = u.id and r.status in ('PENDING', 'PROCESSING'))
from e2e join arena.weeks w on w.id = e2e.week_id join identity.users u on u.id = e2e.user_id
left join rewards.point_accounts a on a.user_id = u.id;

commit;
