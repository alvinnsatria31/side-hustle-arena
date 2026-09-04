# Side Hustle Arena — Master Product Requirements Document (PRD)

**Dokumen:** Master Product Requirements + Production Handover  
**Produk:** Side Hustle Arena — Sekolah Karir  
**Status dokumen:** Draft Master PRD untuk handover Product Owner  
**Tujuan utama:** Menjadi single source of truth produk, business rules, arsitektur, progress implementasi, automation, AI, operasional, dan roadmap sampai production.

---

## 1. Executive Summary

Side Hustle Arena adalah produk Sekolah Karir yang dirancang sebagai **weekly real-world project engine** untuk membantu mahasiswa, fresh graduate, early-career talent, dan job seeker membangun bukti keterampilan yang nyata.

Arena bukan LMS tradisional, bukan sekadar kumpulan soal, dan bukan game berbasis poin tanpa outcome. Arena harus menghasilkan **portfolio-worthy artifact**, evidence keterampilan, AI feedback, ranking mingguan, dan proof-of-work yang nantinya bisa terhubung ke Career Report serta ekosistem Jobs Sekolah Karir.

Loop produk utama:

`Scan → Diagnose → Practice / Build → Prove → Improve → Apply`

Posisi masing-masing produk dalam ekosistem:

- **CV Scanner** = diagnosis awal.
- **Side Hustle Arena** = intervensi melalui proyek nyata.
- **Career Report** = evidence / proof keterampilan.
- **Jobs** = opportunity / distribusi peluang kerja.

Fokus implementasi sekarang adalah **Side Hustle Arena**. CV Scanner tidak boleh memblokir Arena.

---

# 2. Product Vision

Side Hustle Arena harus menjadi tempat di mana user bisa:

1. Mendapat proyek dunia kerja yang relevan setiap minggu.
2. Memilih satu proyek dari divisi yang diminati.
3. Mengerjakan project selama satu minggu kerja.
4. Mengirim artifact nyata.
5. Mendapat AI review berbasis rubric.
6. Memperbaiki hasil hingga maksimal tiga valid review attempts.
7. Mendapat skor, feedback, skill evidence, leaderboard, dan points.
8. Mengembangkan portfolio yang semakin kuat dari waktu ke waktu.

Arena harus terasa seperti:

> “Simulasi kerja nyata mingguan yang menghasilkan bukti keterampilan.”

Bukan:

> “Kelas online dengan tugas.”

---

# 3. Primary Target Users

Target utama:

- Mahasiswa.
- Mahasiswa tingkat akhir.
- Fresh graduate.
- Early-career talent.
- Job seeker.
- Career switcher yang masih cocok dengan project entry/junior level.

Launch tidak perlu membatasi satu persona sempit, tetapi kesulitan project awal harus tetap relevan untuk talent entry sampai junior.

---

# 4. Initial Divisions

Enam divisi awal yang dikunci:

1. Digital Marketing
2. Human Resources
3. Business Development
4. Data Analyst
5. UI/UX
6. Web Development

Tidak wajib setiap minggu semua divisi memiliki jumlah project yang sama.

Target awal:

- Sekitar 1–3 project per divisi per minggu.
- Jumlah project adalah configurable data.
- Tidak boleh hardcoded ke angka tetap.

---

# 5. Core Weekly Business Model

## 5.1 Weekly Cycle

Siklus utama:

- Project disiapkan sebelum hari Senin.
- Project drop / weekly opening terjadi hari Senin.
- User bekerja Senin–Jumat.
- Deadline submission: **Jumat 23:59 Asia/Jakarta (WIB)**.
- Tidak ada late submission.
- Setelah deadline, week masuk proses closing/finalization.
- Pending review diselesaikan.
- Final score, leaderboard, dan points dipublikasikan setelah finalization.

Lifecycle konseptual:

`DRAFT → PREVIEW → SCHEDULED → OPEN → CLOSED → FINALIZING → FINALIZED → ARCHIVED`

Operational failure state dapat menggunakan `FAILED`.

## 5.2 One Project Per User Per Week

Setiap user hanya boleh memilih:

**Maksimal satu project per minggu.**

User boleh memilih project dari divisi mana pun.

Tidak ada restriction berdasarkan:

- role,
- jurusan,
- membership,
- divisi internal,
- profile pekerjaan.

Current rule:

- Project switching setelah enrollment **tidak diperbolehkan**.
- Jika user sudah memilih project minggu tersebut, pilihan baru ditolak.
- Switching baru boleh ditambahkan jika nanti secara eksplisit diputuskan sebagai product change.

Database dan backend harus sama-sama menegakkan aturan ini.

## 5.3 Deadline

Deadline authoritative:

`Friday 23:59 Asia/Jakarta`

Server-side rule:

`now >= submission_deadline_at → locked`

Yang dikunci setelah deadline:

- project selection,
- workspace mutation,
- draft mutation,
- link mutation,
- upload intent,
- upload finalize,
- Submit,
- Resubmit.

Browser clock tidak boleh menjadi authority.

---

# 6. Project Design Principles

Setiap project harus:

