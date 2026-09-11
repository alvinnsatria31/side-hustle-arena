# Audit integrasi dashboard admin → menu user

Tanggal laporan: 11 September 2026. Basis: working tree lokal, HEAD `e7b4e53`, termasuk perubahan belum di-commit. Ini audit, bukan implementasi perbaikan atau sertifikasi siap produksi.

## Status perbaikan (pembaruan 11 September 2026)

Kedelapan bug sudah diperbaiki di working tree — **belum di-commit dan belum di-deploy** ke sk-vps.

| Bug | Perbaikan | Bukti |
|---|---|---|
| A1 | Override **dan** rerun ditolak `WEEK_ALREADY_FINALIZED` (409) pada minggu FINALIZED/ARCHIVED; baris minggu dikunci FOR SHARE agar tidak berselang-seling dengan finalisasi. | Regresi A1, tes offline |
| A2 | Keenam jalur submission mensyaratkan minggu `OPEN` (`WEEK_CLOSED`); submit dan finalize-upload memeriksa ulang di dalam transaksi. | Regresi A2 |
| A3 | Daftar review admin berakar di `submission_versions`; kegagalan review pertama tampil (FAILED, tanpa Override) dan bisa di-Rerun. | Regresi A3, browser |
| A4 | Ladder membawa `retryOf` (klaim berakhir terbaru yang belum pernah diulang); API dan UI mengirimnya — tombol "Klaim ulang". | Regresi A4, browser |
| A5 | Stok LIMITED dibaca dari periode aktif — `out_of_stock` / "Stok habis". | Regresi A5, browser |
| A6 | Overview memakai resolver minggu yang sama dengan peserta. | Regresi A6, browser |
| A7 | Pesan `FEATURE_CLOSED` dari admin ditampilkan apa adanya di ProjectDetail dan workspace. | Kode |
| A8 | Petunjuk CV dikoreksi: flag `NEXT_PUBLIC_CV_SCANNER_ENABLED` ditanam saat build, jadi restart container tidak menutupnya; `CV_SCAN_HOURLY_CAP=0` berarti bawaan 300. | Browser |

Alur operasional: editor project kini mengelola resource/dataset; base rubric bisa dibekukan saat membuat divisi (atau sesudahnya, sekali); catatan penyerahan reward tampil di Profil peserta; minggu `DEV-ARENA-CORE-CURRENT` di produksi diarsipkan beserta baris `WEEK_ARCHIVED` di `audit.logs`. Temuan tambahan yang ikut diperbaiki: panel Katalog Reward admin me-refetch tanpa henti (loader inline di `useAdminResource`).

Probe di akhir dokumen ini sudah diubah menjadi tes regresi: 15/15 lolos di sandbox, bersama `test:offline` 286/286, `tsc` bersih, dan `next build` sukses.

## Kesimpulan

Ditemukan **8 bug integrasi/perilaku UI**: enam direproduksi melalui service dan database sandbox, dua diverifikasi melalui penelusuran kode. Ada **empat keterbatasan alur operasional** yang perlu dibedakan dari bug. Prioritas sebelum produksi: konsistensi hasil penilaian, penutupan submission, dan pemulihan review gagal.

P1 = berpotensi membuat hasil atau alur inti bermasalah; selesaikan sebelum produksi. P2 = menyesatkan operator/user atau menghambat alur tertentu.

## Bukti dan batas pengujian

- Enam reproduksi berhasil pada sesi 10 September 2026: **14 tes lolos**, terdiri dari delapan tes lifecycle dasar dan enam probe yang sengaja mengonfirmasi bug. Angka lolos ini **tidak berarti bug sudah diperbaiki**.
- Probe menggunakan service aplikasi asli, PostgreSQL dan MinIO lokal, fixture unik, serta review stub. Tidak menguji provider AI, pembayaran, email, atau webhook nyata.
- Kode terkait diperiksa kembali pada 11 September. Pengulangan tes saat itu gagal pada setup karena `ECONNREFUSED 127.0.0.1:55432`; setup sandbox juga gagal karena Docker daemon tidak aktif. Jadi tidak ada klaim bahwa pengujian runtime terbaru berhasil pada tanggal laporan.
- Belum ada verifikasi visual melalui browser untuk audit ini. Temuan UI di bawah merupakan perilaku yang ditelusuri dari komponen/API, bukan temuan screenshot atau pengujian responsif.
- Tidak mengubah kode aplikasi, data produksi, deployment, atau automasi produk lain. Working tree memuat perubahan lain yang tidak dibuat oleh audit ini.

