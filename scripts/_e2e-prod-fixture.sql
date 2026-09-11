-- Production E2E fixture (2026-09-11), approved by the product owner.
--
-- An isolated test week that can never become the participants' current week:
-- it opens one hour BEFORE ARENA-KICKOFF-WEEK-1, and the current week is the
-- OPEN week with the latest opens_at, so KICKOFF stays current throughout.
-- The project is a copy of a published KICKOFF project; KICKOFF itself is not
-- touched. The tester has no email, so no notification email is ever sent
-- (the outbox skips NO_EMAIL_ON_FILE).
--
-- The one deliberate bypass: selection only enrols into the current week, so
-- the tester's enrollment is inserted here. Everything after it goes through
-- the real HTTP API, the real n8n grading worker and the real scheduler.
\set ON_ERROR_STOP on
begin;

do $$ begin
  if exists (select 1 from arena.weeks where week_code = 'E2E-PROD-20260911') then
    raise exception 'E2E fixture already exists';
  end if;
end $$;

insert into identity.users (auth_subject, email_cache, display_name_cache)
values ('sk-participant:e2e-prod-tester-20260911', '', 'Tester E2E (internal)');

insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
values ('E2E-PROD-20260911', 'Uji E2E internal - bukan minggu kompetisi', 'OPEN',
        '2026-09-10 13:00:00+00', now() + interval '45 minutes', 'Asia/Jakarta');

insert into arena.week_rules (week_id) select id from arena.weeks where week_code = 'E2E-PROD-20260911';

create temp table e2e_ids on commit drop as
select gen_random_uuid() as project_id,
       (select id from arena.weeks where week_code = 'E2E-PROD-20260911') as week_id,
       (select id from identity.users where auth_subject = 'sk-participant:e2e-prod-tester-20260911') as user_id,
       '0cfdfc52-6e56-4881-84f7-25153ef46ded'::uuid as source_id;

insert into arena.projects
select (jsonb_populate_record(null::arena.projects, to_jsonb(p) || jsonb_build_object(
  'id', (select project_id from e2e_ids), 'week_id', (select week_id from e2e_ids),
  'slug', 'e2e-prod-20260911-data', 'title', '[UJI E2E] ' || p.title,
  'status', 'PUBLISHED', 'published_at', now(), 'scheduled_publish_at', null,
  'created_at', now(), 'updated_at', now()))).*
from arena.projects p where p.id = (select source_id from e2e_ids);

insert into arena.project_submission_requirements
select (jsonb_populate_record(null::arena.project_submission_requirements, to_jsonb(r) || jsonb_build_object(
  'id', gen_random_uuid(), 'project_id', (select project_id from e2e_ids)))).*
from arena.project_submission_requirements r where r.project_id = (select source_id from e2e_ids);

insert into arena.project_rubric_criteria
select (jsonb_populate_record(null::arena.project_rubric_criteria, to_jsonb(c) || jsonb_build_object(
  'id', gen_random_uuid(), 'project_id', (select project_id from e2e_ids)))).*
from arena.project_rubric_criteria c where c.project_id = (select source_id from e2e_ids);

insert into arena.project_skills (project_id, skill_id, weight)
select (select project_id from e2e_ids), skill_id, weight
from arena.project_skills where project_id = (select source_id from e2e_ids);

insert into arena.project_resources
select (jsonb_populate_record(null::arena.project_resources, to_jsonb(r) || jsonb_build_object(
  'id', gen_random_uuid(), 'project_id', (select project_id from e2e_ids)))).*
from arena.project_resources r where r.project_id = (select source_id from e2e_ids);

insert into arena.enrollments (user_id, week_id, project_id)
select user_id, week_id, project_id from e2e_ids;

insert into audit.logs (actor_type, actor_subject, action, entity_type, entity_id, metadata)
select 'SYSTEM', 'maintenance:owner-request', 'E2E_FIXTURE_CREATED', 'week', week_id::text,
       jsonb_build_object('purpose', 'production E2E cycle approved by the product owner on 2026-09-11',
         'weekCode', 'E2E-PROD-20260911', 'projectId', project_id, 'sourceProjectId', source_id,
         'testerSubject', 'sk-participant:e2e-prod-tester-20260911',
         'bypass', 'enrollment inserted directly: selection only enrols into the current week')
from e2e_ids;

select 'week_id=' || week_id, 'project_id=' || project_id, 'user_id=' || user_id from e2e_ids;
select 'enrollment_id=' || e.id from arena.enrollments e join e2e_ids i on i.user_id = e.user_id and i.week_id = e.week_id;
select 'requirement ' || r.type || ' ' || r.id || ' required=' || r.required || ' ' || r.label
from arena.project_submission_requirements r join e2e_ids i on i.project_id = r.project_id order by r.sort_order;

commit;
