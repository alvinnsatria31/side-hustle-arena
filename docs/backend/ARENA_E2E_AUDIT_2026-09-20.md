# Audit end-to-end Side Hustle Arena — 20 September 2026

Basis: working tree bersih pada HEAD `2677d20`, pembacaan produksi sekitar 22.16–22.30 WIB, dan tes baru pada mesin lokal. Scope: Arena, submission/review, generation/publication, finalisasi/poin, serta reward Arena. CV Scanner, Jobs, Career Report, Store, dan automasi produk lain tidak diaudit sebagai fitur Arena.

**Alur inti sudah tersambung, tetapi pengalaman lengkap belum siap pada semua jalur.** Ada empat gap konten/fulfillment/penilaian yang relevan terhadap data produksi, dua gap recovery pada source, dan satu gap pembuktian integrasi eksternal. Audit ini tidak mengubah aplikasi atau produksi.

## A1 — P1: Bahan tugas minggu berikutnya belum sesuai dengan janji brief

**Bukti: data produksi + source validator.** Minggu `ARENA-2026-09-21` berstatus PREVIEW dengan tiga project PREVIEWED. Pembukaan dijadwalkan 21 September pukul 08.00 WIB; `ARENA_AUTO_PUBLISH_ENABLED=true`.

| Project | Yang dijanjikan brief | Resource tersimpan |
|---|---|---|
| Prioritisasi Konten Bantuan dari Log Tiket Dukungan | Log tiket anonim satu kuartal; peserta wajib menyerahkan CSV hasil pembersihan | Sepuluh referensi seperti dokumentasi Pandas, Matplotlib, Python CSV, dan beranda UCI; tidak ada dataset tiket kasus ini |
| Evaluasi Pasca-Rilis Fitur Laporan Klien Otomatis | Metrik, 12 tiket dukungan, dan 5 kutipan wawancara | Enam artikel metodologi; brief mempunyai beberapa angka ringkasan, tetapi tiket dan kutipan yang dirujuk tidak tersedia dalam resource |
| Redesain Dasbor Pemantauan Pengiriman untuk Keputusan Cepat | Data operasional sintetis, screenshot dasbor lama, dan 8 catatan umpan balik | Enam panduan desain; bahan kasus yang dijanjikan tidak tersedia dalam resource |

Pemeriksaan publish hanya mensyaratkan resource berjumlah lebih dari nol. Referensi umum memenuhi pemeriksaan tersebut tanpa menyediakan bahan kerja. Ini lebih spesifik daripada audit lama tentang `resources: []`: sekarang resource ada, tetapi isinya tidak menuntaskan tugas yang dijanjikan.

**Dampak:** jika lolos pemeriksaan publish lainnya, peserta mendapatkan tugas yang tidak bisa dikerjakan sesuai brief tanpa mengarang atau mencari bahan pengganti sendiri. Audit tidak memicu publish untuk membuktikan seluruh gate lolos.

**Selesai jika:** setiap bahan kasus tersedia dan dapat diakses, atau brief secara eksplisit dan konsisten meminta peserta membuat/mengumpulkan data sendiri. Validasi kesiapan harus membedakan bahan kasus dari bacaan referensi.

Source: `src/server/generation/core.ts:298`, `src/server/generation/service.ts:466`.

## A2 — P1: Rubric visual lebih luas daripada bukti yang diterima penilai

**Bukti: rubric produksi + reproduksi extractor asli.** Project redesain minggu depan menilai flow, wireframe before/after, dan Presentation yang secara eksplisit meminta penilaian kerapian visual. Pipeline mengirim teks hasil ekstraksi atau OCR; gambar, layout, dan chart embedded tidak diteruskan sebagai visual. LINK diambil sebagai dokumen tanpa menjalankan JavaScript atau interaksi.

Probe `scripts/audit-e2e-boundaries.mjs` masih membuktikan HTML dengan chart yang dibuat JavaScript menghasilkan hanya `Loading interactive dashboard, please wait.`; teks tersebut melewati ambang keterbacaan, sementara isi chart tidak ada.

**Dampak:** submission bisa diterima tetapi kualitas visual yang menjadi bagian rubric tidak teramati. Pemberitahuan `evidenceLimits` sudah ada dan sekarang terkirim ke model; pemberitahuan itu belum membuat sistem mampu menilai visual. Audit tidak mengukur kesalahan skor aktual.

**Selesai jika:** bukti visual diteruskan ke penilai yang mampu membacanya, atau kriteria tersebut dialihkan ke pemeriksaan manusia/diubah agar sesuai dengan bukti yang tersedia. Menambah screenshot saja tidak cukup selama screenshot tetap diproses sebagai OCR saja.

