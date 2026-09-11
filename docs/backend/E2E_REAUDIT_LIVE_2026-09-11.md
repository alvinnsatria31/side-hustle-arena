# Audit ulang end-to-end — 11 September 2026, sekitar 21.40–21.49 WIB

## Ringkasan

Pemeriksaan kali ini menggabungkan **working tree terbaru** pada HEAD `424a95d`, tes lokal terarah, **GET website publik**, dan **query read-only database/container produksi**. Ada perubahan lokal yang belum di-commit; laporan ini tidak menganggap semua perubahan itu sudah dideploy.

**Delapan bagian masih memerlukan pekerjaan:** empat terbukti pada konfigurasi/data live, tiga direproduksi pada batas antarkomponen dengan input sintetis, satu merupakan keterbatasan pemulihan dari dashboard. Ini bukan pengulangan daftar bug sebelumnya.

43 tes perbaikan sebelumnya lolos: isolasi CV, cursor Inbox, status hasil terpublikasi, saved projects, label evidence, dan akuntansi/voucher. Tes tersebut tidak membuktikan semua perubahan sudah terpasang di live.

## R1 — Project analisis sudah terbit, dataset yang dijanjikan tidak disediakan

**Prioritas: tinggi. Bukti live.**

Project **Analisis Retensi Pelanggan untuk Optimasi Kampanye Pemasaran di Ritel Online** menyatakan peserta diberikan data transaksi pelanggan selama dua tahun. Tetapi API detail mengembalikan `resources: []`, dan database tidak memiliki resource untuk ketiga project pada minggu yang sedang dipilih website.

Project meminta PDF analisis serta dashboard publik. Instruksi deliverable tidak menyediakan dataset atau menjelaskan bahwa peserta harus membuat/mencari data sendiri.

**Alur putus:** generate brief → sediakan bahan kerja → validasi kelengkapan → publish. Editor resource sudah ada, tetapi pemeriksaan publish belum memastikan bahan yang dijanjikan brief benar-benar tersedia. Schema mengizinkan array resource kosong.

**Akibat:** peserta mendapat tugas yang terlihat siap diambil tetapi tidak punya bahan untuk mengerjakan analisis sesuai brief.

**Selesai jika:** resource nyata dapat dibuka peserta, atau brief direvisi secara konsisten menjadi tugas pengumpulan/pembuatan data; project yang menjanjikan dataset tidak boleh lolos pemeriksaan tanpa dataset.

