# Audit seluruh website — 11 September 2026

Basis: commit `424a95d`, working tree lokal. Pemeriksaan mencakup halaman publik, auth, Arena peserta, penilaian/finalisasi, profil, privasi, showcase, reward, notifikasi, CV Scanner, Jobs, Career Report, dan dashboard admin. Audit ini tidak mengubah kode aplikasi atau deployment.

## Kesimpulan

**Enam bug baru dan dua keterbatasan alur fitur.** Empat bug direproduksi dengan service asli dan database lokal; dua lainnya didukung eksekusi fungsi terisolasi serta penelusuran komponen. Tidak semua integrasi eksternal sudah diuji pada environment produksi.

Temuan lama tidak otomatis berlaku: commit terbaru sudah menghubungkan voucher ke jalur klaim, menyediakan pemetaan kriteria–skill, registrasi sumber Jobs, preview Career Report admin, editor resource, dan base rubric divisi. Regresi admin terbaru lolos 19/19.

## Bug

### W1 — P1: Hasil CV terakhir bertahan setelah logout dan tidak dipisahkan per akun

**Contoh:** A selesai scan CV di komputer bersama, lalu logout. Hasil scan terakhir masih tersimpan pada browser yang sama dan bisa dimuat lagi lewat halaman hasil tanpa `historyId`, termasuk ketika pengguna berikutnya memakai browser tersebut.

**Penyebab:** DemoProvider menyimpan state lengkap, termasuk `cvScan.result`, ke satu key `sk-demo-state-v1`. `loadStoredState` tidak memeriksa pemilik akun; reducer LOGOUT hanya mengosongkan user. Form logout asli hanya menghapus cookie server. CvResultView memakai hasil dari state ini ketika tidak membuka riwayat tertentu.

**Bukti:** fungsi reducer dan loader asli diekstrak melalui TypeScript AST, lalu dijalankan dengan CV sintetis dan storage memori:

```json
{"logoutClearedIdentity":true,"cvResultSurvivesLogout":true,"cvResultLoadsWithoutAccount":true}
```

Ini masalah salinan **lokal pada browser yang sama**, bukan bukti akses lintas akun terhadap API riwayat server. UI memang menyebut hasil tersedia di browser, tetapi tidak membersihkannya saat pergantian akun/logout. Reproduksi lewat dua akun di browser nyata belum dilakukan.

**Saran:** tetapkan masa hidup hasil sementara, pisahkan state berdasarkan pemilik bila perlu, dan bersihkan data CV lokal saat logout/hapus akun/pergantian identitas. Uji scan A → logout → login B → buka halaman hasil tanpa historyId.

**Sumber:** `src/features/demo/store.tsx:29,128,294,322`; `src/components/cv-scanner/CvResultView.tsx:109`; `src/app/auth/logout/route.ts`.

### W2 — P1: Refund saat voucher sedang dikirim dapat meninggalkan kode aktif dengan poin dikembalikan

**Contoh:** user klaim voucher. Selama request ke situs utama berlangsung, admin membatalkan klaim. Situs utama menerima/menerbitkan kode, tetapi Arena sudah mengembalikan poin.

**Penyebab:** delivery membaca status PENDING/PROCESSING, melakukan HTTP di luar transaksi, kemudian memanggil fulfill. Reversal bisa masuk di antara langkah tersebut. Ketika fulfill ditolak karena klaim sudah dibatalkan, jalur ini hanya menulis catatan manual; tidak menarik kembali kode di situs tujuan.

**Bukti:** service redemption/delivery asli, DB lokal, fetcher sintetis yang melakukan reversal ketika request dianggap sedang berlangsung:

```json
{"remoteCodeIssued":true,"localStatus":"ADMIN_REVERSED","pointsRefunded":true,"deliveryStatus":"MANUAL_REQUIRED","deliveryNote":null}
```

Bagian penerbitan kode disimulasikan; tidak ada voucher atau request sungguhan. Ini membuktikan keadaan tidak konsisten pada kontrak saat ini, bukan bukti kerugian yang sudah terjadi di produksi. User mungkin tidak melihat kode karena note kosong, tetapi kode tetap diterbitkan di sisi tujuan.

**Saran:** tambahkan koordinasi status pengiriman sehingga refund tidak melewati delivery yang sedang berlangsung, serta rekonsiliasi/pembatalan kode untuk hasil eksternal yang sudah sukses. Jangan memegang transaksi database selama HTTP panjang.

