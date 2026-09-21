-- LOCAL DEMO DATA — never run this against production.
--
-- Seeds 14 dummy participants, three FINALIZED demo weeks with projects,
-- enrollments, submissions, published reviews, weekly rankings and the
-- WEEKLY_RANK point ledger rows that go with them, so the leaderboard podium,
-- the all-time tab, the dashboard preview and the Poin & hadiah page have
-- something to show on a developer machine. One dummy (Raka) also holds a
-- fulfilled reward claim, so the reward ladder shows a taken step, and six
-- points-priced store products fill the Poin & hadiah catalogue (the store UI
-- also needs NEXT_PUBLIC_STORE_ENABLED=true on the dev server).
--
-- Points follow the real week_rules defaults: #1 300, #2 200, #3 150, others 100.
-- Every row is marked (auth subject `sk-participant:demo-arena-*`, week code
-- `DEMO-*`, project slug `demo-arena-*`, ledger key `demo-arena:*`) and the
-- script deletes its own previous rows first, so re-running it is safe.
--
-- Seed:  docker exec -i arena-local-db psql -U arena -d arena -v local_demo=1 < scripts/_local-demo-leaderboard.sql
-- Clean: docker exec -i arena-local-db psql -U arena -d arena -v local_demo=1 -v clean=1 < scripts/_local-demo-leaderboard.sql
\set ON_ERROR_STOP on
\if :{?local_demo}
\else
  \echo 'Refusing to run: pass -v local_demo=1, and only against a local database.'
  \quit
\endif

begin;

create temp table demo_weeks on commit drop as
select id from arena.weeks where week_code like 'DEMO-%';
create temp table demo_users on commit drop as
select id from identity.users where auth_subject like 'sk-participant:demo-arena-%';

-- Everything a dummy account can have written, including anything done while
-- logged in as one; if a table here is missed the transaction rolls back whole.
delete from rewards.point_ledger where user_id in (select id from demo_users);
delete from rewards.redemptions where user_id in (select id from demo_users);
delete from rewards.point_accounts where user_id in (select id from demo_users);
delete from arena.weekly_rankings where week_id in (select id from demo_weeks);
delete from arena.reviews where submission_version_id in (
  select v.id from arena.submission_versions v join arena.submissions s on s.id = v.submission_id where s.week_id in (select id from demo_weeks));
update arena.submissions set latest_version_id = null where week_id in (select id from demo_weeks);
delete from arena.submission_versions where submission_id in (select id from arena.submissions where week_id in (select id from demo_weeks));
delete from arena.submissions where week_id in (select id from demo_weeks);
delete from arena.enrollments where week_id in (select id from demo_weeks);
delete from arena.projects where week_id in (select id from demo_weeks);
delete from arena.week_rules where week_id in (select id from demo_weeks);
delete from arena.weeks where id in (select id from demo_weeks);
delete from store.payment_events where order_id in (select o.id from store.orders o join store.products p on p.id = o.product_id where p.slug like 'demo-arena-%' or o.user_id in (select id from demo_users));
delete from store.entitlements where product_id in (select id from store.products where slug like 'demo-arena-%') or user_id in (select id from demo_users);
delete from store.orders where product_id in (select id from store.products where slug like 'demo-arena-%') or user_id in (select id from demo_users);
delete from store.products where slug like 'demo-arena-%';
delete from identity.users where id in (select id from demo_users);

\if :{?clean}
commit;
\echo 'Demo leaderboard data removed.'
\quit
\endif

-- People ---------------------------------------------------------------------
create temp table demo_people (key text primary key, name text, avatar text) on commit drop;
insert into demo_people values
  ('nadia', 'Nadia Putri', 'a010'), ('raka', 'Raka Saputra', 'a001'), ('dimas', 'Dimas Aditya', 'a004'),
  ('salsa', 'Salsa Wulandari', 'a002'), ('bima', 'Bima Firmansyah', 'a007'), ('alya', 'Alya Larasati', 'a014'),
  ('fikri', 'Fikri Kurniawan', 'a006'), ('tasya', 'Tasya Amelia', 'a057'), ('rizky', 'Rizky Pratama', 'a027'),
  ('intan', 'Intan Permata', 'a024'), ('farhan', 'Farhan Maulana', 'a064'), ('citra', 'Citra Anggraini', 'a046'),
  ('yoga', 'Yoga Prasetyo', 'a060'), ('nabila', 'Nabila Zahra', 'a081');

