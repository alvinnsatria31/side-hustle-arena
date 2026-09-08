# Audit implementasi Side Hustle Arena — 8 September 2026

> **STATUS: SUDAH DITINDAKLANJUTI.** A01–A07 di dokumen ini sudah diperbaiki
> pada hari yang sama. Baca [`REMEDIATION_2026-09-08.md`](./REMEDIATION_2026-09-08.md)
> untuk apa yang berubah, test mana yang membuktikannya, dan apa yang masih
> terbuka. Dokumen ini dipertahankan sebagai catatan temuan pada `1b8affb` —
> bukan sebagai status terkini. Kalau keduanya berbeda, dokumen remediasi lebih
> baru.
>
> Ringkasan singkat: A01 (snapshot immutable + verifikasi checksum), A02 (lease
> atomik, sweeper, recovery admin), A03 (fallback versi tereview), A04
> (`EXECUTION_CONTRACT` tunggal), A05 (flush email tiap 15 menit + drain
> berbudget), A06 (validator menolak placeholder, tag `NEEDS_CURATION`), A07
> (`true-e2e-test.mjs` dihapus, diganti harness integrasi lokal). Selain itu:
> pipeline Jobs end-to-end, atribusi skill per kriteria, consent Showcase,
> penghapusan akun, spend cap CV, dan suite browser lokal.

Baseline: `1b8affb` di `main`. Cakupan: 48 Markdown di `docs/` (43 backend, 5 PRD/plans), README, AGENTS/CLAUDE, README E2E, graph lokal, history terbaru, serta penelusuran route/service/UI/schema/test yang terkait requirement. Audit ini menilai kelengkapan implementasi terhadap rencana; bukan pembacaan baris-per-baris setiap file aplikasi atau penetration test menyeluruh.

Kode aplikasi tidak diubah. Tidak menjalankan migrasi, seed, workflow live, pengiriman email, inference berbayar, payout, atau deployment. Working tree awal hanya memiliki `.claude/` untracked dan dipertahankan. Graph lama dipakai sebagai orientasi lalu dikoreksi terhadap source saat ini.

## Kesimpulan

Ini aplikasi full-stack, bukan prototype frontend. Sebagian besar permukaan core Arena sudah terhubung ke backend. Namun **belum layak diberi status selesai end-to-end / production-ready**, karena ada gap correctness dalam integritas file, recovery review, pemilihan hasil final, dan cadence email; ditambah integrasi live yang belum diverifikasi dalam audit ini.

Jangan menganggap semua kotak kosong di rencana lama sebagai pekerjaan baru: banyak sudah diimplementasikan. Sebaliknya, jangan menganggap helper yang sudah diuji berarti helper tersebut sudah terhubung ke alur produk. Snapshot file merupakan contoh konkret kesalahan kedua.

## Arti checklist

- `[x]` = implementasi yang disebut tersedia dan terhubung berdasarkan source; batas verifikasi tetap berlaku.
- `[ ] SEBAGIAN` = fondasi tersedia tetapi ada bagian, correctness, atau integrasi yang belum selesai.
- `[ ] BELUM` = implementasi requirement belum ditemukan dalam cakupan repo.
- `[ ] LIVE` = memerlukan bukti environment eksternal; bukan klaim bahwa layanan tersebut pasti mati atau belum dipasang.

## Checklist implementasi

### Foundation, data, identitas

