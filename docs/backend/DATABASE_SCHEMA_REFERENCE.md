# Side Hustle Arena — Database Schema Reference

## identity.users

Purpose: external identity mapping and non-authoritative profile caches. Primary Key: `id`. Important Foreign Keys: none. Critical Constraints: unique `auth_subject`. Important Indexes: unique auth subject constraint. Notes: no credentials or password fields.

## arena.divisions

Purpose: project categories. Primary Key: `id`. Important Foreign Keys: none. Critical Constraints: unique `slug`. Important Indexes: unique slug constraint. Notes: users are not permanently assigned to a division.

## arena.weeks

Purpose: weekly Arena lifecycle. Primary Key: `id`. Important Foreign Keys: none. Critical Constraints: unique `week_code`; deadline after opening. Important Indexes: `(status, opens_at)`. Notes: timestamps use `timestamptz` and default timezone is Asia/Jakarta.

## arena.week_rules

Purpose: immutable per-week business-rule snapshot. Primary Key: `id`. Important Foreign Keys: `week_id → arena.weeks`. Critical Constraints: unique `week_id`; positive limits; non-negative points. Important Indexes: unique week constraint. Notes: preserves historical rule values.

## arena.projects

Purpose: project definitions and publication metadata. Primary Key: `id`. Important Foreign Keys: week, division, optional automation run. Critical Constraints: unique `(week_id, slug)`; positive estimated minutes when set. Important Indexes: `(week_id, status)`, `division_id`. Notes: preview records only; no Discord integration.

## arena.skills

Purpose: normalized skill catalog. Primary Key: `id`. Important Foreign Keys: none. Critical Constraints: unique `slug`. Important Indexes: unique slug constraint. Notes: supports future career aggregation.

## arena.project_skills

Purpose: project-to-skill mapping. Primary Key: composite logical pair. Important Foreign Keys: project, skill. Critical Constraints: unique `(project_id, skill_id)` and non-negative optional weight. Important Indexes: unique pair constraint. Notes: project deletion cascades to the mapping.

## arena.project_rubric_criteria

Purpose: rubric definition per project. Primary Key: `id`. Important Foreign Keys: project. Critical Constraints: positive weight/max score and non-negative sort order. Important Indexes: project FK. Notes: project deletion cascades; total-weight validation is future service logic.

## arena.project_submission_requirements

Purpose: typed deliverable requirements. Primary Key: `id`. Important Foreign Keys: project. Critical Constraints: valid item bounds and sort order. Important Indexes: project FK. Notes: MIME/link allowlists use text arrays.

## arena.enrollments

Purpose: one selected weekly project for a user. Primary Key: `id`. Important Foreign Keys: user, week, project. Critical Constraints: unique `(user_id, week_id)`. Important Indexes: `project_id`; unique pair constraint. Notes: project/week consistency is future service validation.

## arena.workspace_progress

Purpose: mutable workspace draft. Primary Key: `id`. Important Foreign Keys: enrollment. Critical Constraints: unique `enrollment_id`. Important Indexes: unique enrollment constraint. Notes: cascade cleanup is limited to deleted enrollment drafts.

## arena.submissions

Purpose: one logical submission per enrollment. Primary Key: `id`. Important Foreign Keys: enrollment, user, week, project. Critical Constraints: unique `enrollment_id`; non-negative attempts. Important Indexes: `(user_id, week_id)`. Notes: `latest_version_id` is intentionally FK-free in this first migration.

## arena.submission_draft_items

Purpose: mutable file/link/text draft metadata. Primary Key: `id`. Important Foreign Keys: submission; optional requirement. Critical Constraints: non-negative optional file size. Important Indexes: submission/requirement FKs. Notes: metadata only, never raw file bytes.

## arena.submission_versions

Purpose: immutable submission snapshot. Primary Key: `id`. Important Foreign Keys: submission. Critical Constraints: unique `(submission_id, version_number)` and positive version/attempt numbers. Important Indexes: `(submission_id, submitted_at)`. Notes: access failures may have no review attempt.

## arena.submission_version_items

Purpose: immutable item snapshots. Primary Key: `id`. Important Foreign Keys: submission version; optional requirement. Critical Constraints: non-negative optional file size. Important Indexes: version/requirement FKs. Notes: metadata only.