- Bisa dikerjakan kira-kira dalam 1–2 hari concentrated effort.
- Menghasilkan portfolio-worthy artifact.
- Relevan dengan pekerjaan nyata.
- Cocok untuk junior / early-career talent.
- Memiliki deliverable yang jelas.
- Memiliki rubric yang dapat dinilai secara reasonably objective.
- Tidak membutuhkan confidential company data.
- Tidak mewajibkan tool proprietary berbayar mahal.
- Tidak mewajibkan video review.
- Tidak mewajibkan format submission yang tidak didukung Arena.
- Berada dalam comparable difficulty band untuk weekly leaderboard.
- Memiliki expected evidence yang cukup jelas untuk AI reviewer.

---

# 7. Project Generation Automation

## 7.1 High-Level Model

Project mingguan dihasilkan melalui Hermes automation di Sekolah Karir VPS.

Hermes bukan database authority dan bukan scheduler tunggal. Arsitektur dibagi menjadi:

- **Scheduler** = menentukan kapan pekerjaan dijalankan.
- **Worker** = mengambil job yang harus diproses.
- **Hermes** = menjalankan reasoning, model calls, validation, dan retry.
- **Arena Backend** = source of truth, business rules, validation, authorization, persistence.

Konsep:

`Scheduler → Job → Worker → Hermes → Arena Internal API → Database`

## 7.2 Hermes 24/7 Behavior

Hermes berjalan sebagai persistent service di VPS.

Behavior:

- Idle ketika tidak ada job.
- Tidak menggunakan token hanya karena service hidup.
- Bangun saat ada scheduled atau event-driven job.
- Selesai bekerja lalu kembali idle.
- Service harus auto-restart jika crash.
- Health dan heartbeat harus dapat dipantau.

## 7.3 Weekly Project Generation Run

Hermes melakukan satu weekly generation run.

Target output:

**Satu final project package per divisi.**

Bukan membuat banyak kandidat yang harus dipilih founder satu per satu.

Jika output gagal validation, automation boleh regenerate internal.

## 7.4 Project Package

Untuk setiap divisi, Hermes menghasilkan package terstruktur yang mencakup minimal:

- title
- division
- scenario / background
- user role
- objective
- mission / task
- expected deliverables
- estimated effort
- difficulty band
- skills tested
- submission requirements
- base rubric reference
- project-specific scoring anchors
- expected evidence
- resources
- project fingerprint
- generation metadata

Output harus structured JSON atau schema-validated structure.

Markdown bebas tidak boleh menjadi machine authority.

## 7.5 Base Rubric vs Project-Specific Anchors

Base rubric per divisi bersifat stabil dan versioned.

Hermes **tidak boleh mengubah criterion / weights tiap minggu**.

Yang dihasilkan Hermes:

- expected evidence,
- strong-performance anchors,
- weak-performance anchors,
- project-specific interpretation.

Dengan demikian project mingguan bisa berubah tanpa mengubah fairness model.

---

# 8. Project Context Engine

Hermes tidak boleh hanya diberi prompt generik seperti:

> “Buat project Digital Marketing.”

Generation context harus berasal dari beberapa layer:

## 8.1 Arena Project Library

Historical project yang sudah pernah:

- generated,
- validated,
- published,
- completed,
- high quality,
- evergreen.

## 8.2 Role / Skill Taxonomy

Skill utama per division dan pola pekerjaan nyata.

Contoh Data Analyst:

- SQL
- spreadsheet
- data preparation
- visualization
- business insight
- communication

## 8.3 Real-World Market Signals

Signal dapat berasal dari:

- public job descriptions,
- pola skill di Jobs Sekolah Karir,
- public datasets,
- common industry task,
- current tooling practices.

Arena tidak boleh menyalin confidential content atau job description proprietary mentah.

Yang dipakai adalah **task / skill pattern**.

## 8.4 Arena History

Hermes harus menerima recent project history agar tidak mengulang problem yang sama.

---

# 9. Anti-Duplicate / Anti-Repetition System

Setiap project menghasilkan **Project Fingerprint**.

Fingerprint minimal:

- division
- industry
- role
- core skill
- secondary skill
- scenario type
- decision type
- primary deliverable
- input/data type
- target stakeholder
- tool category
- difficulty

Project baru dibandingkan dengan recent history.

Rolling comparison window:

**8–12 minggu terakhir.**

Tidak cukup membandingkan judul.

Semantic similarity / embedding dapat dipakai sebagai additional guard.

Threshold harus dapat dituning berdasarkan production data.

---

# 10. Project Library & Reuse

Semua project yang pernah publish tetap disimpan.

Lifecycle/library tags dapat mencakup:

- GENERATED
- VALIDATED
- PUBLISHED
- COMPLETED
- HIGH_QUALITY
- EVERGREEN
- RETIRED

Setelah satu week selesai, sistem bisa mengevaluasi project dari:

- completion rate
- average score
- score distribution
- technical failure rate
- review consistency
- user feedback
- drop-off

Project bagus dapat dipromosikan menjadi HIGH_QUALITY atau EVERGREEN.

---

# 11. Project Generation Schedule

Exact clock dapat dikonfigurasi, tetapi recommended production schedule:

## Sunday Morning

Sekitar Minggu 09:00 WIB:

`GENERATE_WEEKLY_PROJECTS`

Hermes generate project packages, validate, anti-duplicate, dan regenerate jika perlu.

## Sunday Daytime

Project masuk READY/PREVIEW.

Founder/Product Owner dapat:

- view,
- edit,
- veto,
- regenerate,
- approve.

