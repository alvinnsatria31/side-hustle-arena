# Audit end-to-end Arena — 9 September 2026
on
Audit sekitar 04.00–04.10 WIB, source lokal HEAD `9ac7c46` beserta perubahan working tree yang sudah ada. Kesimpulan: core lifecycle tersedia dan lolos integrasi lokal, tetapi **belum siap disebut end-to-end produksi**. Ada konten publik belum siap dan jadwal penutupan yang tidak cocok dengan deadline rilis aktif.

## Metode dan batas bukti

- Menelusuri graph lokal (lebih lama daripada source), source generation/publishing, ad-hoc launch, scheduler, submission/review/finalization, UI mapping, dan test coverage.
- Membaca API publik `https://arena.sekolahkarir.id/api/arena/{week/current,projects,divisis}` dan detail ketiga proyek.
- SSH `sk-vps`: inventory container; SQLite n8n dibuka `mode=ro` dan `PRAGMA query_only=ON`. Hanya workflow Arena dan metadata/hasil eksekusinya yang ditelaah.
- Tidak mengubah production, menjalankan cron live, claim job live, mengirim email, menjalankan model berbayar, atau menerbitkan proyek.
- Tidak menguji login asli dari main site, browser production, COS upload live, delivery email, atau fulfillment reward. Tidak memverifikasi parity commit deployment/DB produksi. Jangan menganggap hasil lokal membuktikan versi production sama.
- Perubahan awal dipertahankan: AGENTS.md, taste files, dua workflow n8n, automation-health.ts, .claude/, dan scripts/launch-project.mjs yang kosong. Audit hanya menambahkan dokumen ini.

## Temuan prioritas

### P1 — Ketiga proyek publik masih mengandung placeholder

API detail production menunjukkan `[PLACEHOLDER]` pada `caseBackground`, `roleDescription`, serta description/reviewInstruction ketiga kriteria rubrik, untuk semua proyek aktif:

| Proyek | ID |
| --- | --- |
| Sales Insight Brief | d660fc06-44f7-445d-9e4b-dc9a9662706c |
| Onboarding Improvement Plan | c53a475c-b772-484e-a269-f601573e9472 |
| Checkout Flow Improvement | d7857fef-eb73-4672-b452-eb3b2d3a092c |

Divisinya masih memakai slug `dev-arena-core-*` dan description `Development ... projects`. Ini bukti konten seed/development tampil pada permukaan production; bukan bukti pasti bagaimana konten tersebut diterbitkan.

Dampak: peserta menerima konteks tugas tidak lengkap; reviewer menerima rubrik yang belum menjelaskan apa yang dinilai. Hal ini lebih mendesak daripada menambah fitur.

Source lokal sudah memeriksa placeholder di `src/server/generation/core.ts:68`, `validatePackage`, serta jalur publish `src/server/generation/service.ts:359`. Tes penolakan placeholder lolos. Penyebab perbedaan production belum ditetapkan: perlu cek deployment dan riwayat publikasi/mutasi data. Jangan langsung menyimpulkan validator lokal rusak atau production pasti memakai commit lama.

Tindak lanjut: cek apakah sudah ada enrollment/submission, kurasi brief dan rubrik lengkap, lalu rilis pengganti melalui jalur tervalidasi. Jaga immutability proyek yang sudah dipakai peserta; jangan menimpa rubrik tanpa menilai dampaknya. Tambahkan pemeriksaan konten publik pada verifikasi rilis.

### P1 — Jadwal close tidak mendukung deadline ad-hoc saat ini

Minggu production `ADHOC-2026-09-08-7543` (`c26c0f88-18e9-4afa-8e4c-d8504ce5c0ae`) berstatus OPEN; deadline `2026-09-12T16:59:00.000Z`, yaitu Sabtu 12 September 23.59 WIB.

Workflow scheduler live dan repo memetakan `week-close` hanya ke `Saturday 00:05 WIB` (`5 0 * * 6`). `runWeekClose` hanya menutup OPEN week yang deadline-nya sudah lewat (`src/server/scheduler/service.ts:40`), sedangkan `runWeekFinalize` hanya mengambil FINALIZING (`:68`).

Dengan konfigurasi sekarang dan tanpa pemicu lain/intervensi, tick 12 September 00.05 terlalu awal. Tick penutupan berikutnya baru 19 September 00.05: tertunda 6 hari 6 menit. Tick finalisasi akhir pekan tidak menutup OPEN week itu sendiri. Submission deadline tetap dijaga server; masalahnya penutupan siklus dan rilis hasil/poin yang terlambat.

Tindak lanjut: jalankan close dan finalize rutin sepanjang minggu, dengan close mendahului finalize dan guard waktu/idempotency tetap berlaku. Uji deadline ad-hoc weekday, Sabtu malam, missed tick, dan review yang belum selesai. Ini perubahan kecil dengan dampak produk besar.

### P2 — n8n hijau belum berarti pekerjaan bisnis selesai

Dua workflow production aktif: `arena-scheduler-trigger` dan `arena-grading-claim-lease`. Container `sk-n8n` healthy.