insert into identity.users (auth_subject, email_cache, display_name_cache, avatar_id)
select 'sk-participant:demo-arena-' || key, key || '@demo.arena.local.invalid', name, avatar from demo_people;

-- Weeks and projects -------------------------------------------------------------
create temp table demo_week_plan (code text primary key, title text, opens timestamptz, deadline timestamptz, finalized timestamptz) on commit drop;
insert into demo_week_plan values
  ('DEMO-W36', 'Demo minggu 36', now() - interval '21 days', now() - interval '15 days', now() - interval '14 days'),
  ('DEMO-W37', 'Demo minggu 37', now() - interval '14 days', now() - interval '8 days', now() - interval '7 days'),
  ('DEMO-W38', 'Demo minggu 38', now() - interval '7 days', now() - interval '2 days', now() - interval '1 hour');

insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone, finalized_at)
select code, title, 'FINALIZED', opens, deadline, 'Asia/Jakarta', finalized from demo_week_plan;
insert into arena.week_rules (week_id) select id from arena.weeks where week_code like 'DEMO-%';

create temp table demo_projects (code text, division text, slug text, title text) on commit drop;
insert into demo_projects values
  ('DEMO-W36', 'Data', 'demo-arena-w36-data', 'Segmentasi pelanggan ritel dengan clustering'),
  ('DEMO-W36', 'Design', 'demo-arena-w36-design', 'Riset persona aplikasi parkir'),
  ('DEMO-W36', 'Product', 'demo-arena-w36-product', 'Prioritas fitur aplikasi kasir UMKM'),
  ('DEMO-W37', 'Data', 'demo-arena-w37-data', 'Dashboard penjualan UMKM'),
  ('DEMO-W37', 'Design', 'demo-arena-w37-design', 'Redesign alur checkout aplikasi laundry'),
  ('DEMO-W37', 'Product', 'demo-arena-w37-product', 'Rencana onboarding aplikasi tabungan'),
  ('DEMO-W38', 'Data', 'demo-arena-w38-data', 'Analisis churn pelanggan langganan kopi'),
  ('DEMO-W38', 'Design', 'demo-arena-w38-design', 'Moodboard identitas kedai kopi lokal'),
  ('DEMO-W38', 'Product', 'demo-arena-w38-product', 'PRD fitur pesan-antar katering');

insert into arena.projects
select (jsonb_populate_record(null::arena.projects, to_jsonb(t) || jsonb_build_object(
  'id', gen_random_uuid(),
  'week_id', (select id from arena.weeks where week_code = d.code),
  'division_id', (select id from arena.divisions where name = d.division order by created_at limit 1),
  'slug', d.slug, 'title', d.title, 'status', 'PUBLISHED', 'published_at', now(),
  'scheduled_publish_at', null, 'created_at', now(), 'updated_at', now()))).*
from demo_projects d
cross join lateral (
  select * from arena.projects p where p.status = 'PUBLISHED' and p.slug not like 'demo-arena-%' order by p.created_at limit 1
) t;