- [x] Next.js 16.3.3, React 19.2, TypeScript, App Router, frontend publik/peserta/admin. Bukti: `package.json`, `src/app/`.
- [x] PostgreSQL/Drizzle, schema identity/Arena/reviews/ranking/rewards/notification/automation/audit/ops/CV; migrasi `0000`–`0011`. Kontrak schema repo lolos. Bukti: `src/server/db/schema/`, `drizzle/meta/_journal.json`.
- [x] Login memakai akun Sekolah Karir: shared `sk_participant` HS256, provisioning berdasarkan `sk-participant:<id>`, guard server, status suspend lokal. Bukti: `src/server/auth/{session,participant-session,participant-token,participant-provision}.ts`.
- [x] Popup login, fallback navigasi, polling sesi, avatar onboarding, serta POST logout dengan origin check. Bukti: `src/lib/sign-in-popup.ts`, `src/app/auth/`, `src/components/arena/AvatarPickerModal.tsx`.
- [x] Admin terpisah dari peserta/worker: allowlist subject, scope, token admin terpisah dan actor dari guard. Bukti: `src/server/admin/auth.ts`, `scripts/admin-auth.test.mjs`.
- [ ] SEBAGIAN — Bridge PKCE/opaque session tersimpan sebagai jalur lama, bukan login aktif. Callback dan pembuat session masih ada, tetapi `getCurrentUser()` hanya membaca participant JWT. Jangan mengklaim bridge ini drop-in siap aktif tanpa rewiring/testing.
- [ ] LIVE — Login situs utama → Arena, cookie domain/secret parity, logout, pencabutan sesi dan suspend lintas sistem. Tes browser utama masih `fixme`.
- [ ] SEBAGIAN — Hardening auth aktif: logout sekarang menghapus cookie browser, tidak mencabut salinan JWT di perangkat lain; introspection 60 detik dari audit bridge lama tidak berlaku pada jalur ini. Kontrak revocation dan throttling situs penerbit perlu diperiksa bersama repo main-site.

### Arena peserta dan submission

- [x] Current week, divisi aktif, browse/filter/detail project dari DB. Bukti: `src/server/arena/{week-service,project-service}.ts`, `src/lib/arena-view.ts`.
- [x] Satu project/user/week, pemilihan lintas divisi, retry project sama dan penolakan switching, constraint DB. Bukti: `src/server/arena/enrollment-service.ts`, schema `arena-core.ts`.
- [x] Workspace tersimpan: plan, task/checklist, tools, notes; ownership dan pemeriksaan deadline server. Bukti: `src/server/arena/workspace-service.ts`.
- [x] Draft, file/link, requirement per project, limit 5 file/5 link/20 MiB, presign/finalize upload, technical access check dan alokasi maksimum review. Bukti: `src/server/submissions/{service,schemas,url-access}.ts`.
- [x] SSRF guard: HTTPS, DNS/address validation, pinning, pemeriksaan redirect, response/time bounds. Keberadaan kontrol tidak menggantikan attack test live terbaru.
- [x] Versi metadata submission disalin, draft berikutnya tidak mengganti baris versi lama; quota diupdate atomik. Bukti: `createVersion()` / `submitArenaSubmission()`.
- [x] Dashboard, profile/avatar, histori enrollment, hasil, leaderboard, inbox dan redeem membaca API nyata. Bukti: `src/components/arena/Participant*.tsx`, `src/lib/arena-client.ts`, `src/server/arena/participant-service.ts`.
- [ ] SEBAGIAN — Byte file versi submission belum immutable dalam alur produk. Helper snapshot tidak dipanggil; lihat A01.
- [ ] SEBAGIAN — Private download tersedia, tetapi tidak ada checksum verification pada jalur download langsung/reviewer yang membuktikan file sama dengan saat submit; lihat A01.
- [ ] SEBAGIAN — Cleanup menghapus expired unconsumed upload intents yang tidak direferensikan. Orphan dari consumed intent yang gagal dihapus setelah draft deletion tidak tercakup karena query mensyaratkan `consumedAt IS NULL`. Bukti: `src/server/storage/cleanup.ts`, `deleteArenaSubmissionItem()`.
- [ ] SEBAGIAN — Login dari detail belum otomatis menyelesaikan enrollment; bookmark masih localStorage. Ini keputusan UX kecil, bukan backend belum tersedia. Bukti: `src/components/arena/ProjectDetail.tsx`.
- [ ] SEBAGIAN — Resource URLs dari generation package belum muncul pada project detail peserta: `src/lib/arena-view.ts:206` tetap mengembalikan `resources: []`.
- [ ] LIVE — COS privacy/CORS/presign/upload/download/replay PUT pada target rilis sekarang. Bukti historis ada, tidak dijalankan ulang di audit ini.

### AI review, finalisasi, poin