Manual approval **tidak wajib**.

No action berarti project tetap dapat auto-publish jika validation pass.

## Sunday Night

Final pre-release validation.

## Monday Morning

Week berubah menjadi OPEN.

Project READY dipublish.

Monday notifications dikirim.

---

# 12. Generation Failure Fallback

Fallback order:

1. Generate.
2. Retry / regenerate #1.
3. Retry / regenerate #2.
4. Ambil HIGH_QUALITY project dari library yang tidak melanggar rolling similarity window.
5. Gunakan Emergency Evergreen Project.
6. Jika satu divisi tetap gagal, weekly Arena tetap boleh launch tanpa divisi tersebut.

Satu divisi gagal **tidak boleh** menggagalkan seluruh weekly release.

Semua retry/fallback masuk automation logs.

---

# 13. Project Generation Constitution

Hermes harus bekerja di dalam rule set tetap:

- 1–2 day effort
- portfolio-worthy
- real-world relevance
- leaderboard comparable
- AI-reviewable
- no confidential company data
- no mandatory expensive paid tool
- no mandatory video review
- submission compatible with Arena
- no recent near-duplicate
- valid rubric anchor
- valid resource/access requirements
- hard validation failure → cannot auto-publish

---

# 14. Submission Model

## 14.1 Logical Submission

Satu enrollment memiliki maksimal satu logical submission.

Logical submission memiliki:

- mutable draft
- immutable submitted versions

## 14.2 Mutable Draft

Sebelum deadline user dapat:

- edit explanation
- edit notes
- tambah/hapus file
- tambah/hapus/edit link
- mengganti draft item

Draft edit unlimited.

Draft edit tidak memakan AI review attempt.

## 14.3 Supported Submission Types

### File

- PDF
- DOCX
- PPTX
- CSV
- XLSX
- PNG
- JPG / JPEG
- WEBP

### Link

- GitHub
- live website
- Google Drive
- Google Docs
- Google Sheets
- Figma
- Canva
- Notion
- Looker Studio
- generic HTTPS URL

Code project lebih baik melalui GitHub URL + live URL.

ZIP tidak menjadi preferred submission format.

## 14.4 Default Submission Limits

Defaults:

- max files: 5
- max links: 5
- max file size: 20 MB/file

Project-specific submission requirement dapat memperketat.

---

# 15. Immutable Submission Versioning

Ketika user menekan Submit atau Resubmit, current draft disnapshot menjadi immutable version.

Version menyimpan snapshot:

- explanation
- notes
- file items
- link items
- metadata
- submitted timestamp
- access state
- review attempt number jika valid

Draft change setelah submit tidak boleh mengubah old version.

---

# 16. Technical Access Validation

Submission harus melewati technical access check sebelum mengonsumsi review attempt.

Examples:

- private Drive
- dead URL
- missing object
- corrupted file
- unsupported format
- inaccessible required link

Jika failure:

- version dapat tetap tercatat
- `access_status = FAILED`
- `review_attempt_number = NULL`
- `review_attempts_used` tidak bertambah
- tidak ada AI review job

User dapat memperbaiki draft lalu submit lagi sebelum deadline.

---

# 17. Review Attempt Rule

Maksimum:

**3 valid AI-reviewed attempts per project/week.**

Valid attempt hanya dialokasikan setelah submission version lolos technical validation.

Technical failure tidak memakan quota.

AI provider retry juga tidak memakan quota.

Automation retry dan user review attempt harus memiliki counter terpisah.

---

# 18. File Storage Architecture

Database utama tetap **Neon PostgreSQL**.

Neon menyimpan metadata/state.

Object storage final direction (locked 2026-09-04, supersedes Alibaba OSS):

**Tencent Cloud COS (S3-compatible) — deploy target Vercel**

Tencent COS menyimpan file bytes.

Neon tidak dimigrasi hanya karena storage provider berubah.

Backend sebaiknya provider-agnostic dengan interface seperti:

- createUploadUrl()
- headObject()
- createDownloadUrl()
- deleteObject()

Tencent COS bucket harus:

- private
- no anonymous public access
- no permanent public URL
- random object key
- server-side credentials only
- short-lived signed PUT
- short-lived signed GET
- ownership enforced by Arena backend
- CORS restricted to the Vercel domain
- region ap-jakarta (recommended for WIB users)

Hermes tidak memegang permanent COS credential.

---

# 19. SSRF Protection

User-provided external links harus diperlakukan sebagai untrusted input.

Server-side access validation wajib:

- HTTPS only
- reject credentials in URL
- DNS resolve
- block private/loopback/link-local/reserved ranges
- block metadata IP
- IPv6 protection
- redirect target revalidation
- DNS rebinding protection
- strict timeout
- bounded response
- no Arena cookies forwarded
- no arbitrary Authorization headers forwarded

Generic `fetch(userUrl)` tanpa protection dilarang.

---

# 20. AI Reviewer — Core Mechanics

AI reviewer flow:

`Submit → Technical Gate → Evidence Map → Primary Reviewer → Validator → Confidence Gate → Optional Second Judge → Backend Score → Persist`

AI tidak menentukan leaderboard atau points.

AI hanya menghasilkan:

- criterion scores
- evidence
- issues
- feedback
- confidence

Backend menghitung weighted final score.

---

# 21. Universal Arena Performance Scale

