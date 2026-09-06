# Audit implementasi Side Hustle Arena — 5 September 2026

Baseline: HEAD `398306a`, termasuk 18 file tracked yang sudah dimodifikasi sebelum audit. Audit ini tidak mengubah kode aplikasi, database, bucket, atau deployment.

Kesimpulan: fondasi backend dan alur pengumpulan submission sudah terimplementasi, tetapi siklus produk **login nyata → project → submission → review AI nyata → finalisasi → hasil/leaderboard → poin → reward diterima** belum selesai end-to-end. Build hijau tidak membuktikan siklus tersebut selesai.

## Metode dan batas bukti

- Membaca master PRD, status implementasi, graph lokal, route, UI, service, schema, dan cakupan tes; memverifikasi temuan graph terhadap source terbaru.
- Menjalankan ulang `npm run lint`, `npm run typecheck`, `npm run build`, dan `npm run db:check`: semuanya exit 0. `db:check` memeriksa kontrak SQL di repository, bukan keadaan database production.
- Menjalankan 40 tes lokal dari `reviews-pipeline`, `finalization-ranking`, `arena-core-api`, `arena-submission`, `auth-security`, dan `website-transfer`: 40 pass, 0 fail, 0 skip. Ini bukan 40 tes browser atau integrasi provider live.
- Menjalankan tiga probe offline tambahan: production review completion, evidence validator, dan manual override. Ketiganya mengonfirmasi gap yang dijelaskan di bawah; tidak mengakses database/provider.
- Tes browser/COS/database live tidak dijalankan ulang. Dokumen status mencatat 9 tes browser berhasil sebelumnya; suite saat ini masih memiliki 5 `test.fixme` untuk login lintas situs, AI review, finalisasi/result, leaderboard, dan redeem.
- Status konfigurasi Vercel, DNS, n8n/Hermes, secret rotation, backup, dan deployment production tidak diverifikasi dari konsol eksternal. Bedakan “implementasi belum ada di repo” dari “konfigurasi eksternal belum terbukti”.

## Temuan prioritas sebelum production

### A01 — P1: completion review eksternal selalu gagal di production

`completeReviewJob()` langsung mengevaluasi default `judgeProvider = getJudgeProvider()`. Factory itu melempar `REVIEW_PROVIDER_FAILED` ketika `APP_ENV` bukan `development`. Route completion dan eval ingest tidak menyuntikkan provider. Bahkan primary review yang tidak membutuhkan second judge tetap gagal sebelum membaca job atau memvalidasi primary output.

Bukti: `src/server/reviews/queue-service.ts:207`, `:238`; `src/app/api/internal/reviews/complete/route.ts:31`; probe offline mengonfirmasi kegagalan sebelum akses DB.

Selesai ketika: provider nyata tersambung dan completion primary di production dapat berjalan; second judge hanya dipanggil saat diperlukan. Mengisi `AI_API_KEY` saja belum cukup karena adapter nyata belum ditulis (`model-router.ts:78`). Stub lokal memang ditolak di production; gejala production saat ini antrean tidak selesai, bukan otomatis menerima skor stub.

### A02 — P1: disagreement tidak dapat dituntaskan lewat operasi admin yang tersedia

Manual override hanya mengubah `finalScore`, tidak mengubah `NEEDS_RESOLUTION`. Rerun mempertahankan review lama. Finalisasi mencari **semua** review `NEEDS_RESOLUTION` untuk week, sehingga successful rerun juga tidak menyingkirkan blocker historis. Alur “disagreement → admin resolves → finalize” belum lengkap.

Bukti: `src/server/reviews/admin.ts:19`, `:94`; `src/server/finalization/service.ts:158`. Probe fake DB mengonfirmasi override tidak menulis status. Tes review yang ada memeriksa nilai override, bukan keberhasilan finalize sesudah resolving disagreement.

Selesai ketika: keputusan resolusi/supersession dicatat dengan audit, dan finalisasi mempertimbangkan review efektif yang masih unresolved.

### A03 — P1: webhook dapat mengambil job milik versi lain lalu membuang hasil target

