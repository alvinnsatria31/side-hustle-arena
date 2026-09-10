-- Curate the three divisions' rubric criteria, then freeze them as the
-- generation base rubric.
--
-- Why this is needed: every criterion shipped with `description` and
-- `review_instruction` empty, so the reviewer model was handed a criterion's
-- name and weight and nothing about what it means or how to score it. Weights
-- were a flat 1 across the board, which docs/backend/END_TO_END_AUDIT_2026-09-09.md
-- flagged as a P0.
--
-- Safe to run once. The pre-change rows are already copied to
-- arena.rubric_backup_20260910. To roll back: restore from that table and
-- delete the generation.rubric-frozen rows this file writes.
--
-- The freeze is what unblocks AI generation: contextFor() refuses to generate
-- for a division with no frozen base rubric, and baseRubric() reads the
-- EARLIEST such row per division — so this must land exactly once per division.
-- The `where not exists` guard below makes a second run a no-op rather than a
-- second, ignored freeze.

begin;

-- 1. Real prose and the agreed weights for all nine criteria.
update arena.project_rubric_criteria c set
  weight = v.weight, max_score = 100, sort_order = v.ord,
  description = v.descr, review_instruction = v.instr, updated_at = now()
from (values
 ('dev-arena-core-data','Problem framing',30,0,
  $d$Whether the submission states the business question it answers, why that question matters, and what would count as a useful answer, before any analysis begins.$d$,
  $i$Score high when the question is specific enough that a wrong answer would be recognisable, and what was deliberately left out is stated. Score low when the submission opens with charts and never says what decision they inform, or restates the brief without narrowing it.$i$),
 ('dev-arena-core-data','Evidence',40,1,
  $d$Whether the conclusions are supported by the data actually presented: correct aggregation, acknowledged limitations, and figures a reader can trace back to their source.$d$,
  $i$Score high when each claim points to a specific figure or table and the submission names what the data cannot show. Score low when numbers appear without derivation, a correlation is described as a cause, or a conclusion outruns the sample it rests on.$i$),
 ('dev-arena-core-data','Recommendation',30,2,
  $d$Whether the analysis ends in a decision someone could act on, with the trade-off and the next step made explicit.$d$,
  $i$Score high when the recommendation names who should do what and what would make it wrong. Score low when the submission stops at insights without a decision, or recommends everything with no priority.$i$),

 ('dev-arena-core-product','User understanding',30,0,
  $d$Whether the submission shows a grounded picture of the user and the problem as they experience it, rather than as the product team imagines it.$d$,
  $i$Score high when the user context, constraint or motivation is concrete and tied to something observable in the brief. Score low when personas are asserted without support, or the problem is stated only in company terms such as retention or conversion.$i$),
 ('dev-arena-core-product','Prioritization',40,1,
  $d$Whether what to build, and what deliberately not to build, is decided with a stated reason.$d$,
  $i$Score high when the submission names what was cut and why, and the reasoning would survive a stakeholder pushing back. Score low when everything is proposed with no sequencing, or priority is asserted as high, medium or low with no rationale behind the label.$i$),
 ('dev-arena-core-product','Measurement',30,2,
  $d$Whether success is defined before the fact, with a metric that would actually move if the change worked and a way to tell success from noise.$d$,
  $i$Score high when the metric is specific, carries a baseline or target, and the submission says what result would mean the idea failed. Score low when success is described as an improved experience, or the metric could not move within the horizon proposed.$i$),

 ('dev-arena-core-design','Flow clarity',35,0,
  $d$Whether the proposed flow can be followed end to end without the reader guessing: entry point, each state, and what happens when something goes wrong.$d$,
  $i$Score high when a reader could rebuild the flow from the submission alone, including empty, loading and error states. Score low when only the happy path is shown, or screens appear with no indication of how a user moves between them.$i$),
 ('dev-arena-core-design','Interaction rationale',40,1,
  $d$Whether the design decisions are explained by the problem they solve rather than by preference or trend.$d$,
  $i$Score high when a specific choice of control, layout or copy is justified by the user constraint it addresses, and an alternative considered is named. Score low when the rationale is aesthetic, restates what the screen shows, or would apply equally to any product.$i$),
 ('dev-arena-core-design','Presentation',25,2,
  $d$Whether the work is communicated so a stakeholder can review it without a walkthrough: legible artefacts, consistent labelling, and an order that builds.$d$,
  $i$Score high when the submission is self-explanatory, annotated where it needs to be, and consistent in its own terminology. Score low when artefacts are unlabelled, resolution or crop makes them unreadable, or the reader must reconstruct the argument themselves.$i$)
) as v(div_slug, cname, weight, ord, descr, instr)
where c.name = v.cname
  and c.project_id in (
    select p.id from arena.projects p
    join arena.divisions d on d.id = p.division_id
    where d.slug = v.div_slug
  );

-- 2. Freeze each division's base rubric.
--
-- This writes the same row registerLibraryTemplate() writes at
-- src/server/generation/service.ts:176 — same action, entity_type, entity_id,
-- and the same {name, weight, maxScore} projection. It is written directly
-- because that function additionally requires a fully valid ProjectPackage,
-- which these seeded projects cannot supply: they were inserted straight into
-- the tables and have no generation.validated record to build one from.
insert into audit.logs (id, actor_type, actor_subject, action, entity_type, entity_id, metadata, created_at)
select gen_random_uuid(), 'SYSTEM', 'rubric-curation', 'generation.rubric-frozen', 'division', d.id::text,
       jsonb_build_object(
         'rubric', jsonb_agg(jsonb_build_object('name', c.name, 'weight', c.weight, 'maxScore', c.max_score)
                             order by c.sort_order),
         'sourceProjectId', min(p.id::text)
       ),
       now()
from arena.divisions d
join arena.projects p on p.division_id = d.id and p.status = 'PUBLISHED'
join arena.project_rubric_criteria c on c.project_id = p.id
where not exists (
  select 1 from audit.logs l
  where l.action = 'generation.rubric-frozen' and l.entity_id = d.id::text
)
group by d.id;

commit;