- [x] Queue/claim, transaction lock, lease, retry/backoff, validasi evidence source-id + kutipan, weighted scorer, second judge, rerun/override dan audit. Bukti: `src/server/reviews/`, offline suites terkait.
- [x] Provider OpenAI-compatible nyata; stub hanya development; provider profile terpisah. Sudah bukan stub-only seperti catatan Phase 5 lama.
- [x] Ekstraksi dokumen dan OCR gambar, snapshot teks evidence di DB. Bukti: `src/server/reviews/{extract,artifacts}.ts`.
- [ ] SEBAGIAN — Recovery worker/failure belum aman untuk seluruh lifecycle; stale failure dapat membuka ulang completed job dan crash attempt terakhir dapat macet. Lihat A02.
- [ ] SEBAGIAN — Time budget review belum mencakup claim/ekstraksi; claim/complete pada jalur n8n masih menjalankan sebagian pekerjaan di Arena. Lihat A04.
- [ ] SEBAGIAN — Input reviewer hanya membawa title/division/rubric/submission/sources, tidak brief lengkap (mission/objective/case background). OCR teks juga belum membuktikan penilaian visual UI/UX atau functional correctness situs berjalan. Bukti: `buildJobInput()`, `reviewer-input.ts`, `extract.ts`, prompt workflow n8n.
- [ ] SEBAGIAN — Provenance model n8n tidak tersimpan spesifik: complete route tidak menerima/meneruskan model; `reviewModel` menjadi `external-worker`. Bukti: `src/app/api/internal/reviews/complete/route.ts`, `queue-service.ts:365`.
- [x] Close/finalize, hasil disegel sampai finalisasi, ranking deterministik, transaksi ranking/ledger/account, poin 300/200/150/100, void dan reversal. Bukti: `src/server/finalization/`, `src/server/rewards/accounting.ts`.
- [ ] SEBAGIAN — Pemilihan versi final belum selalu memilih latest *successfully reviewed* version; kegagalan attempt baru dapat menghilangkan hasil valid lama. Lihat A03.
- [x] Skill evidence ditulis saat finalisasi dan ditautkan ke ranking/review; dibaca Career Report dan Jobs.
- [ ] SEBAGIAN — Skor skill masih skor project keseluruhan yang disalin ke tiap project skill, belum evidence/score per skill-per-criterion. Bukti: `src/server/finalization/service.ts:274`.
- [ ] LIVE — Kualitas reviewer per jenis artefak, independent judge/model config, timeout/outage, full loop sampai leaderboard tanpa stub.

### Generator dan automation

- [x] Validasi package, frozen base rubric, fingerprint/token similarity, window 8–12 minggu, tiga percobaan, HIGH_QUALITY/EVERGREEN fallback. Bukti: `src/server/generation/{core,service,ai-provider}.ts`.
- [x] Preview/edit/approve/veto/regenerate/publish/hold; kegagalan divisi dapat dilaporkan terpisah; generation dan publication memiliki job berbeda.
- [x] Admin Trigger Workflow untuk rilis manual/off-schedule. Bukti: `src/server/admin/launch.ts`, `/app/admin/workflows`, `src/components/admin/TriggerWorkflow.tsx`.
- [x] Bootstrap library tersedia, tetapi hasilnya belum otomatis layak kurasi. Bukti: `scripts/bootstrap-generation-library.mjs`.
- [ ] SEBAGIAN — Bootstrap memasukkan `[PLACEHOLDER]` lalu menandai package HIGH_QUALITY; validator tidak menolak marker. Bisa menjadi fallback yang tervalidasi secara struktur tanpa layak terbit. Lihat A06.
- [ ] SEBAGIAN — Generation enam divisi sequential dengan sampai 3 × 15 detik/provider per divisi; belum ada budget seluruh invocation/checkpoint per-divisi untuk route cron 60 detik. Perlu uji slow provider dan recovery run sebelum otomatisasi dianggap andal.
- [ ] BELUM — Ingestion market signal eksternal; taxonomy context yang kaya (provider menerima skill IDs, belum nama/deskripsi skill); evaluasi kualitas library berdasarkan completion/distribution/feedback. Schema/fingerprint bukan pengganti context engine PRD §8/§10.
- [ ] LIVE — Enam divisi dan bobot rubric PRD benar-benar dikurasi di DB target. Seed development hanya tiga divisi; bootstrap mengambil rubric project yang sudah ada, tidak membuktikan kesesuaian enam rubric PRD.
- [x] Paket n8n scheduler dan grading claim → model → complete/fail tersedia. Arah terbaru: n8n pull di VPS Sekolah Karir, scheduler tidak menjalankan `reviews-run`; fallback manual tetap tersedia.
- [ ] LIVE — Import/activation/execution n8n asli, cutover workflow legacy Supabase, token/origin parity, dan menonaktifkan push hook lama sesuai `N8N_SEKOLAH_KARIR_MIGRATION.md`. File JSON bukan bukti workflow aktif.
- [ ] BELUM — Heartbeat worker/Hermes, alert otomatis, biaya/token per job, anomaly budget dan dashboard operasional lengkap. Queue depth/audit/config readiness sudah tersedia, tetapi tidak sama dengan monitoring runtime.