-- Results: week, rank, person, division, score ------------------------------------
create temp table demo_results (code text, rank int, key text, division text, score numeric) on commit drop;
insert into demo_results values
  ('DEMO-W38', 1, 'nadia', 'Data', 95.0), ('DEMO-W38', 2, 'raka', 'Data', 91.5), ('DEMO-W38', 3, 'dimas', 'Product', 88.0),
  ('DEMO-W38', 4, 'salsa', 'Design', 86.0), ('DEMO-W38', 5, 'bima', 'Product', 84.5), ('DEMO-W38', 6, 'alya', 'Design', 81.0),
  ('DEMO-W38', 7, 'fikri', 'Data', 79.5), ('DEMO-W38', 8, 'tasya', 'Design', 77.0), ('DEMO-W38', 9, 'rizky', 'Product', 74.5),
  ('DEMO-W38', 10, 'intan', 'Data', 72.0), ('DEMO-W38', 11, 'farhan', 'Product', 69.5), ('DEMO-W38', 12, 'citra', 'Design', 66.0),
  ('DEMO-W37', 1, 'raka', 'Data', 94.0), ('DEMO-W37', 2, 'salsa', 'Design', 90.5), ('DEMO-W37', 3, 'nadia', 'Data', 89.0),
  ('DEMO-W37', 4, 'yoga', 'Product', 85.0), ('DEMO-W37', 5, 'dimas', 'Product', 83.5), ('DEMO-W37', 6, 'nabila', 'Design', 80.0),
  ('DEMO-W37', 7, 'alya', 'Design', 78.0), ('DEMO-W37', 8, 'bima', 'Product', 76.5), ('DEMO-W37', 9, 'fikri', 'Data', 73.0),
  ('DEMO-W37', 10, 'citra', 'Design', 70.5), ('DEMO-W37', 11, 'farhan', 'Product', 68.0),
  ('DEMO-W36', 1, 'dimas', 'Product', 93.0), ('DEMO-W36', 2, 'nadia', 'Data', 90.0), ('DEMO-W36', 3, 'intan', 'Data', 87.5),
  ('DEMO-W36', 4, 'raka', 'Data', 85.0), ('DEMO-W36', 5, 'tasya', 'Design', 82.0), ('DEMO-W36', 6, 'yoga', 'Product', 80.5),
  ('DEMO-W36', 7, 'salsa', 'Design', 78.0), ('DEMO-W36', 8, 'rizky', 'Product', 75.0), ('DEMO-W36', 9, 'nabila', 'Design', 72.5),
  ('DEMO-W36', 10, 'bima', 'Product', 70.0);

create temp table demo_rows on commit drop as
select r.*, w.id as week_id, w.submission_deadline_at as deadline, u.id as user_id, p.id as project_id,
       case r.rank when 1 then 300 when 2 then 200 when 3 then 150 else 100 end as points,
       gen_random_uuid() as enrollment_id, gen_random_uuid() as submission_id,
       gen_random_uuid() as version_id, gen_random_uuid() as review_id
from demo_results r
join arena.weeks w on w.week_code = r.code
join identity.users u on u.auth_subject = 'sk-participant:demo-arena-' || r.key
join arena.projects p on p.week_id = w.id and p.slug = 'demo-arena-' || lower(replace(r.code, 'DEMO-', '')) || '-' || lower(r.division);

insert into arena.enrollments (id, user_id, week_id, project_id, status, selected_at)
select enrollment_id, user_id, week_id, project_id, 'COMPLETED', deadline - interval '5 days' from demo_rows;
insert into arena.submissions (id, enrollment_id, user_id, week_id, project_id, status)
select submission_id, enrollment_id, user_id, week_id, project_id, 'FINALIZED' from demo_rows;
insert into arena.submission_versions (id, submission_id, version_number, submitted_at, is_final)
select version_id, submission_id, 1, deadline - interval '1 hour' * rank, true from demo_rows;
update arena.submissions s set latest_version_id = d.version_id from demo_rows d where s.id = d.submission_id;
insert into arena.reviews (id, submission_version_id, status, final_score)
select review_id, version_id, 'PUBLISHED', score from demo_rows;
insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded)
select week_id, user_id, project_id, version_id, review_id, score, deadline - interval '1 hour' * rank, rank, points from demo_rows;

-- Points --------------------------------------------------------------------------
insert into rewards.point_ledger (user_id, amount, entry_type, week_id, reference_type, reference_id, description, idempotency_key, created_at)
select user_id, points, 'WEEKLY_RANK', week_id, 'weekly_ranking', version_id::text, 'Demo weekly rank', 'demo-arena:rank:' || code || ':' || key,
       (select finalized from demo_week_plan where demo_week_plan.code = demo_rows.code)