`ingestExternalReview()` mencari job berdasarkan `versionId`, tetapi memanggil `claimReviewJob()` yang mengambil job teratas dari antrean global. Bila target B kalah urutan dari A, A terlanjur menjadi PROCESSING, lalu webhook B mengembalikan `deduped: true / CLAIMED_ELSEWHERE`. Ini bukan deduplikasi yang benar: hasil B tidak tersimpan dan A tertahan sampai lease habis.

Bukti: `src/server/reviews/eval-ingest.ts:42`; pemilihan antrean `src/server/reviews/queue-service.ts:69`. Temuan dari penelusuran kode; skenario multi-job belum direproduksi ke DB live.

Selesai ketika: claim webhook atomik untuk job/version target dan tes membuktikan dua versi yang antre tidak saling mengambil lease.

### A04 — P1: logout UI tidak mengakhiri sesi autentikasi asli

Navbar dan profile memanggil `logout()` dari DemoProvider, lalu pindah halaman. Keduanya tidak memanggil `POST /auth/logout`, padahal backend membaca cookie `sk_participant`. Identitas yang terlihat juga masih berasal dari demo. Pengguna dapat menekan Keluar lalu kembali ke halaman terproteksi dengan cookie asli yang masih berlaku.

Bukti: `src/components/layout/AppNavbar.tsx:60`; `src/app/(app)/app/profile/page.tsx:70`; endpoint nyata `src/app/auth/logout/route.ts`.

Selesai ketika: UI memakai user server dan logout benar-benar menghapus cookie dengan domain yang sesuai, lalu request terproteksi ditolak.

### A05 — P1: hasil final bisa terbuka sebelum week FINALIZED

`getArenaResult()` hanya mengembalikan sealed jika ranking row **belum ada**. Finalisasi menulis ranking per peserta sebelum menandai week FINALIZED. Saat proses berjalan atau terhenti sebagian, peserta yang sudah punya ranking row dapat menerima hasil dengan `finalized: true` walaupun week masih FINALIZING.

Bukti: `src/server/finalization/result-service.ts:53`; `src/server/finalization/service.ts:177`, `:270`. Temuan dari alur tulis/baca, belum diuji dengan kegagalan proses live.

Selesai ketika: pembukaan hasil diputuskan langsung dari status publikasi/finalisasi resmi, termasuk pada partial failure.

### A06 — P1: ledger dan balance belum aman terhadap proses terputus

Finalisasi memasukkan ledger lalu mengubah point account dalam statement terpisah tanpa transaksi yang menyatukan keduanya. Jika proses berhenti setelah ledger masuk, retry melihat conflict ledger lalu melewati update account. Balance dapat tertinggal permanen walaupun ledger benar. Void/reversal memakai pola serupa. Review completion juga menyimpan review, criterion scores, version/job status, dan audit secara terpisah, sehingga ada risiko review parsial saat proses terputus.

Bukti: `src/server/finalization/service.ts:199`, `:213`, `:337`; `src/server/reviews/queue-service.ts:327`. Ini gap recovery berdasarkan struktur kode, bukan laporan kerusakan data yang sudah terjadi.

Selesai ketika: unit perubahan terkait atomik atau memiliki recovery/reconciliation yang terbukti; tes fault injection berhenti di antara ledger/account dan review/scores lalu menjalankan retry.

### A07 — P1: worker/admin belum memiliki batas kewenangan berbeda

Route rerun/override memakai bearer yang sama dengan worker, dan menerima `actorSubject` dari request body. Model role/admin session belum tersedia; pemegang token automation dapat melakukan override dan menentukan label aktor audit.

Bukti: `src/app/api/internal/reviews/admin/[action]/route.ts:28`; `src/server/reviews/internal-auth.ts`. Ini endpoint internal terlindungi token, bukan endpoint publik tanpa auth.

Selesai ketika: scope worker dan otoritas admin dipisahkan, dan identitas aktor audit diturunkan dari credential yang diverifikasi. Hook VPS juga perlu URL HTTPS wajib: `src/server/automation/vps-hooks.ts` masih memiliki fallback HTTP yang mengirim token jika hanya token dikonfigurasi.

### A08 — P2: hasil, workspace, dan submission minggu lama kehilangan jalur UI