## arena.review_jobs

Purpose: future asynchronous review queue record. Primary Key: `id`. Important Foreign Keys: submission version. Critical Constraints: unique `submission_version_id`; non-negative attempts. Important Indexes: `(status, priority DESC, available_at)`. Notes: no worker is implemented.

## arena.reviews

Purpose: hidden/published AI review result. Primary Key: `id`. Important Foreign Keys: submission version; optional automation run. Critical Constraints: unique `submission_version_id`; score/confidence ranges. Important Indexes: `status`. Notes: AI and final scores remain separate.

## arena.review_scores

Purpose: rubric criterion score. Primary Key: `id`. Important Foreign Keys: review, rubric criterion. Critical Constraints: unique `(review_id, rubric_criterion_id)` and valid score values. Important Indexes: unique pair constraint. Notes: calculations are future service logic.

## arena.review_overrides

Purpose: future admin final-score adjustment history. Primary Key: `id`. Important Foreign Keys: review. Critical Constraints: score ranges and required neutral `admin_subject`. Important Indexes: review FK. Notes: no admin credentials are stored.

## arena.skill_evidence

Purpose: review-backed proven-skill evidence. Primary Key: `id`. Important Foreign Keys: user, week, project, review, skill. Critical Constraints: unique `(review_id, skill_id)` and 0–100 score. Important Indexes: `(user_id, created_at)`, `skill_id`, `review_id`. Notes: relational for career reporting.

## arena.weekly_rankings

Purpose: final global weekly leaderboard row. Primary Key: `id`. Important Foreign Keys: week, user, project, version, review. Critical Constraints: unique week/user and week/rank; valid rank, score, points. Important Indexes: `(week_id, rank)`, `(week_id, final_score, final_submitted_at)`. Notes: future order is score descending then submitted time ascending.

## rewards.point_accounts

Purpose: fast current balance projection. Primary Key: `user_id`. Important Foreign Keys: user. Critical Constraints: non-negative balance and lifetime totals. Important Indexes: primary key. Notes: ledger is the historical source of truth.

## rewards.point_ledger

Purpose: immutable point history. Primary Key: `id`. Important Foreign Keys: user; optional week. Critical Constraints: unique `idempotency_key`. Important Indexes: `(user_id, created_at)`. Notes: no expiration fields.

## rewards.catalog

Purpose: reward SKU catalog. Primary Key: `id`. Important Foreign Keys: none. Critical Constraints: unique `slug`; positive points cost; non-negative optional monetary value. Important Indexes: unique slug constraint. Notes: USD 20/2,000 points is a SKU, not a conversion formula.

## rewards.inventory_periods

Purpose: bounded reward availability period. Primary Key: `id`. Important Foreign Keys: reward. Critical Constraints: ordered dates and bounded non-negative quantities. Important Indexes: reward FK. Notes: transactional reservation is deferred.

## rewards.redemptions

Purpose: reward redemption history. Primary Key: `id`. Important Foreign Keys: user, reward, optional inventory period. Critical Constraints: unique idempotency key; positive points spent. Important Indexes: `(user_id, status)`. Notes: no user cancellation status.

## notifications.events

Purpose: durable user/week notification event. Primary Key: `id`. Important Foreign Keys: optional user and week. Critical Constraints: typed event and required title/body. Important Indexes: user/week FKs. Notes: no delivery provider integration.

## notifications.deliveries

Purpose: per-channel delivery attempt. Primary Key: `id`. Important Foreign Keys: event. Critical Constraints: typed channel and status. Important Indexes: `status`. Notes: provider references contain no secret credentials.

## automation.runs

Purpose: idempotent automation execution record. Primary Key: `id`. Important Foreign Keys: optional week. Critical Constraints: unique `idempotency_key`; non-negative item counters. Important Indexes: `(type, status)`. Notes: no scheduler or VPS access.

## audit.logs

Purpose: immutable auditable action record. Primary Key: `id`. Important Foreign Keys: none. Critical Constraints: typed actor and required action/entity type. Important Indexes: primary key. Notes: metadata excludes secrets, private URLs, and sensitive document bodies.
