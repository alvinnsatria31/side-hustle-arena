# Audit keseluruhan sistem Side Hustle Arena — 9 September 2026

Audit sekitar 17.40–18.00 WIB. Source lokal: HEAD `2f4b7fd`, beserta working tree yang sudah ada. Target: `arena.sekolahkarir.id`. Pemeriksaan produksi bersifat read-only; tidak melakukan deployment, perubahan paket/kuota, perubahan database, pemicu cron, pengiriman email, atau transaksi reward.

## Kesimpulan

**Skor kematangan E2E: 48,75% (dibulatkan 49%). Status produksi saat diperiksa: BLOCKED.**

Angka ini adalah indeks bukti integrasi atas 20 alur berbobot sama, bukan persentase baris kode selesai, coverage tes, atau perkiraan sisa waktu pengembangan. Banyak backend dan UI sudah tersedia; gap terbesar adalah penerimaan end-to-end dengan layanan nyata, operasi produksi, serta beberapa sambungan produk yang belum selesai.

Rubrik kumulatif konservatif:

- **0%:** alur belum tersedia.
- **25%:** sebagian alur/kontrak ada, sambungan penting masih hilang.
- **50%:** implementasi utama dan tes relevan ada; bukti produksi lengkap belum tersedia. Tes integrasi historis tidak dianggap rerun pada audit ini.
- **75%:** tambahan bukti sebagian rantai eksternal pernah berjalan/terpasang, tetapi acceptance seluruh alur belum lengkap atau tidak dapat direvalidasi.
- **100%:** seluruh acceptance alur terbukti berjalan pada target produksi saat audit.

Total skor tabel **975 / 2.000 = 48,75%**. Tidak ada alur yang memperoleh 100% karena acceptance produksi lengkap tidak dapat dijalankan. Ini tidak berarti kode aplikasi belum dibuat.

## Blocker aktual

### P0 — Deployment Vercel dinonaktifkan

GET melalui VPS Sekolah Karir terhadap `/`, `/arena`, `/api/arena/week/current`, `/api/arena/projects`, dan `/api/auth/session` semuanya mendapat **HTTP 402**, header **`x-vercel-error: DEPLOYMENT_DISABLED`**, body **`Payment required`**. Hasil: **0 dari 5 endpoint smoke check tersedia**. Sebab administratif spesifik di dashboard Vercel belum diperiksa; jangan menyimpulkan paket/penagihan mana yang harus diubah dari pesan ini saja.

Ini juga terlihat dari pemanggil produksi asli:

- n8n grading #2147/#2148 gagal di `Claim one job`, pesan `Payment required`.
- n8n scheduler #2146, 9 September 17.45 WIB, tercatat `success` walaupun pemanggilan `email-flush` menerima HTTP 402 dan summary `ok:false`.
- Respons `DEPLOYMENT_DISABLED` pertama yang ditemukan dalam sampel scheduler tersimpan: #1850, 9 September 11.00 WIB. Ini batas bukti dalam sampel, bukan kepastian waktu awal insiden.

### P0 — Database produksi menolak koneksi karena kuota

Koneksi memakai `PROD_DATABASE_URL` dari `.env.deploy` gagal dengan SQLSTATE **53000**:

> Your project has exceeded the data transfer quota. Upgrade your plan to increase limits.

Query transaksi read-only belum dapat berjalan. Karena itu jumlah peserta, kondisi proyek aktif, migrasi produksi, antrean tersisa, ledger, delivery email, stok reward, dan sumber Jobs terkini **belum dapat diverifikasi**. Identitas database didasarkan pada konfigurasi deployment lokal; parity dengan environment deployment Vercel aktif belum diverifikasi.

Pemulihan hosting saja belum cukup: kapasitas database juga harus dipulihkan dan diverifikasi.

### P1 — Monitoring scheduler bisa hijau ketika pekerjaan gagal

Node `Summarise the run` hanya mengembalikan `{ ok:false }`; tidak melempar error atau mengarahkan ke pemberitahuan kegagalan. #2146 membuktikan dampaknya, bukan sekadar kemungkinan dari pembacaan kode. Heartbeat aplikasi tidak cukup mendeteksi hosting mati karena request tidak sampai ke aplikasi.

Sumber: `n8n/arena-trigger-workflow.json`, node live bernama sama; `src/server/ops/automation-health.ts:54` belum memasukkan heartbeat generation/drop/close/finalize. Perlu pemantauan eksternal atas ketersediaan aplikasi, kegagalan bisnis, antrean tertunda, dan kapasitas/kuota.