Source: `src/server/reviews/extract.ts:53`, `src/server/reviews/reviewer-input.ts:87`, `scripts/audit-e2e-boundaries.mjs:24`.

## A3 — P1: Dua hadiah digital aktif belum bisa diserahkan otomatis

**Bukti: konfigurasi katalog produksi + service delivery.** `notion-kit` dan `ebook` aktif, keduanya bertipe DIGITAL, dan keduanya memiliki `delivery_url = NULL`.

Alur klaim dapat terbentuk, tetapi `deliverDigitalReward` mengembalikan `MANUAL_REQUIRED` ketika URL kosong. Dua redemption FULFILLED dalam database tidak membuktikan semua SKU aktif sudah memiliki jalur delivery.

**Selesai jika:** tautan/file final dipasang melalui admin, lalu satu klaim terkontrol membuktikan penerima bisa membuka materi dari riwayat klaim dan notifikasi. Jika pemenuhan memang manual, tetapkan proses dan estimasi penyerahan yang terlihat oleh peserta.

Source: `src/server/rewards/digital-delivery.ts:60`.

## A4 — P1: Voucher dan free pass belum tersambung ke checkout situs utama

**Bukti: presence konfigurasi produksi + service delivery.** Katalog aktif mempunyai `voucher-50` dan `free-pass`, tetapi container Arena tidak mempunyai `MAIN_SITE_ORIGIN` maupun `MAIN_SITE_VOUCHER_TOKEN`.

Service tidak dapat mendaftarkan kode ke situs utama dan meninggalkan fulfillment untuk admin. Ini tidak membuktikan endpoint situs utama rusak; koneksi dari Arena belum dikonfigurasi. Audit tidak membuat voucher, membatalkan voucher, atau mencoba checkout nyata.

**Selesai jika:** kontrak create dan void voucher tersedia, konfigurasi Arena dipasang, dan klaim terkontrol menghasilkan kode yang benar-benar diterima checkout dengan retry dan pembatalan yang konsisten. Tombol retry void sudah tersedia di source; gap recovery lama itu tidak dimasukkan ulang.

Source: `src/server/rewards/voucher-push.ts:68`, `src/server/rewards/voucher-push.ts:234`.

## A5 — P1: Publikasi sebagian dapat menutup jalur recovery project yang tertahan

**Bukti: penelusuran source; belum direproduksi dengan mutasi database.** `publishWeek` menerbitkan project yang valid dan mengubah week menjadi OPEN walaupun project lain masih `held`. Setelah itu:

- pemanggilan publish berikutnya langsung berhenti dengan `week already open`;
- scheduler hanya memilih DRAFT/PREVIEW/SCHEDULED untuk publication;
- edit/approve/regenerate memanggil `weekState(..., true)`, yang menolak week OPEN.

Contoh: dua divisi siap, divisi ketiga belum selesai masa preview atau perlu memperbaiki resource. Dua divisi terbit, tetapi divisi ketiga tidak bisa menyelesaikan jalur normal edit/approve/publish dalam minggu yang sama. Tes scheduler sekarang mensimulasikan retry ketika seluruh publikasi tertahan, bukan transisi partial publish dengan service/database asli.

**Selesai jika:** publikasi dibuat atomik sesuai kebijakan kelengkapan divisi, atau project belum terbit tetap boleh diperbaiki dan diterbitkan dalam week OPEN dengan guard yang tepat. Tambahkan verifikasi service nyata untuk kasus sebagian berhasil, sebagian tertahan, lalu retry.

Source: `src/server/generation/service.ts:39`, `src/server/generation/service.ts:455`, `src/server/generation/service.ts:490`, `src/server/scheduler/service.ts:190`, `scripts/project-scheduler.test.mjs:47`.

## A6 — P2: Minggu gagal generate belum memiliki recovery otomatis dan alarm hasil yang lengkap

**Bukti: kejadian produksi + source scheduler/health.** `ARENA-2026-09-14` masih DRAFT, tidak memiliki project, dan deadline-nya sudah lewat pada 18 September. Run generation terkait berakhir FAILED dengan alasan tidak ada package provider/library yang lolos. Terdapat 114 catatan `generation.publication-held` secara keseluruhan; catatan terakhir pada 18 September mempunyai `held: []` karena tidak ada project untuk diperiksa.

Generation otomatis hanya mempersiapkan minggu dalam jendela Minggu sebelum opensAt. Publication mengulang publish, tetapi tidak menghasilkan project pengganti untuk week kosong. Sesudah deadline, week tersebut keluar dari pemilihan publication tanpa berubah menjadi keadaan gagal yang ditangani secara khusus.