### Rewards, notifikasi, admin

- [x] Catalog, milestone, redemption, debit saldo/reservasi stok, manual fulfillment reference, reversal/refund dan riwayat. Bukti: `src/server/rewards/`, profile dan halaman admin rewards.
- [ ] LIVE — Reward USD 20 benar-benar diterima peserta: metode, operator, stock, budget dan bukti delivery. Tombol fulfill mencatat status/reference, tidak mengirim uang.
- [ ] SEBAGIAN — Voucher push punya adapter HTTP tetapi kontrak main-site masih pending. Jangan menyamakan konfigurasi token dengan integrasi tervalidasi. Bukti: `src/server/rewards/voucher-push.ts`.
- [x] Inbox/read/unread, outbox email durable, backoff/lease, frozen message, idempotency, scheduled notices, admin held/failed/requeue/cancel. Bukti: `src/server/notifications/`, `/app/admin/email`.
- [ ] SEBAGIAN — Cadence email tidak sesuai dengan jendela retry 23 jam; batch pengumuman 100 memerlukan tick lebih sering. Lihat A05.
- [ ] LIVE — Sender/domain/API key dan delivery email nyata; pengujian di audit ini tidak mengirim email.
- [ ] BELUM — Web push, WhatsApp, Discord/community delivery bila dipilih untuk rollout. PRD menyebut kanal potensial, bukan semuanya wajib MVP.
- [x] Console admin: overview, weeks, project editor, divisions, workflows/jobs, users/suspend, reviews, rewards, flags, email, audit search. Bukti: `src/app/(app)/app/admin/`, `src/server/admin/`.
- [ ] SEBAGIAN — Recovery first review gagal belum didukung rerun admin biasa (`rerunReview` membutuhkan existing review); tidak ada browser coverage console lengkap.

### CV, Career Report, Jobs, showcase

- [x] CV scan PDF/DOCX nyata, provider tersendiri, result/error/rate-limit mapping dan feature flag. Bukti: `src/server/cv/analyzer.ts`, `src/app/api/cv-scan/route.ts`.
- [x] Riwayat CV opt-in, owner-only read/delete, retensi 50, tanpa menyimpan raw file. Bukti: `src/server/cv/history.ts`, migrasi `0010`.
- [x] Rate limit CV berbagi counter PostgreSQL; pruning lewat session-cleanup. **Koreksi audit 7 September: sudah bukan memory-only.** Bukti: `src/server/cv/rate-limit.ts`, migrasi `0011`.
- [ ] SEBAGIAN — Saat DB limiter gagal, fallback memory per instance masih melemahkan proteksi. Belum ada pembuktian concurrency DB live terbaru untuk limiter; tes offline memakai counter tiruan. Kapasitas provider/global spend cap juga belum terbukti.
- [x] Career Report API/UI dari hasil final, evidence, poin, histori dan tren; latest saved CV sudah tersambung, dengan klaim CV dipisahkan dari bukti Arena. **Koreksi audit 7 September: integrasi CV sudah ada.** Bukti: `src/server/career/{report-service,report}.ts`.
- [ ] SEBAGIAN — Rekomendasi latihan personal, normalisasi taxonomy lintas CV/Arena, export/pagination/retensi configurable belum lengkap.
- [x] Jobs API authenticated, matching skill evidence dan filtering jujur.
- [ ] BELUM — Feed lowongan nyata dan application flow. Enam sample fiktif tetap menjadi sumber catalog (`src/server/career/jobs-matching.ts`), diberi label jelas; bukan enam lowongan live.
- [x] Showcase list/detail berdasarkan minggu FINALIZED; tidak menerbitkan file privat/feedback review. Bukti: `src/server/finalization/showcase-service.ts`.
- [ ] BELUM — Case study naratif peserta, authoring dan consent publikasi artefak.

### QA dan release