## Checklist per alur

Kotak di kolom terakhir adalah acceptance yang masih harus ditutup. Persentase mengikuti rubrik di atas; seluruh alur web saat ini juga terhalang outage.

| # | Alur | Skor | Sudah tersedia / bukti | Acceptance yang belum selesai |
|---|---|---:|---|---|
| 1 | Landing, browse, detail proyek | 50% | Halaman dan API membaca layanan Arena, bukan seluruhnya demo | [ ] Hosting pulih; katalog/detail produksi tampil dan sesuai minggu aktif |
| 2 | Login main site → Arena → logout | 50% | Verifikasi cookie peserta, provisioning, origin guard, logout | [ ] Login dari main site di browser nyata; cookie domain/expiry; logout lintas situs; kontrak pencabutan sesi lintas perangkat |
| 3 | Profil, avatar, privasi akun | 50% | API/UI profil dan avatar; consent/deletion tersedia | [ ] Simpan lalu login ulang; uji pemisahan akun dan propagasi privasi pada deployment target |
| 4 | Generate proyek dan fallback | 50% | Provider AI, rubric beku, dedup, library, validasi placeholder, budget | [ ] Siklus generation nyata semua divisi, fallback saat model gagal, konten/skill/rubrik terkurasi; context engine PRD belum lengkap |
| 5 | Preview → approve → publish / ad-hoc | 50% | Layanan generation/admin launch dan workflow repo tersedia | [ ] Rilis nyata lewat UI/admin sampai terlihat peserta; validasi konten dan jadwal; bukti ad-hoc webhook bila menjadi entrypoint operasional |
| 6 | Resource/dataset proyek → peserta | 25% | Package generation memiliki `resources` | [ ] API detail mengembalikan resource tersimpan; mapper UI meneruskannya; dataset/tautan benar-benar dapat diakses |
| 7 | Pilih proyek → enrollment → workspace | 50% | Layanan, UI, batas satu proyek/minggu dan fixture integrasi tersedia | [ ] Jalankan dari browser produksi, reload workspace, cegah pemilihan ganda dan akses akun lain |
| 8 | Upload → object storage → snapshot | 50% | Presign/finalize/checksum/snapshot dan uji replay tersedia | [ ] Upload COS dari browser nyata, CORS, unduh artefak reviewer, penolakan replay, dan cleanup tanpa kehilangan snapshot |
| 9 | Submit → versi → batas attempt/deadline | 50% | Immutable version, antrean review, guard attempt/deadline | [ ] Submit dan revisi dari UI hingga antrean nyata; failure tidak menghabiskan attempt secara keliru; deadline aktual |
| 10 | Claim → model AI → callback tersimpan | 75% | Eksekusi n8n #1660 mencapai model dan `Complete the lease` | [ ] Rerun acceptance setelah outage, dengan artefak peserta nyata; hasil peserta sampai publikasi, bukan hanya callback |
| 11 | Retry, lease mati, second judge, recovery | 50% | Queue policy, stale callback guard, sweep, admin rerun, judge tersedia | [ ] Gangguan provider/worker nyata; reclaim tanpa duplikasi; jalur judge dan manual resolution; pulih sampai finalisasi |
| 12 | Scheduler mingguan dan ad-hoc | 75% | Dua workflow Arena aktif; close/finalize hourly live sudah terpasang | [ ] Buktikan deadline lewat → close → finalize otomatis; missed tick dan respons gagal tertangani; hilangkan success palsu |
| 13 | Finalisasi → hasil → ranking → poin | 50% | Finalisasi transaksional, hasil tersegel, ledger/idempotency dan tes tersedia | [ ] Satu minggu nyata selesai; ranking/poin sesuai; rerun tidak menggandakan poin; void/override tetap konsisten |
| 14 | Showcase dan consent | 50% | Layanan showcase final dan grant/revoke consent, coverage sandbox historis | [ ] Hasil produksi muncul hanya setelah consent; withdraw/delete menghilangkannya termasuk akses langsung |
| 15 | Inbox → email → penerimaan | 50% | Event, inbox, outbox, Resend, retry/idempotency, cadence 15 menit | [ ] Bukti email diterima, retry tidak duplikat, reminder tepat waktu dan backlog pulih setelah outage |
| 16 | Reward → klaim → fulfillment | 25% | Reservasi stok, potong/refund poin, admin fulfillment manual | [ ] Kontrak voucher main site; sambungkan pemanggil; bukti kode dapat dipakai atau pembayaran manual benar-benar diterima |
| 17 | Hasil → skill evidence → Career Report | 50% | Agregasi evidence, pemisahan PROJECT/CRITERION, CV join dan UI | [ ] Kurasi pemetaan rubric→skill dan cara admin mengeditnya; hasil peserta nyata tampil konsisten |
| 18 | Sumber Jobs → sinkronisasi → matching | 25% | Adapter HTTP, normalisasi, lease, matching dan fixture lokal | [ ] Sumber lowongan nyata aktif/terverifikasi; data fresh, stale/closed tersaring, link apply bekerja |
| 19 | CV upload → AI → hasil/history | 50% | Extraction/provider, limits, opt-in history dan halaman tersedia | [ ] Provider/deployment/feature flag aktual; dokumen nyata menghasilkan output dan history milik akun yang tepat |
| 20 | Admin, audit, monitoring, release checks | 50% | Role guard, audit, flags, console; CI types/lint/schema/offline/build | [ ] Acceptance role/admin; lifecycle+browser di CI; alarm kegagalan bisnis, kuota, serta verifikasi deployment/migrasi dan recovery |