- Eksekusi scheduler #1576 (9 September sekitar 04.00 WIB) berstatus n8n `success`, HTTP 200, tetapi summary `project-drop` memuat `ok:false`. Dua week mengembalikan `no publishable projects`; ini tidak membuktikan tiga proyek OPEN di atas gagal dipublikasikan.
- Node `Summarise the run` menghasilkan JSON `ok:false`, tetapi tidak membuat execution gagal atau mengirim alert. Operator yang hanya melihat daftar execution hijau dapat melewatkan pekerjaan tertahan.
- Dari 21 execution grading yang tersimpan saat pemeriksaan, tidak ada yang memuat node `Grade with model`; tiga execution terbaru hanya sampai `Got a job?`. Bukti ini menunjukkan polling berjalan, belum membuktikan grading model/callback berhasil. Retensi execution membatasi kesimpulan; bukan klaim tidak pernah ada grading sebelumnya.
- Ekspektasi heartbeat lokal mencakup email, notifikasi, storage, dan Jobs; belum ada ekspektasi untuk project generation/drop/close/finalize (`src/server/ops/automation-health.ts:54`).

Tindak lanjut: bedakan idle/disabled, blocked, dan failed dalam status operasional; alert untuk pekerjaan due yang tertahan serta OPEN week lewat deadline. Lakukan satu acceptance run terisolasi melalui worker asli, termasuk completion, failure/retry, finalisasi, dan hasil peserta.

### P2 — Resource proyek belum sampai ke peserta

Generation package mendukung resources, tetapi mapper detail menetapkan `resources: []` (`src/lib/arena-view.ts:206`). API detail ketiga proyek live juga tidak mengandung resources. Peserta proyek analisis diminta menganalisis dataset tanpa resource dataset pada payload proyek yang diperiksa.

Tindak lanjut: sambungkan resource tervalidasi dari penyimpanan/API ke detail peserta, lalu kurasi dataset/dokumen yang memang diperlukan. Uji bahwa resource tersedia dan dapat diakses. Jangan sekadar menampilkan link yang belum diverifikasi.

### P2 — Bukti acceptance eksternal belum lengkap

`e2e/arena-flow.spec.ts:254` dan `:256` masih `test.fixme` untuk login main site dan review AI eksternal. Lifecycle lokal menggunakan `StubReviewProvider` dan memanggil close dengan `force:true`, sehingga tidak menangkap kesalahan cadence production di atas. CI `.github/workflows/ci.yml` menjalankan typecheck/lint/schema/offline/build, belum integrasi sandbox maupun browser.

Tindak lanjut: masukkan lifecycle Postgres+MinIO ke CI; pisahkan acceptance environment eksternal yang menguji login asli, storage production-equivalent, worker n8n/model, callback, release hasil, dan delivery notification. Tetapkan bukti per tahap, jangan hanya satu label E2E.

## Yang terbukti tersedia

| Tahap | Status audit |
| --- | --- |
| Generate, preview, approve, publish, launch ad-hoc | Jalur source tersedia; proyek production tersedia, kualitas kontennya gagal |
| Browse/current week/divisions | API production HTTP 200 |
| Enrollment, workspace, submit | Integrasi sandbox lolos |
| Upload, immutable snapshot, checksum/evidence | Integrasi sandbox lolos dengan PUT asli ke MinIO dan replay bytes |
| Review lease, scoring, recovery | Source dan tes offline; lifecycle dengan reviewer stub lolos; model live belum terbukti |
| Finalisasi, hasil tersegel, poin sekali, skill evidence | Integrasi sandbox lolos; scheduling live bermasalah |
| Leaderboard, showcase, inbox | Jalur source dan coverage historis tersedia; browser tidak dijalankan ulang pada audit ini |
| Email, login lintas situs, reward fulfillment | Tidak dibuktikan end-to-end dalam audit ini |

## Verifikasi yang dijalankan ulang

- `npm run test:offline`: **263 pass, 0 fail**. Runner mengecualikan suite yang perlu database/provider; angka ini bukan semua tes repo.
- `npm run test:local:lifecycle`: **8 pass, 0 fail**, fixture cleanup tersedia dalam harness; PostgreSQL dan MinIO lokal.
- `npm run typecheck`: lolos.
- `npm run db:check`: kontrak schema repository lolos, bukan cek migrasi production.
- `npm run lint`: **0 error, 17 warning**.
- Build dan Playwright tidak dijalankan ulang. Tidak ada perubahan kode aplikasi pada audit ini.

## Urutan pekerjaan berikutnya

1. **Readiness rilis:** selesaikan konten ketiga proyek, telusuri parity deployment/publication, perbaiki cadence close/finalize ad-hoc.
2. **Buktikan satu siklus nyata:** login → pilih proyek → upload/link → submit → n8n/model → hasil tersegel → deadline/close → finalisasi → leaderboard/poin → notifikasi. Gunakan fixture terisolasi dan ukur hasil tiap tahap.
3. **Cegah regresi operasional:** lifecycle sandbox di CI, alert pekerjaan tertahan, verifikasi konten publik, recovery runbook.
4. **Lengkapi pengalaman peserta:** resources/dataset dan instruksi rubrik yang bisa dipakai; mapping kriteria ke skill setelah konten inti benar.

CV Scanner, Jobs Portal, Career Report, WhatsApp, dan fulfillment reward bukan target perbaikan audit ini. Belum ada implementasi atau perubahan produksi yang dilakukan.