**Sumber:** `src/server/rewards/voucher-push.ts` (`deliverVoucherReward`); `src/server/rewards/redemption-service.ts` (`reverseRedemption`, `fulfillRedemption`).

### W3 — P2: Minggu ARCHIVED membuat prestasi hilang dari profil, Career Report, dan pencocokan Jobs

**Contoh:** satu project yang sudah selesai diarsipkan. Jumlah project selesai berubah dari 1 menjadi 0 dan bukti skill menghilang, padahal halaman detail hasil masih dapat dibuka.

**Penyebab:** participant overview, report, dan query skill Jobs membatasi hasil ke status FINALIZED. Result service menerima FINALIZED maupun ARCHIVED. Definisi hasil yang sudah diumumkan tidak konsisten.

**Bukti:** fixture minggu difinalisasi, dibaca, diubah sementara menjadi ARCHIVED, lalu dibaca ulang dan dikembalikan ke FINALIZED:

```json
{"beforeCompleted":1,"afterCompleted":0,"beforeSkills":1,"afterSkills":0,"profileSealed":true,"resultPageSealed":false,"jobsSkills":0,"reportSkills":0}
```

Pemicu ini adalah **penggunaan status ARCHIVED pada minggu**; audit tidak mengklaim scheduler sekarang otomatis mengarsipkan setiap minggu.

**Saran:** gunakan definisi bersama untuk hasil final yang masih sah, termasuk archived, sambil tetap mengecualikan enrollment voided.

**Sumber:** `src/server/arena/participant-service.ts`; `src/server/career/report.ts:33`; `src/server/career/jobs-service.ts:71`; `src/server/finalization/result-service.ts:45`; summary admin juga memakai filter FINALIZED.

### W4 — P2: Lowongan lewat tanggal kedaluwarsa masih tampil aktif

**Contoh:** deadline lowongan sudah lewat, tetapi peserta masih menemukannya di daftar dan mendapat tautan melamar.

**Penyebab:** query user hanya memeriksa status OPEN dan sumber aktif, tidak `expiresAt`. Status EXPIRED baru diperbarui lewat proses sinkronisasi. Di antara jadwal sync, atau saat sync bermasalah, tanggal yang sudah diketahui bisa terlewat.

**Bukti:** buat lowongan OPEN dengan expiresAt satu menit sebelum now; `getJobsOverview` tetap mengembalikannya: `expired:true, shownToParticipant:true`.

**Saran:** filter tanggal kedaluwarsa saat membaca lowongan selain tetap merawat status lewat sync. Uji jam melewati deadline tanpa sync berikutnya.

**Sumber:** `src/server/career/jobs-service.ts:94`; `src/server/career/jobs/sync-core.ts` (`planAbsence`).

### W5 — P2: Pencarian dan matching Jobs hanya menjangkau 200 lowongan terbaru

**Contoh:** ada 201 lowongan aktif. Lowongan paling lama masih valid dan sesuai skill user, tetapi tidak ditemukan saat dicari.

**Penyebab:** backend memotong 200 baris sebelum menghitung kecocokan; pencarian/filter terjadi pada data yang sudah dipotong di browser. `totalOpen` juga berasal dari hasil terbatas tersebut. Tidak ada pagination untuk menjangkau sisanya.

**Bukti:** fixture 201 lowongan OPEN pada satu sumber menghasilkan:

```json
{"actualOpenForSource":201,"returnedForSource":200,"olderOpenJobVisible":false,"reportedTotalOpen":200}
```

Tanggal fixture dibuat sintetis untuk memastikan urutan deterministik. Tidak ada lowongan yang dipublikasikan ke produksi.

**Saran:** pencarian/filter/pagination dilakukan di server; hitung total terpisah. Jika hanya ingin menampilkan subset, jelaskan batas itu dan sediakan jalan ke hasil lain.

**Sumber:** `src/server/career/jobs-service.ts:75,96,165`; `src/app/(app)/app/jobs/page.tsx:69`.

### W6 — P2: Profil menyajikan skor project sebagai skor skill yang belum diukur