Heartbeat health memeriksa kapan job terakhir berjalan, bukan `metadata.done` atau apakah minggu yang seharusnya dibuka punya project. `recentRuns` ditampilkan terpisah dan tidak digunakan untuk menghitung level health. Jadi heartbeat segar bukan bukti siklus mingguan sukses. Ini tidak menyatakan seluruh dashboard produksi sedang berstatus OK; yang diverifikasi adalah kekurangan sinyal tersebut.

**Selesai jika:** ada deteksi minggu yang melewati jadwal buka tanpa project, tindakan catch-up/manual recovery yang jelas sebelum deadline, dan penutupan status/eskalasi setelah kesempatan recovery berakhir. Retry generation hari kerja perlu kebijakan preview/deadline yang eksplisit.

Generation minggu 21 September berhasil membuat tiga preview. Kegagalan 13 September tidak dipakai untuk menyatakan provider masih rusak sekarang.

Source: `src/server/generation/service.ts:501`, `src/server/scheduler/service.ts:190`, `src/server/ops/automation-health.ts:201`, `src/server/ops/automation-health.ts:225`.

## A7 — Gap verifikasi: SSO dan review eksternal belum dibuktikan ulang sebagai satu perjalanan browser

`e2e/arena-flow.spec.ts:254` dan `:256` masih mempunyai `test.fixme` untuk login melalui situs utama dan review AI eksternal. Fixture login membuat cookie sendiri; lifecycle lokal memakai reviewer stub. CI menjalankan tes offline, bukan perjalanan lintas aplikasi, n8n, provider AI, serta storage produksi.

Produksi memiliki dua review job COMPLETED dan hasil finalisasi, sehingga tidak benar menyebut pipeline review belum pernah berjalan. Namun itu bukan bukti seluruh perjalanan pada deployment sekarang, termasuk logout/masuk ulang lintas subdomain, submission dari browser, worker eksternal, hasil, reward, dan penanganan gagal.

**Selesai jika:** ada satu skenario release terkontrol dengan akun uji, real SSO, upload browser, worker/model nyata, finalisasi, dan penyerahan reward; ditambah skenario kegagalan penting. Audit ini tidak membuat akun, mengirim email, memanggil model berbayar, atau memodifikasi produksi.

## Bukti yang sudah positif

- `npm run typecheck`: exit 0.
- `npm run test:offline`: 380 pass, 0 fail, 47 suite dijalankan. Runner mengecualikan 24 file suite; `skipped: 0` pada hasil node:test hanya merujuk pada tes yang memang dijalankan.
- `npm run test:local:lifecycle`: 8 pass, 0 fail. Membuktikan enrollment, workspace, presigned upload nyata ke MinIO lokal, immutable snapshot termasuk replay byte berbeda dengan ukuran sama, review stub atas job fixture sendiri, hasil disegel sebelum finalisasi, poin idempotent, skill evidence, dan proteksi snapshot.
- Tes terarah tambahan: 18 pass, termasuk validasi placeholder, ranking, payload brief ke model, penolakan link snapshot gagal, dan reproduksi keterbatasan HTML interaktif. Satu tes adalah reproduksi gap, bukan bukti perbaikan.
- Heartbeat produksi terbaru tersedia untuk email-flush, project-generate/drop, week-close/finalize, notifikasi, dan cleanup. Scheduler tidak dinyatakan mati.
- Minggu kickoff FINALIZED; dua review job COMPLETED; 28 delivery berstatus SENT. SENT adalah status pengiriman sistem, bukan bukti inbox penerima dibaca.
- Minggu uji lama sekarang ARCHIVED; bug lama tentang minggu uji mengambil alih kickoff tidak dimasukkan ulang.
- Pada saat GET, current week adalah PREVIEW 21 September dan katalog project publik kosong. Kondisi sebelum jadwal buka ini tidak otomatis dikategorikan sebagai bug.

## Batas dan prioritas lanjutan

Query produksi memakai `BEGIN READ ONLY`; konfigurasi diperiksa sebagai presence/flag tanpa merekam nilai rahasia. Fixture tes hanya dibuat di sandbox lokal dan dibersihkan suite. Tidak ada deployment, publish, klaim reward nyata, atau modifikasi workflow. Kode lokal tidak diasumsikan identik dengan image produksi hanya karena container healthy. Graph lama 5 September dipakai sebagai peta awal lalu diverifikasi terhadap source sekarang.

Urutan tindakan: **lengkapi bahan tiga project sebelum auto-publish 21 September → sesuaikan penilaian visual → lengkapi delivery digital dan integrasi voucher → perbaiki partial publication/recovery week → lakukan release E2E lintas layanan.**

Laporan ini juga menjadi catatan handoff. CLI `brain` dan lokasi CLI yang disebut skill tidak tersedia pada mesin ini; journal bersama tidak diperbarui.