## Bug yang direproduksi

### A1 — P1: Override nilai admin tidak memperbarui hasil final user

**Contoh sederhana:** minggu sudah selesai, admin mengganti nilai menjadi 11. Halaman hasil user tetap menampilkan 65,5 dan 300 poin.

**Pemicu:** lakukan manual override pada review setelah minggu berstatus FINALIZED. Operasi diterima, tetapi ranking menyimpan nilai lama. Finalisasi ulang langsung mengembalikan ranking yang sudah ada.

**Bukti probe:** `adminFinalScore: 11`, `participantFinalScore: 65.5`, `participantPoints: 300`.

**Akar masalah:** `overrideReview` mengubah tabel reviews; hasil user membaca weeklyRankings. Tidak ada penjagaan status minggu atau rekonsiliasi hasil final pada jalur override.

**Referensi:** [admin review](../../src/server/reviews/admin.ts), [hasil user](../../src/server/finalization/result-service.ts), [finalisasi](../../src/server/finalization/service.ts).

**Saran:** blokir override/rerun setelah finalisasi, atau sediakan proses koreksi final yang secara konsisten menghitung ulang nilai, peringkat, poin, dan data turunan. Tes penerimaan: nilai admin dan hasil user konsisten setelah koreksi yang diizinkan.

### A2 — P1: Force-close/finalisasi lebih awal masih menerima submission

**Contoh sederhana:** admin sudah menutup minggu, tetapi user yang masih membuka form lama masih dapat mengirim tugas sebelum jam deadline awal.

**Pemicu:** force-close lalu finalisasi sebelum deadline terjadwal, kemudian patch draft dan submit lagi melalui service submission.

**Bukti probe:** minggu tetap `FINALIZED`, tetapi submission baru diterima sebagai attempt 2 dan status submission menjadi `SUBMITTED`.

**Akar masalah:** jalur perubahan submission memeriksa waktu deadline, belum memeriksa status minggu. Force-close mengubah status minggu tanpa memajukan deadline.

**Referensi:** [submission service](../../src/server/submissions/service.ts), [close/finalize](../../src/server/finalization/service.ts).

**Saran:** semua perubahan draft, link, upload, submit/resubmit harus memeriksa status yang mengizinkan perubahan, termasuk pemeriksaan ulang dalam transaksi. Tes penerimaan: setelah close, request dari form lama pun ditolak dan hasil final tidak berubah.

### A3 — P1: Review pertama yang gagal tidak muncul di daftar Review admin

**Contoh sederhana:** tugas user gagal dinilai sebelum menghasilkan review. Admin membuka filter FAILED, tetapi tugas bermasalah tersebut tidak ada sehingga tombol rerun tidak tersedia untuknya.

**Bukti probe:** job FAILED ada, tetapi `shownInFailedReviews: false`.

**Akar masalah:** daftar admin dimulai dari tabel reviews. Kegagalan pertama bisa hanya memiliki review_jobs dan submissionVersions, tanpa baris reviews. Service rerun sudah mendukung kasus tanpa review, tetapi jalur pemilihannya dari daftar UI belum tersambung.

**Referensi:** [query daftar admin](../../src/server/admin/operations.ts), [halaman Review](../../src/app/(app)/app/admin/reviews/page.tsx), [rerun service](../../src/server/reviews/admin.ts).

**Saran:** tampilkan job/version yang gagal meskipun belum ada review, lengkap dengan identitas tugas dan tindakan rerun. Tes penerimaan: kegagalan sebelum review pertama dapat ditemukan dan dipulihkan dari dashboard.

### A4 — P2: Refund admin membuat reward terlihat bisa diklaim, tetapi klaim ulang ditolak