- [x] CI GitHub tersedia: typecheck, lint, schema contract, offline tests, production build. Bukti: `.github/workflows/ci.yml`. **Koreksi audit 7 September: CI sudah ditambahkan.** Eksekusi CI remote belum diperiksa.
- [x] Local sandbox PostgreSQL/MinIO, dev session/stub guard dan script bootstrap tersedia. Bukti: `compose.local.yml`, `scripts/local-dev.mjs`, `src/server/dev/guard.ts`.
- [x] Playwright suite tersedia untuk Arena lokal, public header, avatar. Hasil run historis dibedakan dari audit ini.
- [ ] SEBAGIAN — Dua `test.fixme` (main-site sign-in, external AI), browser Career/Jobs/CV/admin, DB/service integration suites dan failure injection belum diverifikasi ulang di sesi ini.
- [ ] SEBAGIAN — `true-e2e-test.mjs` bukan bukti full browser/business E2E, punya kredensial sandbox hardcoded dan tanpa cleanup; lihat A07.
- [ ] SEBAGIAN — Lint masih 27 warning; termasuk 10 unused variables dari script true-E2E dan warning React effects/dependencies/ref cleanup/navigasi.
- [ ] LIVE — Vercel deployment yang benar, migrasi sampai `0011`, private bucket, origins/secrets, data awal, admin scopes, flags dan workflow aktif.
- [ ] LIVE — Backup/restore drill, rollback/cutover, incident owner, monitoring/alert dan batas biaya produksi.
- [ ] BELUM — Workflow account deletion dan aturan retensi audit/data peserta menyeluruh; analytics funnel/retention/conversion PRD §57 belum ditemukan sebagai instrumentasi produk lengkap.
- [ ] SEBAGIAN — Rekonsiliasi dokumentasi: PRD progress, historical status, auth, storage setup dan automation saling bertentangan.

## Temuan yang harus diprioritaskan

### A01 — P1: file submitted version masih dapat berubah

`finalizeArenaUpload` mengecek magic bytes tetapi tidak menyimpan checksum hasil baca (`src/server/submissions/service.ts:197`). `createVersion` menyalin `storageKey` draft secara langsung (`:255`). `createImmutableSnapshot` hanya ditemukan sebagai implementasi/helper dan pemanggilan dalam tes; tidak dipakai oleh submit. Reviewer kemudian membaca object key tersebut dan mengecek ukuran saja (`src/server/reviews/artifacts.ts:27`), lalu membuat hash atas bytes yang baru dibaca.

Skenario: presigned PUT yang masih berlaku dipakai ulang mengganti object dengan bytes lain berukuran sama sesudah finalize/submit tetapi sebelum review. Baris version tetap, isi yang dinilai berubah. Snapshot teks setelah claim tidak membuktikan konten saat submit. Ini temuan source, bukan replay yang dijalankan ke COS live.

Selesai jika alur submit mengikat file ke snapshot/version/checksum yang tidak dapat ditimpa oleh URL upload draft, dan tes integrasi membuktikan replay PUT tidak mengubah file versi/review/download.

### A02 — P1: recovery lease/failure belum konsisten

`claimReviewJob` hanya memilih `attemptCount < 5` (`src/server/reviews/queue-service.ts:91`). Jika worker mati setelah claim ke-5, PROCESSING dengan lease kedaluwarsa tidak dapat diambil lagi; tidak ditemukan sweeper terminal untuk keadaan itu. Finalisasi tetap menolaknya sebagai open job (`src/server/finalization/service.ts:174`). Rerun admin mensyaratkan review sebelumnya (`src/server/reviews/admin.ts:37`), sehingga first review yang gagal/macet tidak memiliki recovery biasa lewat tombol rerun.

Selain itu, `failReviewJob` hanya memeriksa `lockedBy`, tanpa status PROCESSING, waktu lease, atau conditional write (`queue-service.ts:505`). Workflow selalu memakai workerId `n8n-grading`. **Probe offline dengan service asli + DB tiruan membuktikan job COMPLETED dengan expired lease diubah kembali menjadi RETRY oleh late fail.** Completion mempunyai guard lebih kuat; fail belum setara.

Selesai jika fail/complete mengikat satu lease yang masih sah secara atomik, stale callbacks ditolak, exhausted crash berakhir terminal/recoverable dan operator dapat memulihkan first-review failure tanpa SQL manual.

### A03 — P1: valid review lama hilang jika attempt terbaru gagal