Ketiga halaman mencari project lewat endpoint visible-current-week dan enrollment lewat `getCurrentEnrollment()`. Setelah current week berganti—bahkan bisa saat week berikutnya masuk PREVIEW/SCHEDULED—project/enrollment lama tidak lagi ditemukan, meski result API berbasis enrollment ID masih bisa menyajikan datanya.

Bukti: `src/app/(app)/app/arena/result/[projectId]/page.tsx:41`; `src/server/arena/project-service.ts:72`; pola sama di workspace dan submission. Belum ada halaman/API daftar riwayat enrollment yang dipakai UI.

Tambahan: notifikasi submission membuat URL memakai UUID project (`src/server/submissions/service.ts:300`), sementara halaman mengirim parameter itu sebagai **slug** ke project endpoint. Klik notifikasi tersebut tidak konsisten dengan route nyata.

Selesai ketika: riwayat dan deep link berbasis identitas stabil/week dapat diakses sesudah pergantian minggu; tautan notifikasi diuji dengan mengkliknya.

### A09 — P2: evidence review belum diverifikasi atau disimpan secara lengkap

Validator memeriksa schema, criterion ID, rentang skor, dan adanya string evidence. Ia tidak menerima konten artefak untuk mencocokkan klaim. Probe dengan evidence fiktif yang sesuai schema lolos. Completion tidak menyimpan evidence per criterion; `review_scores` hanya menyimpan angka dan issues sebagai feedback. Reviewer input juga belum membawa brief lengkap atau hasil ekstraksi konten.

Bukti: `src/server/reviews/validator.ts:24`, `:52`; `src/server/reviews/reviewer-input.ts`; `src/server/reviews/queue-service.ts:343`; `src/server/db/schema/reviews.ts:60`.

Selain itu, seluruh FILE dianggap belum diekstrak; invalid second-judge output diabaikan dan primary dapat tetap disimpan sebagai COMPLETED_HIDDEN (`queue-service.ts:272`, `:288`).

Selesai ketika: ekstraksi file/link tersedia; evidence memiliki rujukan artefak yang dapat dicek dan disimpan; invalid judge masuk retry/resolution; rubric version/freeze dan metadata model nyata dapat diaudit.

### A10 — P2: retry queue dan email belum lengkap

- Retry review menulis `availableAt`, tetapi branch RETRY pada claim memeriksa `leaseExpiresAt`, bukan jadwal retry. Backoff tidak menjadi aturan claim yang efektif.
- Worker yang crash pada attempt ke-5 meninggalkan PROCESSING yang tidak bisa di-claim lagi (`attemptCount < 5`), tanpa sweeper terminal-failure. Finalisasi tetap melihat job tersebut sebagai open.
- Email yang gagal diubah ke FAILED, sedangkan flush berikutnya hanya mengambil PENDING; komentar “retried next flush” tidak sesuai implementasi.
- Trigger submit/finalisasi/reward default ke IN_APP. Tidak ada caller produksi di repo yang mengantrekan channel EMAIL; menyalakan cron/Resend saja belum membuat notifikasi produk terkirim via email.

Bukti: `src/server/reviews/queue-service.ts:86`, `:88`, `:450`, `:497`; `src/server/notifications/service.ts:30`, `:188`, `:213`.

Selesai ketika: retry, exhausted lease, email enqueue/dedupe/retry, serta pemulihan provider outage diuji.

## Checklist pekerjaan end-to-end yang tersisa