**Contoh:** project mendapat 82. Skill Excel hanya tercatat sebagai skill yang dipakai, tanpa kriteria yang mengukurnya. Career Report menampilkan belum terukur, tetapi kartu Bukti Skill pada profil tetap menulis Excel 82/100.

**Penyebab:** backend sudah membedakan atribusi CRITERION dan PROJECT. Komponen profil selalu merender `item.score/100` tanpa memeriksa atribusi. Data lama atau project yang masih tanpa mapping dapat memicu kasus ini meskipun editor mapping sekarang tersedia.

**Bukti:** fungsi report asli dengan evidence sintetis PROJECT menghasilkan `careerReportMeasuredScore:null`, `careerReportProjectScore:82`; komponen profil merender input score 82 langsung. Belum ada screenshot khusus kasus ini.

**Saran:** samakan aturan penyajian profil dan Career Report: skor skill hanya untuk hasil terukur; nilai project ditulis sebagai konteks dengan label yang jelas.

**Sumber:** `src/components/arena/ParticipantProfile.tsx:79`; `src/server/career/report.ts`; `src/server/finalization/skill-attribution.ts`.

## Fitur yang alurnya belum lengkap

| Fitur | Alur yang tersedia | Bagian yang terputus |
|---|---|---|
| Simpan project untuk nanti | Tombol menyimpan slug ke localStorage dan memberi pesan berhasil. | Tidak ada daftar/filter project tersimpan yang membaca koleksi tersebut. User harus menemukan ulang project yang sama untuk melihat status Tersimpan. Simpanan juga belum terhubung ke akun/perangkat lain. |
| Riwayat Inbox | Muat lebih banyak sampai 100 pesan, filter unread, tandai dibaca. | Tidak ada cursor/offset untuk membaca riwayat setelah 100 pesan terbaru pada filter tersebut. Ini batas produk yang terlihat, bukan kehilangan data di database. Jika inbox memang hanya untuk 100 terbaru, batas itu dapat diterima sebagai keputusan produk. |

**Sumber:** satu-satunya konsumen key `sk-saved-projects` ada di `src/components/arena/ProjectDetail.tsx`; `src/components/arena/ParticipantInbox.tsx:54`; `src/server/notifications/service.ts` (`listUserNotifications`).

Pembayaran hadiah uang/non-voucher masih manual sesuai teks UI. Jangan menjanjikan transfer otomatis berdasarkan status FULFILLED; service tersebut mencatat penyerahan yang diverifikasi admin. Ini desain saat ini, tidak otomatis merupakan bug.

## Cakupan dan status end-to-end

| Area | Yang diperiksa / bukti | Batas atau tindak lanjut |
|---|---|---|
| Landing, katalog, detail project | Browser publik dan peserta; reduced motion; data project | Bookmark belum punya daftar. Belum audit visual manual seluruh ukuran layar. |
| Login/logout | Penelusuran shared participant cookie, origin, provisioning; tes auth offline | Login/logout lintas domain dengan akun asli belum dijalankan. W1 terkait data lokal pascalogout. |
| Pilih project → workspace → upload → submit | Lifecycle lokal dengan CSV nyata, MinIO, snapshot dan replay upload | COS dan browser upload produksi belum diuji pada audit ini. |
| Review → finalisasi → poin | Lifecycle lokal memakai review stub; regresi close/override/recovery | Model AI/judge dan worker eksternal belum diuji langsung. |
| Profil, histori, skill | Query peserta dan mapping; probe lintas status | W3 dan W6. |
| Leaderboard/showcase/consent | Tes privacy dan browser grant/revoke | Konsistensi seluruh histori saat archive perlu diperbaiki dan diuji. |
| Hapus akun | Suite privacy DB, tampilan konfirmasi browser, source | Salinan CV lokal masih perlu ditangani. Tidak menghapus akun nyata. |
| Reward | Ledger, retry, stock, manual note, voucher stub; regresi admin | W2. Voucher benar-benar diterima checkout situs utama belum dibuktikan. |
| Inbox/email | Tes offline notifikasi/outbox, source inbox dan scheduler | Batas 100 riwayat; pengiriman sampai inbox email sungguhan belum dilakukan. |
| CV Scanner | Validasi/rate limit/history tests; source upload/result/state | Browser sandbox menguji keadaan CV nonaktif, bukan scan AI nyata. W1. |
| Jobs | 18 tes DB, browser filter/source/coverage; probe deadline dan 201 data | W3–W5; koneksi provider produksi belum diuji. |
| Career Report | Fungsi report, browser, preview admin, source join CV/skill | W3; inkonsistensi dengan profil pada W6. |
| Admin | Regresi 19 tes, browser readiness/roles, sumber latest commit | Perbaikan lama tidak dimasukkan ulang sebagai bug aktif. |
| Scheduler/n8n | Kontrak offline, source jadwal dan health; finalisasi lokal | Satu siklus kalender nyata di deployment target belum dibuktikan pada audit ini. |