`collectEligibleFinalists` memilih version terbaru yang mempunyai `reviewAttemptNumber`, lalu mencari review hanya untuk version itu (`src/server/finalization/service.ts:104`). Jika V1 sudah punya review valid, lalu V2 lolos access gate tetapi model gagal permanen, V2 punya attempt number tanpa review valid. Fungsi melewati peserta seluruhnya, tidak mencoba V1.

Ini tidak memenuhi PRD §33/§62 latest valid reviewed version dan prinsip infrastructure failure tidak merugikan peserta. Selesai jika fallback ke versi reviewed eligible sebelumnya atau ada kebijakan resolusi eksplisit yang mencegah finalisasi menghilangkan completion valid; uji V1 sukses + V2 terminal failure.

### A04 — P1: batas durasi belum berlaku end-to-end

`runConfiguredReviewJob` membuat AbortSignal **setelah** `await claimReviewJob()` (`src/server/reviews/worker.ts:58`). Claim mengekstrak artefak sebelum return, sehingga budget drain 45 detik tidak mencakup ekstraksi. Parser/OCR punya batas sendiri dan dapat dipanggil beberapa kali secara sequential. Claim n8n bahkan hanya menunggu 30 detik (`arena-grading-workflow.json:46`). Complete n8n masih dapat memanggil second judge di Arena dan tidak menerima shared signal/maxDuration eksplisit.

Generation juga sequential antar divisi, masing-masing dapat menghabiskan 3 × 15 detik, sementara cron route menetapkan `maxDuration = 60`. Memindahkan primary review ke VPS belum memindahkan extraction, judge, maupun generator. Batas platform sesungguhnya belum diverifikasi; dokumen Next lokal menyatakan host menentukan enforcement maxDuration.

Selesai jika budget mencakup pekerjaan penuh, atau job dipecah/dipindahkan sehingga slow extraction/model tetap selesai/retry secara aman di deployment target. Tes diperlukan untuk slow source/primary/judge dan beberapa divisi.

### A05 — P1 untuk kanal email: tick harian melewati retry window

`n8n/arena-trigger-workflow.json:134` menjadwalkan email-flush sekali sehari 08:00 WIB; `vercel.json` juga sekali sehari pada jam yang sama. `retryExpired` menahan pesan setelah 23 jam (`src/server/notifications/outbox-policy.ts:9`). Email gagal pada tick hari ini tidak mendapat retry terjadwal sebelum besok, ketika sudah expired untuk auto-retry. Probe offline mengonfirmasi `retryExpired(t0, t0+24h) === true`.

Notifikasi pengumuman/reminder juga dibatasi 100 penerima per tick. Jadwal harian tidak menjamin backlog selesai sebelum deadline. Selesai jika cadence worker cocok dengan backoff/23h window dan volume penerima; verifikasi gagal-kemudian-sukses sebelum window habis serta >100 penerima.

### A06 — P2: placeholder dianggap HIGH_QUALITY

`scripts/bootstrap-generation-library.mjs:39` membuat filler `[PLACEHOLDER]`; registration memakai tag HIGH_QUALITY (`:127`). `validatePackage` mengecek struktur/policy tetapi tidak menolak placeholder. Library fallback memakai validator yang sama, sehingga konten bootstrap berpotensi terbit otomatis setelah lolos aturan waktu/duplicate.

Selesai jika bootstrap hanya mendaftarkan template benar-benar dikurasi atau template belum layak ditahan dari fallback/publication. Jangan menyalakan auto-publish hanya karena bootstrap berhasil.

### A07 — P2: cakupan dan isolasi true-E2E terlalu lemah

`scripts/true-e2e-test.mjs` memanggil service langsung dengan stub, upload tidak dijalankan, finalisasi dipaksa sebelum deadline, mismatch jumlah poin dilabeli INFO, dan tidak ada cleanup fixture sebelum process.exit. Worker mengambil antrean global, bukan job fixture spesifik. File juga menanam nilai credential sandbox dan session secret, sehingga tidak mengikuti credential acak setiap setup. Nilai tidak disalin ke laporan ini; belum ada bukti nilai itu dipakai production.

Selesai jika memakai env sandbox yang terisolasi, assertion bisnis ketat, job target/fixture jelas dan cleanup pada sukses/gagal; pisahkan nama/klaim service smoke dari browser/live-provider E2E. Audit tidak menjalankan script ini.

## Koreksi dokumen / keputusan yang jangan dibangun ulang