| Area | Yang sudah ada | Yang belum selesai | Syarat selesai |
|---|---|---|---|
| Auth dan identitas | Verifikasi shared participant JWT, mirror user, guard app/API, endpoint logout | UI user/logout, bukti login situs utama → Arena → logout, kelanjutan project setelah login, kontrak revocation/suspend lintas situs | Tes browser dengan login nyata dan cookie production-domain; bukan cookie yang dibuat fixture |
| Dashboard peserta | Desain `/app`, `/app/arena`, `/app/profile` | Data user, current enrollment, progress, statistik, rekomendasi, poin masih mock/localStorage | Refresh, pindah perangkat, dan membuka entry point manapun menunjukkan state DB yang sama |
| Browse/enroll/workspace | Browse/detail live, enroll API, progress, upload/link/submit live | CTA state masih sebagian membaca DemoProvider, histori lintas minggu, deep links | Enroll dan lanjutkan project dari seluruh pintu masuk dengan akun nyata |
| Submission/storage | Private COS seam, presign, HEAD check, immutable DB version, max attempts, ownership/deadline checks | Magic bytes, checksum/integritas byte versi, orphan/intent cleanup, riwayat versi/download versi lama; requirement TEXT tidak punya jalur input item tersendiri | File yang dinilai terbukti sama dengan versi submit; failure/replacement/deadline tidak merusak artefak lama |
| AI review | Queue/lease, validator struktur, weighted scorer, judge routing, rerun/override | Provider nyata, extraction PDF/Office/image/link, brief lengkap, evidence persistence/verification, fallback/cost, resolusi dan recovery A01–A03/A06/A09/A10 | Submission nyata dari tiap tipe artefak menghasilkan review yang dapat diaudit tanpa stub |
| Generator mingguan | Field status/project, cron placeholder, tipe hook | Context/library, generation, quality validation, fingerprint anti-duplikat, regenerate, evergreen/library fallback, preview/veto, publish, OPEN transition | Siklus Minggu → Senin menghasilkan paket project valid otomatis, termasuk ketika provider gagal |
| Finalisasi dan leaderboard | Service close/finalize/rank, API leaderboard, point ladder 300/200/150/100 | UI board, resolving disagreements, sealing/recovery, bukti scheduler live, histori | Deadline → antrean drain → final hasil serentak → leaderboard → poin konsisten |
| Poin dan rewards | Ledger award/reversal, catalog read, ladder, take PENDING | Potong/hold saldo, reserve LIMITED inventory, transaksi redeem, fulfillment USD 20, status/history UI, reversal reward/refund, kontrak voucher jika SKU voucher diaktifkan | 2.000 poin benar-benar ditukar → persediaan/saldo benar → peserta menerima reward → tercatat FULFILLED; race tidak double spend |
| Notifikasi | Inbox API/read/unread, durable events, pemicu submit/finalisasi/milestone, email adapter | UI inbox/badge, tautan benar, Monday/deadline scheduler wiring, audience drop, email enqueue/retry, delivery bukti live | Peserta menerima event yang benar dan klik sampai tujuan; retry tidak menggandakan |
| Admin/Product Owner | Overview API, flags, close/finalize, rerun/override, fraud void | Dashboard, role/scopes, project CRUD/publish/veto, week extend, suspend UI/API, inventory/fulfillment/reversal, automation health | Operasi normal dilakukan tanpa SSH/SQL manual dengan otoritas dan audit yang benar |
| Skill evidence/portfolio | Schema `skill_evidence` dan reader result | Tidak ditemukan writer `skill_evidence` di aplikasi; showcase memakai mock; belum ada alur kurasi/publikasi evidence nyata | Hasil review menghasilkan bukti skill yang bisa dilacak ke artefak dan ditampilkan dengan izin yang sesuai |
| CV Scanner | Upload screen, animasi analisis, result screen | Parsing/penyimpanan/analisis CV dan hasil nyata; skor/result masih `MOCK_*` | Dua CV berbeda dinilai berdasarkan isinya dan hasil persisted, bukan timer/data demo |
| Career Report | Halaman dan komputasi demo | Aggregation dari review/skills/CV/poin nyata, trend dan histori | Menyelesaikan Arena memperbarui report backend; PRD §63 menempatkan integrasi ini pada fase lanjutan |
| Jobs | Halaman dan link portal | Matching dari profil/evidence nyata; masih `MOCK_JOB_MATCHES` | Rekomendasi berdasar data user dan lowongan nyata; PRD §64 adalah fase lanjutan, bukan alasan menahan Arena saja |
| Operasional production | Migrasi repo, config deploy/cron, auth/origin/storage guards, audit dasar | Bukti environment production, migrasi/recovery, secret rotation, DNS/cutover Arena lama, TLS/CORS production, worker deployment, heartbeat/alerts, provider cost, rate limits, CI regression gates, rollback | Staging/prod smoke test lengkap + restore drill + monitoring/rollback teruji |