| Score | Interpretation |
|---:|---|
| 0–19 | Missing / fundamentally broken |
| 20–39 | Major problems, belum memenuhi standar dasar |
| 40–59 | Partial / basic execution |
| 60–74 | Competent — memenuhi brief dengan cukup baik |
| 75–84 | Strong — above average dan punya reasoning jelas |
| 85–92 | Job-ready — layak ditampilkan ke recruiter |
| 93–100 | Exceptional professional work |

---

# 22. Base Rubrics

## Digital Marketing

| Criterion | Weight |
|---|---:|
| Strategic reasoning & objective alignment | 25% |
| Analysis & use of evidence/data | 25% |
| Execution quality | 20% |
| Insight & creativity | 15% |
| Communication & portfolio readiness | 15% |

## Human Resources

| Criterion | Weight |
|---|---:|
| Problem diagnosis & HR reasoning | 25% |
| Process / solution design quality | 25% |
| Evidence, fairness & decision quality | 20% |
| Practicality & stakeholder consideration | 15% |
| Communication & portfolio readiness | 15% |

## Business Development

| Criterion | Weight |
|---|---:|
| Opportunity & stakeholder analysis | 25% |
| Value proposition & strategy | 25% |
| Commercial reasoning | 20% |
| Execution / go-to-market plan | 15% |
| Communication & persuasion | 15% |

## Data Analyst

| Criterion | Weight |
|---|---:|
| Data accuracy, preparation & methodology | 30% |
| Analysis & quality of insight | 25% |
| Visualization & information clarity | 20% |
| Business interpretation & recommendation | 15% |
| Communication & reproducibility | 10% |

## UI/UX

| Criterion | Weight |
|---|---:|
| Problem & user understanding | 20% |
| Information architecture & user flow | 20% |
| Visual/UI execution | 25% |
| Usability & accessibility | 20% |
| Rationale & handoff quality | 15% |

## Web Development

| Criterion | Weight |
|---|---:|
| Functional correctness | 30% |
| Code quality & architecture | 25% |
| UX, responsiveness & accessibility | 20% |
| Reliability, performance & security basics | 15% |
| Documentation & handoff | 10% |

---

# 23. Rubric Versioning

Rubric harus versioned.

Contoh:

- DATA_ANALYST_RUBRIC_V1
- DATA_ANALYST_RUBRIC_V2

Project menyimpan rubric version reference.

Rubric lama tidak boleh di-edit retroactively.

Jika rubric diperbaiki, buat versi baru untuk future weeks.

---

# 24. Reviewer Evidence Rule

AI reviewer tidak boleh memberikan score tanpa evidence.

Setiap criterion review minimal mencakup:

- score
- observed evidence
- issues
- confidence

Evidence harus berasal dari actual submission.

AI dilarang mengarang evidence.

---

# 25. Structured Reviewer Output

Internal response harus structured.

Contoh:

```json
{
  "criteria": [
    {
      "criterion_id": "functional_correctness",
      "score": 82,
      "evidence": [
        "Authentication flow completes successfully"
      ],
      "issues": [
        "Form error handling is incomplete"
      ],
      "confidence": 0.91
    }
  ],
  "strengths": [],
  "priority_improvements": [],
  "confidence": 0.88
}
```

Backend melakukan arithmetic weighted score.

LLM tidak menjadi authority untuk final score calculation.

---

# 26. Primary Reviewer + Validator

Default review:

`Primary Reviewer → Review Validator`

Validator memeriksa:

- JSON/schema valid
- semua criterion terisi
- score range valid
- evidence relevant
- tidak ada hallucinated evidence
- reasoning sesuai rubric anchor
- tidak ada criterion terlewat

Jika sehat, review diterima.

---

# 27. Second Judge

Second Judge tidak dijalankan untuk setiap submission.

Dipakai jika:

- confidence terlalu rendah
- validator mendeteksi inconsistency
- evidence tidak cukup mendukung score
- skor/rationale suspicious
- first review ambiguity tinggi

Second Judge harus melakukan review secara independen.

Recommended initial disagreement threshold:

**>= 12 points**

Jika terlalu jauh:

`REVIEW_NEEDS_RESOLUTION`

Resolution dapat melalui Hermes adjudication atau admin review.

---

# 28. Blind Re-Review Across Attempts

Attempt berikutnya harus dinilai blind dari score attempt sebelumnya.

Flow:

1. Reviewer menilai current version secara independen.
2. Score current version dikunci.
3. Baru previous review boleh dimuat untuk membuat comparison feedback.

Tujuan: mengurangi anchoring.

---

# 29. Improvement Feedback

Setelah current review selesai, Hermes boleh menghasilkan:

### Improved
- apa yang membaik

### Still Needs Work
- apa yang masih perlu diperbaiki

Ini membuat 3-attempt system terasa seperti coaching loop.

---

# 30. User-Facing Review Output

Recommended structure:

## Overall
`82 / 100 — Strong`

## Score Breakdown
Criterion scores.

## What You Did Well
3 poin.

## Highest-Impact Improvements
3–5 poin.

## Next Attempt Priorities
Top 3 priorities.

## Evidence
Expandable detail.

Tidak perlu essay ribuan kata.

---

# 31. User Appeal

Launch rule:

**Tidak ada formal user-facing appeal feature.**

Jika ada obvious AI reviewer error:

user dapat menghubungi support.

Admin/Product Owner memiliki:

- Rerun Review
- Manual Override

Rerun dan override:

- tidak memakan user review attempt
- wajib audited
- menyimpan before/after state
- menyimpan reason
- menyimpan actor
- original review tidak dihapus

---

# 32. Fraud / Plagiarism Separation

Scoring dan fraud dipisahkan.

Fraud tidak otomatis berarti AI score = 0.

Flow:

- review score tersimpan
- fraud status = FLAGGED
- confirmed fraud dapat menjadi VOID

Jika VOID:

- leaderboard eligibility = false
- points = 0 / revoked
- audit trail dibuat

---

# 33. Weekly Leaderboard

Leaderboard global lintas divisi.

Ordering:

1. `final_score DESC`
2. `final_submitted_at ASC`

Latest valid reviewed version yang eligible saat deadline/finalization menjadi final leaderboard version.

AI reviewer tidak menghitung rank.

Backend menghitung rank.

---

# 34. Weekly Points

- Rank #1 → 300 points
- Rank #2 → 200 points
- Rank #3 → 150 points
- Rank #4+ dengan valid completion → 100 points
- No valid completion → 0 points

Points tidak expire.

Point ledger harus authoritative dan idempotent.

---

# 35. Rewards

Confirmed reward SKU:

**2,000 Arena Points → USD 20 reward**

Tidak ada fixed exchange rule `100 points = USD 1`.

Reward dapat LIMITED atau UNLIMITED.

Potential rewards lain:

- toolkit/template pack
- workshop voucher
- masterclass discount
- masterclass seat
- CV review
- portfolio review

Redemption final untuk user.

Admin emergency reversal boleh tetapi wajib audited.

---

# 36. Notification Model

Potential channels:

- IN_APP
- WEB_PUSH
- EMAIL
- WHATSAPP_COMMUNITY
- DISCORD_COMMUNITY

Initial priorities:

- Monday project drop
- deadline reminder
- review completed
- weekly result
- leaderboard
- reward status

Business state tidak boleh bergantung pada WA/Discord.

---

# 37. Admin / Product Owner Dashboard

Product Owner harus dapat mengelola Arena tanpa SSH untuk operasi normal.

Minimal capabilities:

## Weeks & Projects
- inspect AI-generated package
- edit
- veto
- regenerate
- publish/unpublish
- hold
- close/extend week

## Reviews
- queue status
- rerun
- inspect failure
- manual override

## Automation
- generator health
- retry failed
- library fallback
- evergreen fallback
- publish now
- hold

## Rewards
- catalog
- inventory
- redemption
- fulfillment
- reversal

## Users / Safety
- suspend
- fraud void
- audit trail

## Infrastructure Health
- Hermes
- Worker
- heartbeat
- queue depth
- failed jobs
- latest automation

---

# 38. Hermes Automation Architecture

Production architecture:

```text
Arena Website
      |
      v
Arena Backend
      |
      +--> Neon PostgreSQL
      |
       +--> Tencent COS (file bytes, private bucket)
      |
      +--> Internal Automation API
                   |
                   v
          Sekolah Karir VPS
                   |
            Scheduler / Worker
                   |
                   v
                 Hermes
                   |
                   v
              Model Router
                   |
                   v
              AI Providers
```

---

# 39. Hermes Security Boundary

Hermes tidak boleh memiliki direct Neon database access.

Required:

`Hermes → Arena Internal API → validation → business rules → DB`

Hermes tidak boleh memegang permanent Tencent COS credential.

Untuk file review:

1. Hermes claim review job.
2. Arena Backend verifies job.
3. Backend membuat signed GET URL.
4. URL short-lived 5–15 menit.
5. Hermes mengambil file.
6. URL expired otomatis.

---

# 40. Internal Automation API Scopes

Conceptual scopes:

- arena.projects.generate
- arena.projects.preview
- arena.projects.publish
- arena.reviews.claim
- arena.reviews.write
- arena.reviews.complete
- arena.automation.report

Tidak memberikan:

- arbitrary SQL
- delete user
- password access
- unrelated admin mutation

---

# 41. Job Queue & Leasing

Fields concept:

- status
- leased_by
- lease_expires_at
- attempt_count
- last_error
- idempotency_key

Flow:

`PENDING → LEASED → COMPLETE`

Jika worker crash:

lease expire → job claimable lagi.

---

# 42. Automation Retry

Automation retry berbeda dari user review attempt.

Contoh:

User Review Attempt #2:
- provider 500
- retry
- timeout
- fallback model
- success

Tetap `user attempt = 2`.

---

# 43. AI Model Policy

Jangan hardcode satu model/provider sebagai business dependency.

Use model profile abstraction:

## Project Generation
- creative profile
- structured output

## Project Validation
- cheaper structured profile
- deterministic

## AI Review
- stronger reasoning profile
- low temperature
- strict JSON

## Second Judge
- strong independent fallback profile

Jika provider gagal:

1. bounded retry
2. fallback
3. fail job visibly jika semua gagal

---

# 44. Hermes Skills

Recommended:

```text
skills/
├── arena-project-generator/
├── arena-project-validator/
├── arena-reviewer/
├── arena-week-finalizer/
└── arena-automation-reporter/
```

Masing-masing dapat memiliki:

- SKILL.md
- schema
- rules
- prompt templates
- examples
- failure behavior

---

# 45. Automation Audit

Semua action automation wajib dicatat.

Examples:

- generation started
- project generated
- validation failed
- regenerate
- fallback
- project ready
- publish
- review claimed
- review failed
- retry
- completed

Persist ke automation/audit storage.

---

# 46. Health & Monitoring

VPS automation harus memiliki:

- Docker restart policy
- health checks
- worker heartbeat
- queue health
- automation status
- failure alerts

Admin minimal melihat:

- Hermes ONLINE/OFFLINE
- Worker ONLINE/OFFLINE
- last heartbeat
- pending reviews
- failed jobs
- last generation result

---

# 47. Cost Guardrails

Automation harus memiliki:

- max provider retries
- max regeneration cycles
- max second-judge calls
- max job duration
- per-job cost observability
- anomaly alert
- ability to pause automation
- fallback policy

---

# 48. Data Retention

Principles:

- submission files private
- submitted version immutable
- orphan upload cleanup
- expired upload intent cleanup
- signed URL tidak disimpan permanen
- audit retention
- user account deletion workflow disiapkan

Object lifecycle:

- unconsumed upload
- draft-only object
- version-referenced object

Version-referenced object tidak boleh terhapus oleh draft replacement.

---

# 49. Incident Handling

Product Owner boleh:

- pause weekly publish
- retry failed automation
- rerun review
- use evergreen fallback
- hold project
- emergency close/extend week

High-risk infrastructure action tetap technical owner/developer:

- direct DB recovery
- production rollback
- secret rotation
- VPS host repair
- destructive migrations
- storage recovery

---

# 50. Authentication

Arena menggunakan existing Sekolah Karir authentication.

Tidak boleh ada second Arena password system.

Current architecture:

- canonical PostgreSQL-backed auth
- authorization code + PKCE
- Arena-scoped session
- JIT identity mapping

Arena tidak menyimpan password.

---

# 51. Auth Production Hardening Remaining

Sebelum production:

- distributed rate limiting
- retention scheduler
- browser E2E
- final TLS/origin/secret validation
- cookie-prefix decision

---

# 52. Database Architecture

Primary database:

**Neon PostgreSQL**

Logical schemas:

- identity
- arena
- rewards
- notifications
- automation
- audit

Core tables currently include identity, weeks, projects, skills, rubrics, enrollments, workspace, submissions, versions, review jobs, reviews, rankings, points/rewards, notifications, automation, audit, dan upload intents.

---

# 53. Current Implementation Progress

## Frontend
- Approved visual foundation exists.
- Some business state masih mock/demo.
- Full real-backend wiring belum selesai.

## Database
- Neon development connected.
- Schema live.
- Migrations applied.

Existing migrations:
- `0000_previous_thing.sql`
- `0001_pink_khan.sql`
- `0002_mysterious_wasp.sql`

## Authentication
- Implemented.
- DB-backed.
- Security audited/hardened.
- Production hardening pending.

## Core Arena Backend
Implemented:
- current week
- divisions
- projects
- enrollment
- one project/week
- cross-division selection
- deadline enforcement
- workspace
- IDOR protection
- dev seed

## Submission Backend
Implemented:
- logical submission
- mutable draft
- multi-file
- multi-link
- immutable versions
- technical access handling
- review-attempt accounting
- max 3 valid attempts
- deadline lock
- SSRF protection
- storage adapter architecture

## Storage
Cloudflare R2 blocked by billing/payment. Alibaba OSS direction superseded 2026-09-04.

Final direction (locked):
**Tencent Cloud COS (file bytes) + Neon PostgreSQL (all text/metadata/state), deployed on Vercel**

Live Tencent COS bucket provisioning still pending.

## AI Review
Business mechanics defined.
Implementation pending.

## Project Generation Automation
Business/technical architecture defined.
Implementation pending.

## Friday Finalization
Pending.

## Leaderboard
Rules defined.
Implementation pending.

## Points / Rewards
Rules defined.
Implementation pending.

## Notifications
Architecture defined.
Implementation pending.

## Admin / Automation Operations
Concept defined.
Implementation pending.

## Production
Not deployed.

---

# 54. Current Implemented API Surface

Core:
- `GET /api/arena/week/current`
- `GET /api/arena/divisions`
- `GET /api/arena/projects`
- `GET /api/arena/projects/[slug]`
- `POST /api/arena/enrollments`
- `GET /api/arena/enrollments/current`
- `GET /api/arena/enrollments/[id]`
- `GET/PATCH /api/arena/enrollments/[id]/workspace`

Submission:
- `GET/PATCH /api/arena/enrollments/:id/submission`
- `POST /api/arena/enrollments/:id/submission/links`
- `POST /api/arena/enrollments/:id/submission/uploads/presign`
- `POST /api/arena/enrollments/:id/submission/uploads/:intentId/finalize`
- `POST /api/arena/enrollments/:id/submission/submit`
- `GET/DELETE /api/arena/submission-items/:id?enrollmentId=:id`

---

# 55. Source of Truth Rules

Backend/database authoritative.

Never authorize based on:

- client userId
- URL userId
- localStorage
- DemoProvider
- frontend-only state

All user-owned resources harus server-scoped.

---

# 56. Frontend Strategy

Do not rewrite approved visual frontend unnecessarily.