from demo_rows;

-- Raka already claimed the first reward: a taken step on the ladder and a debit in his history.
with claim as (
  insert into rewards.redemptions (user_id, reward_id, points_spent, status, idempotency_key, redeemed_at, fulfilled_at)
  select u.id, c.id, c.points_cost, 'FULFILLED', 'demo-arena:claim:raka:' || c.slug, now() - interval '3 days', now() - interval '3 days'
  from identity.users u, rewards.catalog c
  where u.auth_subject = 'sk-participant:demo-arena-raka' and c.is_active
  order by c.points_cost limit 1
  returning id, user_id, points_spent, redeemed_at
)
insert into rewards.point_ledger (user_id, amount, entry_type, reference_type, reference_id, description, idempotency_key, created_at)
select user_id, -points_spent, 'REWARD_REDEMPTION', 'redemption', id::text, 'Demo reward claim', 'redemption:' || id || ':debit', redeemed_at from claim;

-- A points catalogue for the Poin & hadiah page. The ACTIVE downloads deliver a
-- documentation-domain link, so a local points checkout completes without
-- touching real content; the two services stay COMING_SOON.
insert into store.products (slug, title, summary, product_kind, status, points_cost, delivery_kind, delivery_url, sort_order) values
  ('demo-arena-ebook-30-ide', 'E-book 30 Ide Side Hustle', 'Kumpulan ide bisnis sampingan yang bisa langsung kamu mulai.', 'DOWNLOAD', 'ACTIVE', 1000, 'LINK', 'https://example.com/demo-arena/ebook', 1),
  ('demo-arena-proposal-client', 'Template Proposal Client', 'Template siap pakai untuk menarik klien impianmu.', 'DOWNLOAD', 'ACTIVE', 700, 'LINK', 'https://example.com/demo-arena/proposal', 2),
  ('demo-arena-budget-freelancer', 'Template Budget Freelancer', 'Sheet arus kas dan tarif untuk freelancer pemula.', 'DOWNLOAD', 'ACTIVE', 500, 'LINK', 'https://example.com/demo-arena/budget', 3),
  ('demo-arena-kit-portofolio', 'Kit Portofolio Canva', 'Layout portofolio siap isi untuk hasil proyek Arena.', 'DOWNLOAD', 'ACTIVE', 600, 'LINK', 'https://example.com/demo-arena/portfolio', 4),
  ('demo-arena-mentoring', 'Sesi Mentoring 1:1 (60 menit)', 'Konsultasi karier atau side hustle bersama mentor.', 'ACCESS', 'COMING_SOON', 2000, null, null, 5),
  ('demo-arena-workshop', 'Tiket Workshop Freelance 101', 'Akses kelas live, rekaman, dan materi eksklusif.', 'ACCESS', 'COMING_SOON', 1800, null, null, 6);

insert into rewards.point_accounts (user_id, balance, lifetime_earned, lifetime_spent)
select l.user_id,
       greatest(0, sum(l.amount)),
       sum(case when l.entry_type = 'WEEKLY_RANK' then l.amount else 0 end),
       -sum(case when l.entry_type = 'REWARD_REDEMPTION' then l.amount else 0 end)
from rewards.point_ledger l join identity.users u on u.id = l.user_id
where u.auth_subject like 'sk-participant:demo-arena-%'
group by l.user_id;

commit;

select 'demo users: ' || count(*) from identity.users where auth_subject like 'sk-participant:demo-arena-%';
select 'demo rankings: ' || count(*) from arena.weekly_rankings r join arena.weeks w on w.id = r.week_id where w.week_code like 'DEMO-%';
select u.display_name_cache || ' — ' || a.balance || ' poin (total ' || a.lifetime_earned || ')'
from rewards.point_accounts a join identity.users u on u.id = a.user_id
where u.auth_subject like 'sk-participant:demo-arena-%' order by a.lifetime_earned desc;