| Referensi | Cara membacanya sekarang |
| --- | --- |
| Master PRD §53/§67 dan IMPLEMENTATION_STATUS | Progress historis; reviewer/generator/admin/CV/leaderboard sudah punya implementasi. Business rules tetap referensi, progress bukan status terbaru. |
| AUTH_* dan plan auth 2 September | Menjelaskan Workspace PKCE lama. Jalur aktif ada di PARTICIPANT_SESSION dan source participant JWT. Audit security bridge tidak otomatis menjamin jalur shared-cookie. |
| Audit 7 September | README, CI, CV→Career Report dan distributed CV limiter sudah ditangani; timeout baru ditangani sebagian. Jobs tetap sample. |
| N8N_TRIGGER_ONLY vs N8N_SEKOLAH_KARIR_MIGRATION | Dokumen migration + JSON terbaru: scheduler tidak drain reviews; workflow grading di VPS menjadi primary. Trigger-only masih menjelaskan reviews-run dua menit dan dua token, padahal guard sekarang juga menerima ARENA_CRON_TOKEN. |
| END_TO_END_IMPLEMENTATION / CODEX_HANDOFF | Bukti historis berguna, tetapi klaim snapshot/checksum lengkap dibatasi A01. Banyak header lama menyebut belum deploy sementara paragraf berikut menyebut first production deployment; jangan tarik status live dari gabungan catatan ini. |
| TENCENT_COS_SETUP | Masih memakai nama TENCENT_COS_* dan localhost:3000; canonical config sekarang STORAGE_* dan local Arena :3001. Ikuti config parser/current .env.example sebelum provisioning. |
| STORAGE_OPERATIONS | Mengatakan integrasi helper masih pending; ini selaras dengan A01. Catatan dependency/remaining steps lama perlu diselaraskan. |
| N8N dry-run | Nama menyesatkan untuk audit: script memanggil cron sungguhan yang menulis data/mengirim email/memanggil AI. Jangan jalankan ke live sebagai read-only check. |
| Career completion plan | Empat deliverable inti ada. Kotak integration/delivery tetap sebagian: coverage browser career belum ada, dokumentasi belum konsisten. |

Formal user appeal, auto payout provider, seluruh community channel, Jobs feed, dan case-study authoring tidak boleh dianggap fitur inti yang hilang tanpa membedakan scope MVP dari fase lanjutan. Pertahankan satu project/week, 3 attempt, ranking global, poin 300/200/150/100 dan reward 2.000 poin→USD20.

## Verifikasi baru pada audit ini

| Pemeriksaan | Hasil | Batas |
| --- | --- | --- |
| `npm run typecheck` | Lolos | Source/type, bukan runtime integration |
| `npm run db:check` | Lolos | Schema repository vs migrasi, bukan DB target |
| `npm run lint` | Exit 0, 0 error / 27 warning | Bukan zero-warning |
| `npm run test:offline` | Exit 0, 167 pass / 0 fail | 25 file suite dijalankan, 21 file suite dikecualikan runner; summary `skipped=0` hanya untuk test yang dipilih |
| `npm run build` | Exit 0, compiled/static generation/traces selesai | Warning parent lockfile diabaikan; bukan bukti deploy/DB/credentials production |
| Probe late-fail offline | COMPLETED → RETRY diterima | Service asli, DB tiruan; tidak mengakses DB live |
| Probe cadence email offline | Retry 24h sudah expired | Pure policy helper, tidak mengirim pesan |

Tidak dijalankan: browser, DB live, COS live, real AI, n8n live, email nyata, payout, restore/rollback. Bukti run historis di Markdown tidak diklaim sebagai hasil run hari ini. Tidak memberi persentase completion karena bobot correctness, UI, fitur dan operasi berbeda. CLI handoff `brain` tidak tersedia di PATH maupun lokasi skill/lokasi user saat ini; laporan repository ini menjadi handoff audit.

## Input yang dibutuhkan dari owner

**Untuk audit lokal ini: tidak ada credential tambahan yang dibutuhkan.** Untuk menutup pekerjaan berikutnya:

1. **Scope rilis:** Arena core dahulu atau sekaligus CV/Career/Jobs; tanggal target dan perkiraan peserta/volume review. Ini menentukan acceptance dan kapasitas, bukan alasan menunda A01–A07.
2. **Target staging/live yang benar:** konfirmasi apakah Vercel `side-hustle-arena`, domain `arena.sekolahkarir.id`, dan VPS SK `129.226.94.253` di dokumen terbaru masih target. Identifikasi DB branch dan bucket staging/production serta akses akun/operator yang tersedia; tidak perlu membuat credential baru kalau sudah ada.
3. **Akun uji:** satu peserta dan satu admin canonical; daftar scope admin. Untuk OTP/login, user dapat menyelesaikan login sendiri dalam sesi browser. Jangan kirim password, OTP atau cookie lewat dokumen.
4. **Main-site auth:** lokasi repo/deployment aktif dan pemilik konfigurasi session/cookie; putuskan perilaku revocation/logout lintas perangkat yang diterima.
5. **AI dan automation:** model/provider primary/judge/CV yang dipakai, batas biaya dan SLA; akses n8n staging atau export terbaru untuk membuktikan workflow sebenarnya. Konfigurasi secret di environment/secret manager, cukup bagikan lokasi/nama key.
6. **Rewards:** manual transfer atau provider, operator fulfillment, stok/budget USD20, informasi penerima yang perlu dikumpulkan dan kebijakan reversal. Voucher contract hanya jika SKU voucher akan diaktifkan.
7. **Email dan operasi:** sender/key location, inbox uji milik tim, incident owner, backup/restore/rollback target.
8. **Jika scope career penuh:** sumber Jobs feed/portal, izin pemakaian datanya, serta kebijakan consent publikasi portfolio dan retensi/account deletion.

Urutan yang disarankan: tutup A01–A05 dan guard konten A06 → kuatkan QA A07 + DB/browser fixture terisolasi → verifikasi satu siklus staging nyata termasuk failure/recovery → verifikasi cron/grading/email, stock/admin/monitoring/restore → keputusan rilis. Jobs feed/portfolio naratif dapat menyusul jika rilis pertama Arena-only.

## Inventaris dokumen yang direkonsiliasi

Seluruh 5 file di `docs/superpowers/plans/`: master PRD; auth bridge 2026-09-02; core API dan submissions 2026-09-03; career completion 2026-09-07.

Seluruh 43 file backend sebelum laporan ini dibuat:

`ADMIN_OPERATIONS`, `ARENA_CORE_API`, `ARENA_SERVICE_ARCHITECTURE`, `ARENA_SUBMISSIONS_API`, `AUTH_CONTRACT_AUDIT`, `AUTH_IMPLEMENTATION`, `AUTH_INTEGRATION_CONTRACT`, `AUTH_REMEDIATION_PLAN`, `AUTH_SECURITY_AUDIT_SOL`, `AUTH_SECURITY_BOUNDARY`, `AUTH_SECURITY_REREVIEW_SOL`, `BACKEND_AUDIT`, `CODEX_HANDOFF_AUDIT_2026-09-06`, `CURRENT_IMPLEMENTATION_AUDIT_2026-09-05`, `CV_HISTORY`, `DATABASE_ARCHITECTURE`, `DATABASE_SCHEMA_REFERENCE`, `DB_BACKED_SSO_INTEGRATION_REPORT`, `DEVELOPMENT_DATABASE_SETUP`, `END_TO_END_IMPLEMENTATION`, `FINALIZATION`, `FRONTEND_BACKEND_CONTRACT`, `FRONTEND_CHECKPOINT`, `FRONTEND_WIRING_9A`, `HERMES_EVAL_CONTRACT`, `IMPLEMENTATION_AUDIT_2026-09-07`, `IMPLEMENTATION_STATUS`, `JOBS_IMPLEMENTATION`, `LOCAL_DEVELOPMENT`, `N8N_GRADING_WORKFLOW`, `N8N_SEKOLAH_KARIR_MIGRATION`, `N8N_TRIGGER_ONLY`, `NOTIFICATIONS_ADMIN`, `PARTICIPANT_SESSION`, `PARTICIPANT_UI_IMPLEMENTATION`, `PRE_DATABASE_MIGRATION_REVIEW`, `REVIEW_PIPELINE`, `SESSION_HANDOFF_2026-09-04`, `STORAGE_OPERATIONS`, `TENCENT_COS_SETUP`, `VPS_AUTOMATION`, `VPS_INTEGRATION_AUDIT_2026-09-06`, `WEBSITE_TRANSFER` (semuanya `.md`).