**Contoh sederhana:** admin membatalkan klaim dan mengembalikan poin. Tombol user aktif lagi, tetapi ketika ditekan muncul error.

**Bukti probe:** `participantButtonState: ready`; klaim ditolak dengan `Previous claim ended; use retryOf with its redemption ID for an intentional retry.`

**Akar masalah:** backend membutuhkan `retryOf` untuk klaim ulang yang disengaja. Client dan API milestone hanya mengirim/menerima slug. Ladder menganggap klaim yang dibatalkan bukan klaim aktif sehingga menawarkan tombol ready.

**Referensi:** [redemption service](../../src/server/rewards/redemption-service.ts), [milestone ladder](../../src/server/rewards/milestones.ts), [API klaim user](../../src/app/api/arena/milestones/take/route.ts), [client user](../../src/lib/participant-client.ts).

**Saran:** sambungkan retry yang valid dari klaim lama ke UI/API, atau tampilkan keadaan yang jelas jika kebijakan melarang klaim ulang. Jangan menghapus perlindungan terhadap klaim ganda.

### A5 — P2: Stok reward habis tidak tercermin pada tombol user

**Contoh sederhana:** admin mengatur stok menjadi nol, user tetap melihat reward siap diambil. Penolakan baru muncul setelah klik.

**Bukti probe:** `adminStock: 0`, `participantButtonState: ready`, klaim ditolak dengan `Reward stock is unavailable in the active period.`

**Akar masalah:** ladder mempertimbangkan katalog, poin, dan klaim, tetapi belum membaca ketersediaan inventory periode aktif. Pemeriksaan stok saat transaksi sudah bekerja; ini bukan bukti overselling.

**Referensi:** [inventory admin](../../src/server/admin/operations.ts), [milestone ladder](../../src/server/rewards/milestones.ts), [klaim](../../src/server/rewards/redemption-service.ts).

**Saran:** sertakan ketersediaan stok/periode pada data user dan tampilkan status habis. Tetap pertahankan pemeriksaan stok saat transaksi untuk menangani perubahan bersamaan.

### A6 — P2: Overview admin dapat menampilkan minggu berbeda dari user

**Contoh sederhana:** saat peserta mengerjakan minggu aktif, admin menyiapkan draft minggu depan. Overview langsung beralih ke draft tersebut, sehingga angka peserta/submission dapat terlihat nol.

**Bukti probe:** admin melihat `DRAFT`, user melihat `OPEN`, `sameWeek: false`.

**Akar masalah:** overview mengambil minggu dengan opensAt paling besar tanpa memilih minggu aktif. Resolver user memprioritaskan minggu OPEN yang aktif.

**Referensi:** [overview admin](../../src/server/admin/overview.ts), [resolver minggu](../../src/server/arena/week-service.ts).

**Saran:** gunakan definisi minggu aktif yang sama atau pemilih minggu yang eksplisit. Tes penerimaan: membuat draft mendatang tidak diam-diam mengganti konteks monitoring minggu aktif.

## Bug yang diverifikasi lewat kode

### A7 — P2: Pesan maintenance admin hilang pada alur pendaftaran/workspace

Admin dapat mengisi pesan penutupan fitur. Backend membawa pesan tersebut, tetapi penanganan `FEATURE_CLOSED` pada ProjectDetail dan workspace menggantinya dengan teks generik. Instruksi spesifik admin tidak sampai ke user pada alur ini. Tombol pemilihan juga belum menggunakan flag sebagai dasar ketersediaannya.

Pemblokiran API tetap ada; masalahnya adalah komunikasi dan keadaan UI. Tampilkan pesan aman dari backend serta keadaan maintenance pada CTA yang relevan.

**Referensi:** [ProjectDetail](../../src/components/arena/ProjectDetail.tsx), [workspace](../../src/app/(app)/app/arena/workspace/[projectId]/page.tsx), [flags](../../src/server/ops/feature-flags.ts).

### A8 — P2: Petunjuk admin CV Scanner mengarah ke saklar yang tidak tersedia