Future wiring should progressively replace mock:

- current week
- projects
- enrollment
- workspace
- submission
- review
- leaderboard
- points/rewards

---

# 57. Success Metrics

Primary funnel:

`visit → login → select project → submit → valid review → repeat next week`

Core metrics:

- weekly active participants
- project selection conversion
- submission completion rate
- valid-review completion rate
- repeat participation rate
- weekly retention
- average review turnaround time
- technical failure rate
- completion by division
- review consistency
- project quality
- leaderboard participation
- reward redemption
- Career Report conversion
- Jobs/application conversion

---

# 58. Product Owner Authority

Handover receiver adalah **Product Owner yang melanjutkan build sampai production**.

Dia dapat membuat normal product/operational decisions seperti:

- project wording
- normal scheduling
- regeneration
- content improvement
- rubric anchor improvement
- community messaging
- operational retry
- minor UX improvement

---

# 59. Founder Approval / Escalation

Perubahan fundamental harus diekskalasikan:

- points formula
- monetary reward value
- reward economy
- major division changes
- fundamental deadline rule
- AI scoring philosophy
- authentication model
- privacy/data policy
- destructive infrastructure change
- substantial infrastructure spending
- major paid partnership

---

# 60. Development & Production Separation

Development dan production wajib memiliki:

- separate database target
- separate storage bucket
- separate credentials
- validated origins
- validated secrets

Never test destructive flow against production.

---

# 61. Idempotency

Required for:

- weekly generation
- publish
- automation run
- review queue
- review completion
- point distribution
- reward processing
- notifications where duplicate harmful

Example:

`generation:<week_code>:<division_slug>`

---

# 62. Friday Finalization — Future

Flow:

1. Deadline passes.
2. Week → CLOSED / FINALIZING.
3. No new submit/resubmit.
4. Pending eligible reviews finish.
5. Select latest valid reviewed version.
6. Calculate final score.
7. Exclude VOID/fraud-ineligible.
8. Sort leaderboard.
9. Apply tie-break.
10. Persist rankings.
11. Allocate points idempotently.
12. Publish results.
13. Week → FINALIZED.

---

# 63. Career Report Integration — Future

Arena should generate skill evidence such as:

- project
- division
- skill
- rubric criterion
- score
- reviewer evidence
- artifact reference
- completion date
- ranking/percentile if useful

Career Report integration is important but should not block Arena launch.

---

# 64. Jobs Integration — Future

Jobs ecosystem may provide:

- market signal
- skill demand intelligence
- opportunity recommendation
- post-Arena matching

Arena weekly availability must not depend on Jobs uptime.

---

# 65. Production Definition of Done

Arena belum production-ready hanya karena website dapat dibuka.

Critical gates:

## Authentication
- production auth
- PKCE/redirect/CSRF
- distributed rate limiting
- revalidation
- TLS/origin
- secrets

## Database
- production classification
- reviewed migrations
- constraints/indexes
- backup/recovery

## Storage
- private Tencent COS production bucket (ap-jakarta, Vercel-restricted CORS)
- signed upload/download
- IDOR safe
- restricted CORS
- cleanup
- no public permanent URL

## Submission
- draft
- multi-file/link
- immutable version
- deadline
- technical failure handling
- max 3 valid attempts
- concurrency
- ownership

## AI Review
- primary reviewer
- validator
- second judge routing
- evidence-based scoring
- rubric versioning
- provider fallback
- retries
- admin rerun/override
- audit

## Project Generation
- scheduler
- Hermes generation
- validation
- anti-duplicate
- library fallback
- evergreen fallback
- auto-publish
- reporting

## Finalization
- Friday close
- final review resolution
- final version
- leaderboard
- tie-break
- points

## Rewards
- catalog
- inventory
- redemption
- fulfillment
- reversal
- audit

## Notifications
- Monday drop
- deadline
- review result
- weekly result
- reward

## Admin
- project ops
- review ops
- automation ops
- reward ops
- user safety
- audit

## Reliability
- worker health
- Hermes health
- queue monitoring
- alerts
- retry/recovery
- cost guardrails

## Security
- final targeted review
- SSRF
- storage
- IDOR
- rate limiting
- secret hygiene
- browser E2E

Jika critical gate gagal:

**belum launch.**

---

# 66. Recommended Remaining Roadmap

## Phase 4R — Tencent COS Completion (locked, supersedes Alibaba OSS plan)
- generic S3-compatible storage adapter (done — `src/server/storage/`, Tencent-first, R2 fallback)
- live Tencent COS dev bucket (ap-jakarta, private, Vercel-restricted CORS)
- presigned PUT
- finalize
- signed GET
- cleanup
- IDOR
- concurrency

## Phase 4S — Sol Security Review
Review:
- private storage
- presigned URL
- upload intent
- storage-key attack
- IDOR
- SSRF
- DNS rebinding
- immutable versions
- attempt race
- deadline race

## Phase 5 — AI Review Pipeline
- review queue
- job lease
- Hermes reviewer
- artifact extraction
- evidence map
- validator
- second judge
- persistence
- rerun/override

## Phase 6 — Finalization + Leaderboard
- Friday close
- final version
- global ranking
- tie-break

## Phase 7 — Points + Rewards
- point ledger
- weekly award
- catalog
- inventory
- redemption
- fulfillment
- reversal