## Verifikasi yang benar-benar dijalankan

- `npm run test:offline`: **296 pass, 0 fail**. Runner mengecualikan suite DB/provider; ini bukan tes semua integrasi nyata.
- `npm run test:local:all`: **34 pass** (lifecycle 8, Jobs 18, privacy/limits 8), seluruhnya local sandbox.
- `npm run test:browser:local`: **22 pass**, Chromium desktop, 4,6 menit. Tes otomatis; tidak ada inspeksi manual melalui CUA karena tidak tersedia browser.
- `node scripts/audit-admin-user-integration.mjs`: **19 pass**, dijalankan berurutan. Percobaan awal bersamaan dengan fixture audit lain gagal karena resolver memilih minggu aktif fixture lain; setelah dijalankan sendiri seluruhnya lolos. Ini konflik fixture tes, tidak dihitung sebagai bug aplikasi.
- `npm run typecheck`: exit 0.
- `node scripts/audit-website-wide.mjs`: **12 pass = 8 lifecycle dasar + 4 probe yang mengonfirmasi bug**, bukan berarti empat bug itu sudah diperbaiki.
- `node scripts/audit-cv-browser-state.mjs`: mengonfirmasi hasil CV tetap ada sesudah LOGOUT dan dimuat ulang tanpa pemeriksaan akun; storage dan CV sintetis.
- Eksekusi `buildCareerReport` dengan atribusi PROJECT: skor skill null, skor project 82; dibandingkan dengan renderer profil.

Jalankan suite lifecycle/admin/probe **secara berurutan** karena walaupun fixture punya ID unik, resolver minggu aktif tetap global pada database sandbox.

## Prioritas sebelum produksi

1. Tangani data CV lokal pada batas pergantian akun dan koordinasi voucher–refund.
2. Selaraskan hasil archived serta penyajian skor skill.
3. Perbaiki expiry/pencarian Jobs sebelum jumlah data bertambah.
4. Putuskan cakupan bookmark dan retensi tampilan Inbox.
5. Lakukan acceptance di environment target: login nyata → submit file → worker AI → finalisasi terjadwal → hasil/poin → email; lalu klaim voucher → kode diterima checkout. **Belum diuji langsung tidak sama dengan belum diimplementasikan.**

Artefak baru audit hanya laporan ini dan dua script diagnostik. Tidak ada deployment, pengiriman pesan/email, pembayaran, atau penilaian terhadap peserta nyata. Perubahan `scripts/_e2e-prod-topup.sql` dan folder `.claude` sudah ada sebelum audit dan tidak disentuh. CLI handoff `brain` tidak tersedia; laporan ini menjadi konteks lanjutan.

## Status perbaikan — 11 September 2026 (lanjutan)

Semua temuan di atas sudah diperbaiki di working tree (belum di-commit, belum di-deploy). `scripts/audit-website-wide.mjs` kini **suite regresi**: lulus berarti perbaikan bertahan, bukan lagi bukti bug.