Halaman CV Scanner menyuruh operator memakai **Saklar Darurat** untuk menutup fitur. Daftar saklar hanya mencakup enrollment, submissions, publish, dan rewards; aktivasi CV Scanner dibaca dari environment variable `NEXT_PUBLIC_CV_SCANNER_ENABLED`.

Dampak: petunjuk penanganan insiden menyesatkan operator. Selaraskan petunjuk dengan mekanisme yang benar; menambahkan kontrol CV baru membutuhkan pekerjaan tersendiri. Audit ini tidak mengubah CV Scanner.

**Referensi:** [halaman CV admin](../../src/app/(app)/app/admin/cv-scanner/page.tsx), [daftar saklar](../../src/server/ops/feature-flags-core.ts), [aktivasi CV](../../src/lib/cv-scan-limits.ts).

## Alur yang belum lengkap dari dashboard

Ini keterbatasan operasional atau kebutuhan produk yang belum terpenuhi; bukan semuanya bug runtime.

| Menu admin | Bagian yang belum lengkap | Dampak/keputusan yang diperlukan |
|---|---|---|
| Project editor | Tidak menyediakan pengelolaan resource/dataset; requirements dan skills hanya-baca. | Admin belum dapat memperbaiki resource tugas dari editor. Jalur resource ke user sudah ada pada kode sekarang, jadi temuan ini bukan berarti resource selalu hilang di sisi user. |
| Divisions | Membuat divisi belum cukup untuk menghasilkan project pertamanya: generator memerlukan frozen base rubric. Script bootstrap yang disarankan memerlukan project PUBLISHED/ARCHIVED yang sudah ada. | Divisi baru membutuhkan proses inisialisasi rubric/library/project pertama yang eksplisit; klik tambah divisi belum menyelesaikan alur peluncuran. |
| Reward fulfillment | Admin mencatat fulfillment, user melihat status/tanggal; belum ada jalur penyerahan kode/link/instruksi reward lewat profil. | Jika pengiriman memang manual di luar aplikasi, jelaskan kanalnya. Jika dijanjikan dalam aplikasi, tambahkan data penyerahan khusus user. Referensi internal admin tidak harus dibuka ke user. |
| Career Report | Halaman admin menyatakan belum ada yang bisa dikelola. | Menu ini informasional, belum alat operasional untuk meninjau atau mengoreksi laporan peserta. Ini tidak membuktikan laporan user rusak. |

Referensi: [project editor](../../src/app/(app)/app/admin/projects/[id]/page.tsx), [divisions](../../src/app/(app)/app/admin/divisions/page.tsx), [generation context](../../src/server/generation/service.ts), [bootstrap](../../scripts/bootstrap-generation-library.mjs), [participant data](../../src/server/arena/participant-service.ts), [profil](../../src/components/arena/ParticipantProfile.tsx), [Career Report admin](../../src/app/(app)/app/admin/career-report/page.tsx).

Catatan pembanding: status aktif sumber Jobs digunakan oleh query lowongan user. Tidak ada dasar dari pemeriksaan ini untuk menyebut pengaktifan/nonaktifannya tidak terintegrasi.

## Urutan tindak lanjut

1. Tutup celah submission sesudah close dan inkonsistensi koreksi nilai setelah finalisasi.
2. Hubungkan daftar kegagalan review pertama ke pemulihan melalui admin.
3. Selaraskan reward retry, stock, serta konteks minggu overview.
4. Perbaiki pesan maintenance dan petunjuk saklar CV.
5. Putuskan proses divisi pertama, pengelolaan resource, serta kanal pengiriman reward sebelum dipakai operator.

Probe tersimpan di [scripts/audit-admin-user-integration.mjs](../../scripts/audit-admin-user-integration.mjs). Untuk mengulang dengan Docker lokal aktif:

```powershell
node scripts/local-dev.mjs --setup-only
node scripts/audit-admin-user-integration.mjs
```

Probe ini bergantung pada fixture lifecycle dan sengaja mengharapkan perilaku bug. Setelah perbaikan, ubah menjadi tes regresi yang mengharapkan perilaku benar; jangan memakai hasil lolos probe sebagai tanda siap rilis.