Catatan storage: saat submit, version item menyalin `storageKey` draft, sementara PUT URL berlaku 600 detik dan tidak ada pemakaian object version ID atau verifikasi checksum pada jalur download/review. Immutability baris DB belum merupakan bukti immutability byte file. Perlu pengujian replay PUT di bucket staging dan mekanisme pin/copy/seal yang sesuai. Audit ini tidak menjalankan replay ke bucket.

Catatan auth: checklist lama tentang PKCE/introspection/`__Host-` tidak boleh dianggap sudah mengamankan jalur aktif. `getCurrentUser()` sekarang membaca shared JWT, sedangkan session-retention cron membersihkan tabel sesi bridge lama. Prefix `__Host-` tidak bisa langsung dipasang pada cookie bersama lintas subdomain yang memakai Domain. Hardening harus dirumuskan ulang terhadap kontrak auth yang benar-benar dipakai.

## Cakupan QA yang masih harus ditambahkan

- [ ] Login nyata situs utama, redirect kembali, identitas UI, logout cookie, akses setelah logout, dan suspension/revocation.
- [ ] Navigasi dari `/app`, `/app/arena`, detail publik, dan notifikasi ke enrollment yang sama.
- [ ] Review provider production, ekstraksi semua tipe file/link, unsupported/corrupt file, evidence palsu, timeout, fallback, dan invalid judge.
- [ ] Dua webhook berbeda dalam antrean; duplicate complete; lease expiry; crash pada attempt terakhir; retry backoff.
- [ ] NEEDS_RESOLUTION → override/rerun → finalize berhasil tanpa menghapus histori audit.
- [ ] Finalisasi terputus di tengah; tidak ada score leak; ledger, account, ranking, dan notifications pulih konsisten.
- [ ] Result/artefak minggu lama masih dapat dibuka setelah PREVIEW atau OPEN minggu berikutnya.
- [ ] Redeem bersamaan, stok habis, insufficient balance, fulfillment gagal, refund/reversal, retry fulfillment.
- [ ] Senin project-drop dan Friday reminder benar-benar terpicu; failure delivery masuk retry.
- [ ] Staging browser full loop tanpa mock/stub, lalu production cutover smoke test dan rollback drill.

Lima `test.fixme` ada di `e2e/arena-flow.spec.ts:210–224`. Karena itu, keberhasilan 9 tes browser historis membuktikan subset pengumpulan submission, bukan keseluruhan siklus produk.

## Urutan pengerjaan yang disarankan

1. **Tutup blocker correctness:** A01–A07; tambah regression checks pada skenario yang sekarang tidak tercakup. Perbaiki A08 bersamaan dengan wiring frontend.
2. **Selesaikan satu siklus peserta nyata:** identitas/dashboard → submission → real reviewer/extraction → resolusi → finalisasi → result/leaderboard → poin.
3. **Selesaikan reward dan operasional admin:** inventory/saldo/fulfillment/reversal, UI admin, inbox, dan delivery. Voucher bukan pengganti jalur fulfillment SKU uang USD 20.
4. **Selesaikan siklus mingguan otomatis:** generator, fallback, preview/publish, reminder, worker recovery, health, cost controls.
5. **Jalankan full integration QA lalu production hardening/cutover:** CI, credentials/role separation, storage integrity/cleanup, monitoring, backup/restore, DNS dan rollback.
6. **Fase perluasan career product:** CV Scanner nyata, showcase/portfolio, Career Report, dan Jobs sesuai scope produk yang akan dirilis.

## Dokumen yang perlu diselaraskan

- `README.md` masih menyebut frontend-only/Next.js 15, padahal backend nyata dan Next.js 16.3.3 ada di repo.
- `e2e/README.md` masih menyebut CORS blocker dan enrollment `test.fail`, padahal spec terbaru sudah menjalankan enrollment normal dan status terbaru mencatat CORS berhasil.
- `docs/backend/SESSION_HANDOFF_2026-09-04.md` mengandung blocker storage/auth/wiring yang sudah disupersede.
- Master PRD bagian progress dan bagian historis IMPLEMENTATION_STATUS memuat status fase lama. Pakai source code + bukti tes bertanggal; jangan menggabungkan seluruh paragraf status sebagai satu keadaan terkini.

Tidak ada persentase completion yang diberikan: keberadaan halaman, tabel, atau service tidak setara dengan alur pengguna yang selesai.