Sumber: [detail project live](https://arena.sekolahkarir.id/api/arena/projects/weekly-gen-test-2026-w37-65a24bb8-694cb01b); `src/server/generation/core.ts` (`packageSchema.resources`); `src/server/generation/service.ts` (`publishWeek`).

## R2 — Minggu uji coba mengambil alih minggu utama website

**Prioritas: tinggi untuk kesiapan rilis. Bukti live + source resolver.**

Database produksi memiliki dua minggu OPEN:

| Minggu | Dibuka, UTC | Deadline, UTC |
|---|---|---|
| `GEN-TEST-2026-W37` | 11 September 10:46 | 18 September 10:46 |
| `ARENA-KICKOFF-WEEK-1` | 10 September 14:00 | 14 September 16:59 |

GET `/api/arena/week/current` memilih `GEN-TEST-2026-W37`, berjudul **Generation verification week**. Katalog publik menampilkan tiga project minggu pengujian tersebut.

**Alur putus:** uji/ad-hoc launch → pemisahan dari jadwal peserta → pemilihan minggu aktif. Resolver memilih OPEN dengan opensAt paling baru. Enrollment hanya menerima project pada minggu pilihan resolver; akibatnya status kickoff yang masih OPEN tidak berarti project kickoff masih dapat dipilih peserta baru.

Ini temuan data/operasional dan kebijakan overlap, bukan bukti database rusak. Audit tidak menutup atau mengubah minggu mana pun.

**Selesai jika:** ada minggu peserta yang ditetapkan jelas; data verifikasi tidak mengambil alih katalog; kebijakan beberapa minggu OPEN diputuskan dan ditegakkan.

Sumber: [minggu live](https://arena.sekolahkarir.id/api/arena/week/current); `src/server/arena/week-service.ts:28`; `src/server/arena/enrollment-service.ts` (`PROJECT_NOT_IN_ACTIVE_WEEK`).

## R3 — Voucher otomatis belum tersambung ke situs utama pada deployment live

**Prioritas: tinggi jika penyerahan otomatis dijanjikan. Bukti konfigurasi live.**

Pada container `sk-arena`, kedua variabel berikut belum terisi:

```text
MAIN_SITE_ORIGIN = tidak terkonfigurasi
MAIN_SITE_VOUCHER_TOKEN = tidak terkonfigurasi
```

Katalog live memiliki reward DISCOUNT dan MASTERCLASS aktif. Kode jalur klaim/push sudah tersedia, tetapi tanpa konfigurasi ini push melaporkan tidak tersedia dan klaim perlu pemenuhan manual.

**Alur putus:** klaim poin → kirim kode → kode terdaftar di situs utama → dapat dipakai di checkout. Menambah env saja belum cukup sebagai bukti selesai; kontrak penerbitan dan pembatalan kode pada situs tujuan juga perlu diverifikasi.

**Selesai jika:** satu klaim uji yang diizinkan menghasilkan kode yang diterima checkout, serta pembatalannya sesuai kebijakan. Tidak ada klaim atau voucher nyata dibuat oleh audit ini. Alternatif operasional saat ini adalah fulfillment manual yang dijelaskan dengan jujur kepada user.

Sumber: pembacaan presence env container, tanpa nilai kredensial; `src/server/rewards/voucher-push.ts`.

## R4 — Jobs sudah punya halaman dan pipeline, tetapi belum memiliki sumber live

**Prioritas: sesuai janji fitur saat rilis. Bukti database live.**

`arena.job_sources` berisi **0 sumber**, dan `arena.job_openings` berisi **0 lowongan**. Job scheduler `jobs-sync` tercatat pernah berjalan, tetapi tidak punya sumber untuk ditarik.

**Alur putus:** daftarkan feed/provider → konfigurasi akses → sync berhasil → lowongan muncul → matching skill peserta. Form admin untuk menambahkan sumber kini sudah tersedia; data/provider awalnya yang belum disiapkan di live.

**Selesai jika:** minimal satu sumber yang disetujui berhasil disinkronkan dan hasilnya dapat ditelusuri dari daftar peserta sampai halaman lamaran. Tidak membuat/mengaktifkan sumber apa pun dalam audit ini.

## R5 — Brief dan batas bukti hilang pada request AI internal/judge

**Prioritas: tinggi untuk keandalan penilaian. Reproduksi transport lokal.**

Input review sebenarnya memiliki `brief`, `explanation`, dan `evidenceLimits`. Tetapi `ApiReviewProvider.review` hanya mengirim:

```json
["projectTitle", "divisionName", "rubric", "sources"]
```

Tes memakai class provider asli dengan transport yang menangkap request lalu berhenti; tidak menghubungi model. Ketiga field tidak ada dalam payload yang terkirim.

**Alur putus:** brief/penjelasan peserta → input review → payload model. Model internal/judge tidak mendapat latar kasus lengkap dan pemberitahuan bahwa bukti tertentu hanya teks/OCR.

Workflow n8n lokal sudah membangun prompt dengan brief dan evidenceLimits. Jadi temuan ini khusus **jalur provider internal/judge**, bukan klaim bahwa semua jalur AI kehilangan brief. Audit tidak mengukur dampak skor nyata akibat kekurangan input ini.

**Selesai jika:** semua jalur penilai mengirim konteks dan batas bukti yang sama; verifikasi pada payload HTTP sebenarnya, bukan hanya object sebelum adapter.

Sumber: `src/server/reviews/model-router.ts:118,129`; `src/server/reviews/reviewer-input.ts`; `src/server/reviews/queue-service.ts:251`; `n8n/arena-grading-workflow.json`.

## R6 — Dashboard interaktif/visual belum dinilai dari hasil render sebenarnya

**Prioritas: tinggi untuk tugas yang menilai visual/interaksi. Reproduksi extractor lokal + brief live.**

Project live menerima dashboard publik sebagai deliverable. Jalur pembacaan melakukan HTTP GET dan ekstraksi teks; tidak menjalankan JavaScript atau mengoperasikan dashboard. Gambar dibaca dengan OCR; layout/grafik tidak diteruskan sebagai visual ke model.

Probe HTML sintetis memiliki chart yang baru diisi melalui JavaScript. Hasil extractor asli:

```json
{"extracted":"Loading interactive dashboard, please wait.","chartContentPresent":false,"acceptedAsReadable":true}
```

**Alur putus:** deliverable interaktif → bukti yang benar-benar terlihat → penilaian. Halaman bisa lolos ambang panjang teks tanpa membawa chart yang dibuat peserta. Ini tidak berarti setiap URL dashboard gagal, tetapi tipe deliverable yang dijanjikan lebih luas daripada kemampuan pembaca bukti.

**Selesai jika:** dukung capture/render atau pemeriksaan manual untuk jenis bukti tersebut; alternatifnya wajibkan export/screenshot/data yang memang bisa dinilai, lalu sesuaikan rubric. Batas kemampuan harus sampai ke setiap penilai (terkait R5).

Sumber: `src/server/reviews/fetch-artifact.ts`; `src/server/reviews/extract.ts`; `src/server/reviews/artifacts.ts`; `src/server/reviews/reviewer-input.ts` (`describeEvidenceLimits`).

## R7 — Snapshot link masih bisa tertunda melewati waktu submit

**Prioritas: tinggi untuk konsistensi deadline. Reproduksi kegagalan terarah + source fallback.**

Snapshot file sudah tersedia. Untuk LINK, freeze dijalankan setelah transaksi submission selesai dan bersifat best-effort. Jika fetch/ekstraksi gagal, submission tetap diterima dan worker boleh mengambil konten lagi kemudian.

Probe transient timeout pada fungsi freeze asli menghasilkan:

```json
{"frozen":0,"deferred":1,"snapshotWrites":0}
```

**Alur putus:** submit sebelum deadline → bukti tidak berubah → review. Pada jalur gagal ini, isi dokumen eksternal dapat berubah antara submit dan pengambilan oleh worker. Jadi pembekuan LINK belum memiliki jaminan yang setara dengan FILE. Tidak mengklaim semua link selalu dibaca terlambat.

**Selesai jika:** putuskan kebijakan saat bukti tidak berhasil dibekukan: pending verifikasi yang jelas, bukti immutable alternatif, atau penanganan manual. Jangan menganggap fetch ulang sesudah deadline identik dengan isi saat submit.

Sumber: `src/server/submissions/service.ts` (pemanggilan freeze setelah transaksi); `src/server/reviews/artifacts.ts` (`freezeLinkArtifacts`, `ensureReviewSources`).

## R8 — Pembatalan voucher yang gagal belum dapat dipulihkan sampai selesai dari dashboard

**Prioritas: sedang; berlaku setelah integrasi voucher aktif. Penelusuran source terbaru.**

Perbaikan baru sudah menahan refund selama lease pengiriman dan mencoba membatalkan kode di situs tujuan. Jika pembatalan eksternal gagal, sistem menandai `REWARD_VOUCHER_RECONCILIATION_REQUIRED`.

Namun klaim lokal sudah ADMIN_REVERSED. Tombol push hanya tersedia pada PENDING/PROCESSING, tombol pembatalan tidak muncul untuk ADMIN_REVERSED, dan memanggil reversal ulang mengembalikan `voucher:null` karena status awal bukan PENDING/PROCESSING. Tidak ditemukan tindakan dashboard untuk mencoba void kembali atau menuntaskan rekonsiliasi tersebut.

**Alur putus:** pembatalan eksternal gagal → alarm admin → retry/konfirmasi selesai. Penanganan manual langsung di situs tujuan masih mungkin; alurnya belum selesai di dashboard Arena.

**Selesai jika:** ada tindakan rekonsiliasi/ulang void yang idempotent dan catatan hasilnya, atau prosedur operasional eksternal yang jelas. Belum direproduksi di layanan voucher nyata karena kontraknya tidak terkonfigurasi.

Sumber: `src/server/rewards/voucher-push.ts` (`reverseRedemptionAndRevokeVoucher`); `src/app/(app)/app/admin/rewards/page.tsx`; `src/app/api/internal/rewards/[id]/[action]/route.ts`.

## Yang sudah memiliki bukti berjalan

- CV Scanner live menampilkan form upload. Absennya `NEXT_PUBLIC_CV_SCANNER_ENABLED` pada runtime env **bukan** bukti fitur mati: flag ini ditanam saat build. Tidak ada scan berbayar dijalankan.
- Database live memiliki satu review job COMPLETED dan catatan WEEK_FINALIZED dari alur uji sebelumnya. Ini bukti ada siklus yang pernah berjalan, bukan sertifikasi semua skenario.
- Ada tiga delivery EMAIL berstatus SENT dengan provider reference. Ini bukti layanan pengirim menerima pengiriman, bukan verifikasi inbox penerima atau status dibaca.
- Heartbeat `email-flush`, `week-close`, `week-finalize`, `project-drop`, dan `jobs-sync` ada. Scheduler tidak dinyatakan mati hanya karena suatu pipeline belum memiliki input.
- Source terbaru sudah menambah daftar simpanan, pagination Inbox, pemisahan state CV, dan pembacaan hasil ARCHIVED. Tidak dimasukkan ulang sebagai fitur yang belum dibuat.

## Metode, artefak, dan batas

- 43 tes terarah pada perbaikan sebelumnya: pass, 0 fail.
- [Probe batas integrasi](../../scripts/audit-e2e-boundaries.mjs): tiga pass yang **mengonfirmasi celah**, bukan mengonfirmasi perbaikan. Jalankan dengan `node --import ./scripts/node-test-hooks.mjs --test --test-force-exit scripts/audit-e2e-boundaries.mjs`.
- Query live memakai `BEGIN READ ONLY`; hanya aggregate status, jadwal, konfigurasi presence, dan konten project yang memang publik.
- Tidak mengubah database live, mengarsipkan minggu, menerbitkan project, mengirim email, memanggil provider AI berbayar, atau menerbitkan/membatalkan voucher.
- Pemeriksaan ini tidak mengulang seluruh tes browser. Laporan sebelumnya tetap menjadi bukti historis, bukan hasil browser baru.
- Prioritas tindakan: bahan project dan minggu peserta yang benar → konteks/bukti penilaian → setup voucher dan Jobs → recovery eksternal.