## Phase 8 — Automation + Notifications + Admin
- generator
- validator
- library/fallback
- publish
- notifications
- admin ops
- health dashboard

## Phase 9 — Frontend Real Backend Wiring
Replace mock state without unnecessary redesign.

## Phase 10 — Full Integration QA
Test complete product flow.

## Phase 11 — Production Hardening + Launch
- production env
- rate limiting
- cleanup scheduler
- browser E2E
- backup/recovery
- monitoring
- alerts
- final security review
- controlled deploy

---

# 67. Current Handover Point

```text
Frontend foundation                          DONE
Neon development DB                         DONE
DB schema/migrations                        DONE
Canonical SSO                              DONE
Auth hardening                             DONE
Core Arena Week/Project APIs               DONE
Enrollment                                 DONE
One project/week                           DONE
Workspace                                  DONE
Submission draft                           DONE
Multi-file / multi-link                    DONE
Immutable versions                         DONE
3 valid review attempts logic              DONE
SSRF guard                                 DONE
Tencent COS live integration (bucket provisioning)               NEXT
Storage/IDOR/concurrency final testing      NEXT
AI reviewer                                NEXT
Hermes review worker                       NEXT
Weekly project generation automation       NEXT
Friday finalization                        NEXT
Leaderboard                                NEXT
Points/rewards backend                     NEXT
Notifications                              NEXT
Admin automation tools                     NEXT
Full frontend backend wiring               LATER
Production hardening                       FINAL
Production deploy                          NOT YET
```

---

# 68. Important Do-Not-Rebuild Decisions

Do not unnecessarily replace:

- Neon PostgreSQL
- current SSO bridge
- current database schema
- approved frontend visual foundation
- one-project/week rule
- immutable submission model
- max 3 valid review attempts
- Friday 23:59 WIB deadline
- global leaderboard
- points formula
- 2,000 points → USD 20 reward SKU
- Hermes-through-internal-API architecture
- no direct Hermes DB access

---

# 69. Security Non-Negotiables

Never:

- expose DB credentials client-side
- expose OSS secret client-side
- grant Hermes permanent DB credential
- grant Hermes permanent OSS credential
- trust client userId
- trust browser clock
- use permanent public file URLs
- generic-fetch user URL without SSRF guard
- increment review attempt on technical failure
- increment user attempt due to provider retry
- mutate old submission versions
- delete audit history to hide override
- execute destructive production migration without explicit review
- allow reward/points writes outside idempotent backend logic

---

# 70. Product Principles

## Real Work Over Gamification
Points/leaderboard support motivation, but value utama adalah artifact, skill evidence, feedback, portfolio, dan improvement.

## AI Is a Worker, Not Source of Truth
AI generates/evaluates. Backend controls business state, ranking, points, rewards, access, and permissions.

## Recoverable Automation
Every automation should retry safely, be idempotent, show failure, support human recovery, and preserve audit history.

## User Failure ≠ Infrastructure Failure
Storage/model/worker/internal failure tidak boleh mengurangi user attempt.

## Portfolio Quality Matters
Project quality dan reviewer consistency lebih penting daripada project volume.

---

# 71. Open Operational Items Before Production

Items yang masih dapat dituning selama build:

- exact Sunday generation clock
- exact Monday publish clock
- production review SLA wording
- actual provider/model selection
- second-judge confidence threshold
- disagreement threshold tuning
- max automation budget
- reward fulfillment method
- notification rollout order
- account deletion retention details
- backup cadence
- incident severity matrix

Default rules in this PRD digunakan sampai ada alasan kuat untuk mengubah.

---

# 72. Master Acceptance Criteria

Arena MVP/Launch dianggap berhasil ketika:

1. User authenticate dengan Sekolah Karir account.
2. User melihat current week.
3. User browse weekly projects.
4. User memilih satu project.
5. User menggunakan workspace.
6. User submit file/link.
7. Private storage works.
8. Technical failure tidak membuang review attempt.
9. Maksimal 3 valid AI reviews bekerja.
10. Review evidence-based.
11. Generator menghasilkan safe weekly projects.
12. Generator recovery/fallback works.
13. Friday deadline authoritative.
14. Leaderboard deterministic.
15. Points idempotent.
16. Rewards dapat diproses.
17. Product Owner dapat operate lewat admin.
18. Hermes/worker observable.
19. Production security gates pass.
20. Core user flow tidak membutuhkan manual SSH.

---

# 73. Final Handover Statement

Side Hustle Arena adalah **project yang sudah berjalan, bukan greenfield**.

Foundation, database, authentication, core Arena APIs, enrollment, workspace, serta sebagian besar submission backend sudah tersedia.

Product Owner yang menerima handover harus:

1. Preserve locked business rules.
2. Continue from current implementation.
3. Finish Tencent COS live integration (bucket provisioning + Vercel CORS).
4. Complete storage/security validation.
5. Build AI Reviewer + Hermes worker.
6. Build weekly project-generation automation.
7. Build finalization, leaderboard, points, rewards, notifications, dan admin operations.
8. Wire approved frontend ke authoritative backend.
9. Complete production hardening.
10. Launch hanya setelah Production Definition of Done terpenuhi.

Guiding product statement:

> **Side Hustle Arena gives users real weekly projects, actionable feedback, and proof of skill they can carry into their career.**