| Item | Perbaikan | Bukti uji | Batas yang tersisa |
|---|---|---|---|
| W1 | `cvScan.ownerId` + masa hidup 24 jam (`src/features/demo/state.ts`); LOGOUT mengosongkan CV; salinan tanpa pemilik/kedaluwarsa dihapus dari storage saat dimuat; `useCvOwnerGuard` di upload/analyzing/result membuang salinan milik identitas lain; hasil lokal hanya dirender bila pemilik cocok; `LogoutForm` bersama (AppNavbar, PublicUserMenu, ParticipantDashboard, AdminSidebar) dan hapus akun membersihkan storage. | `scripts/demo-cv-isolation.test.mjs` (8, termasuk A scan → logout → B). | Dua tamu tanpa akun di browser yang sama tidak bisa dibedakan; TTL membatasi paparan. Hasil scan di `/app` yang dibuka dari halaman publik ikut dihapus (sengaja ketat). |
| W2 | Klaim voucher ditahan `PROCESSING` sebagai lease 60 detik di bawah kunci akun→redemption yang sama dengan reversal; `reverseRedemption` menolak dengan `REWARD_DELIVERY_IN_PROGRESS` (409) selama lease aktif; push gagal mengembalikan klaim ke PENDING. Bila kode tetap terbit setelah klaim dibatalkan (lease kedaluwarsa), kode di-void (`POST /api/v1/vouchers/{code}/void`) dan diaudit `REWARD_VOUCHER_VOIDED` atau `REWARD_VOUCHER_RECONCILIATION_REQUIRED`. Route admin reverse memakai `reverseRedemptionAndRevokeVoucher`; antrean admin menandai kode yang belum berhasil ditarik. | `scripts/reward-accounting.test.mjs` (+7), `audit-website-wide.mjs` W2 ×2 di Postgres sandbox. | **Situs utama belum tentu punya endpoint void.** Sampai tersedia, setiap void tercatat perlu rekonsiliasi manual — 404 sengaja tidak dianggap sukses. |
| W3 | Definisi bersama `PUBLISHED_WEEK_STATUSES = FINALIZED, ARCHIVED` (`src/server/arena/published-weeks.ts`) dipakai profil (ranking, evidence, `sealed`, `completedProjects` tanpa VOIDED), Career Report, bukti skill Jobs, dan ringkasan admin Career Report. | `scripts/published-weeks.test.mjs`, `audit-website-wide.mjs` W3. | `leaderboard-service` dan `showcase-service` (permukaan publik/consent) masih FINALIZED saja — perlu keputusan produk. |
| W4 | Visibilitas lowongan = OPEN + sumber aktif + `expiresAt` null atau > now, di semua query peserta (daftar, hitungan, skill, facet). | `jobs-pipeline-integration` (deadline), `audit-website-wide.mjs` W4. | — |
| W5 | Pencarian, filter, ranking cakupan, dan paginasi di server atas semua lowongan terlihat; `totalOpen`, `totalMatching`, jumlah per sumber, dan facet dari SQL; API `q/employmentType/workMode/location/source/offset/limit`; UI debounce + "Muat lebih banyak". | `jobs-pipeline-integration` (206 lowongan: cari, skill, paging tanpa duplikat), `audit-website-wide.mjs` W5. | Satu request memindai maksimal 5.000 lowongan terbaru; di atas itu respons berflag `truncated` dan UI menjelaskannya. |
| W6 | `presentSkillEvidence`: CRITERION tampil `82/100` "Skor skill terukur"; selain itu "Skor project: 82/100 · Konteks pengerjaan" + badge "Belum diuji khusus". | `scripts/skill-evidence-label.test.mjs`. | — |
| Simpan project | `src/lib/saved-projects.ts` dipakai tombol simpan dan filter **Tersimpan** di katalog (urut terbaru disimpan, sinkron antar-tab, bersihkan project yang tidak lagi dibuka); tautan `?view=saved` dari dashboard Arena. | `scripts/saved-projects.test.mjs`. | Masih per browser, belum tersinkron ke akun/perangkat lain. |
| Riwayat Inbox | Cursor `(created_at mikrodetik, id)` di `listUserNotificationPage`; API `?cursor=` → `nextCursor`; UI "Muat lebih banyak" tanpa batas 100, tandai-dibaca diterapkan di tempat. | `scripts/inbox-cursor.test.mjs`, `audit-website-wide.mjs` Inbox (130 pesan dengan timestamp kembar). | — |

Verifikasi yang dijalankan: `npm run test:offline` **325 pass, 0 fail** (sebelumnya 296); sandbox berurutan — `test:local:jobs` 20/20, `test:local:lifecycle` 8/8, `audit-admin-user-integration.mjs` 19/19, `audit-website-wide.mjs` 14/14, `test:local:privacy` 8/8; `npm run typecheck` 0 error; ESLint 0 error, tanpa warning baru dibanding HEAD; `npm run build` sukses; `npm run test:browser:local` 22/22 (regresi alur yang ada — tombol Tersimpan, paginasi Inbox/Jobs, dan logout lintas akun belum diklik manual di browser).