## Gap kode yang terkonfirmasi

1. **Resource berhenti sebelum peserta.** `src/lib/arena-view.ts:206` menetapkan `resources: []`; `getVisibleArenaProject` dalam `src/server/arena/project-service.ts` mengambil skills/rubric/requirements tetapi tidak resources. Generation menyimpan package dengan resources. Ini sambungan yang belum selesai, bukan sekadar bukti tes kurang.
2. **Voucher belum tersambung ke alur aplikasi.** `src/server/rewards/voucher-push.ts:14` menyatakan kontrak pending. Pencarian seluruh `src` menemukan definisi `pushRewardCode`, tanpa pemanggil produksi. `fulfillRedemption` dalam `src/server/rewards/redemption-service.ts` mencatat verifikasi manual, bukan mengirim payout. Fulfillment manual boleh menjadi desain produk, tetapi harus dibuktikan dengan referensi penerimaan nyata; otomatisasi voucher tetap terpisah dan belum selesai.
3. **Editor admin belum menyediakan pemetaan rubric→skill.** `src/app/(app)/app/admin/projects/[id]/page.tsx:41` menjelaskan rubric/skills/requirements ditampilkan tetapi tidak diedit. `src/server/finalization/skill-attribution.ts` mendukung pengukuran per kriteria; tanpa pemetaan, Career Report sengaja tidak menyatakan skor skill terukur. Isi pemetaan DB produksi sekarang tidak dapat diperiksa.
4. **Context engine generation belum selengkap PRD.** `src/server/generation/service.ts:93` memberi division name, skill IDs, dan base rubric; `ai-provider.ts:60` menerima allowed skill IDs. Belum ditemukan ingestion market signals atau loop pemeringkatan kualitas library dari hasil peserta dalam modul generation. Ini enhancement scope PRD, bukan penyebab outage.
5. **Acceptance eksternal belum menjadi tes yang dijalankan.** `e2e/arena-flow.spec.ts:254` dan `:256` masih `test.fixme` untuk login main site dan AI eksternal. Dua tes upload bisa `skip` bila CORS belum siap. Lifecycle lokal memakai `StubReviewProvider` dan `force:true` untuk close, sehingga tidak membuktikan jalur model nyata atau cadence otomatis.
6. **CI belum menjalankan lifecycle/browser.** `.github/workflows/ci.yml` hanya types, lint, schema contract, offline tests, build. Sandbox database/MinIO dan Playwright belum menjadi quality gate rutin.

## Yang sudah berubah dibanding audit pagi

- Audit lama `END_TO_END_AUDIT_2026-09-09.md` memakai HEAD `9ac7c46`; audit ini memakai `2f4b7fd`.
- **Cadence close/finalize sudah diperbaiki di source DAN workflow live:** `Hourly week lifecycle`, cron `10 * * * *`. Temuan lama bahwa close hanya Sabtu tidak lagi berlaku.
- **AI eksternal pernah berhasil:** #1660 dimulai 9 September 06.04.33 WIB; model `deepseek/deepseek-v4-flash`; pre-check `valid:true`; callback mengembalikan `COMPLETED_HIDDEN`, score 100, second judge tidak berjalan. Review ID `72845108-9a39-4bda-af90-180c960e125f`. Bukti ini berasal dari history n8n, bukan SELECT review row baru. Tidak membuktikan kualitas skor atau alur frontend.
- Dari **432** execution grading tersimpan, **1** mencapai `Grade with model`; total status **179 success / 253 error** pada snapshot pemeriksaan. Banyak success hanya polling tanpa job. Retensi membatasi kesimpulan; ini bukan lifetime success rate.
- Ada skrip `_fix-placeholders.mjs` dan probe/advance-deadline di working tree. **Keberadaan skrip bukan bukti sudah dijalankan.** Karena API dan database tidak tersedia, placeholder publik dari audit lama diberi status *perlu verifikasi ulang*, bukan otomatis dianggap masih ada atau sudah beres.
- Probe `_e2e-participant-probe.mjs` memasukkan enrollment/submission/version/job lewat SQL. Walaupun menghasilkan callback AI, probe semacam itu melewati login/enrollment/upload UI dan tidak dapat disebut acceptance perjalanan peserta lengkap.

## Verifikasi pada audit ini

| Pemeriksaan | Hasil terbaru | Batas bukti |
|---|---|---|
| `npm run test:offline` | **266 pass, 0 fail** | 32 suite dijalankan; 24 suite DB/provider dikecualikan runner |
| `npm run typecheck` | Lolos | Source lokal |
| `npm run db:check` | Lolos | Schema vs migration repository; bukan migrasi DB produksi |
| `npm run lint` | **0 error, 18 warning** | Termasuk warning dari skrip working tree yang sudah ada |
| HTTP produksi lewat SSH VPS | **5/5 HTTP 402** | Smoke read-only, bukan browser acceptance |
| Koneksi DB target produksi | SQLSTATE **53000**, transfer quota exceeded | Tidak ada query bisnis yang berhasil |
| n8n | `sk-n8n` healthy; kedua workflow Arena aktif | Healthy container tidak berarti pekerjaan bisnis berhasil |
| Sandbox lifecycle/Playwright | Tidak dijalankan ulang | Docker Desktop daemon lokal tidak tersedia (`dockerDesktopLinuxEngine` pipe tidak ditemukan) |
| Build, COS live, email delivery, payout | Tidak diuji ulang | Tidak diklaim lulus |

Graph lokal dipakai sebagai peta awal melalui vocabulary `auth enrollment submission review finalization generation scheduler rewards notifications jobs career production`; graph lebih lama daripada source dan query dibatasi 2.500 token. Temuan ditetapkan melalui pembacaan source/tes terbaru dan pemeriksaan read-only live, bukan semata-mata graph atau audit historis.

## Urutan penutupan checklist

- [ ] **P0:** pulihkan availability deployment Arena dan kuota database; cek ulang lima endpoint serta koneksi read-only. Tentukan tindakan paket/kapasitas dari dashboard pemilik; audit ini tidak mengubah billing.
- [ ] **P1:** hilangkan success palsu scheduler dan pasang deteksi outage di luar aplikasi; pastikan job tertunda terobservasi dan terpulihkan.
- [ ] **P1:** validasi kembali konten proyek publik, resources/dataset, rubric, seluruh divisi, dan parity deployment/migrasi.
- [ ] **P1:** satu acceptance terisolasi: login asli → enroll → workspace → upload/link → submit → n8n/model → hasil tersegel → deadline alami → close/finalize → hasil/ranking/poin → inbox/email. Simpan ID fixture, waktu, receipt dan assertion per langkah; hindari direct SQL sebagai pengganti aksi peserta.
- [ ] **P1:** satu acceptance kegagalan: provider timeout/worker mati → retry/reclaim → hasil sukses tanpa duplikasi poin; pastikan second judge/manual resolution ikut diuji.
- [ ] **P2:** tutup resource wiring, rubric→skill editor/kurasi, provider Jobs, fulfillment reward/voucher sesuai keputusan produk, serta SSO revoke lintas perangkat.
- [ ] **P2:** jalankan lifecycle + browser sandbox di CI; pisahkan suite acceptance eksternal yang terkontrol.
- [ ] **P2:** verifikasi recovery/restore, per-job biaya dan anomaly alert, lalu lengkapi context engine generation sesuai prioritas PRD.

CV Scanner, Jobs, Career Report dibaca untuk menilai seluruh permukaan subdomain; tidak diubah. WhatsApp dan otomasi produk lain tidak diaudit secara mendalam maupun dimodifikasi. Tidak ada kode aplikasi atau produksi yang diubah; dokumen ini adalah hasil audit dan handoff.
