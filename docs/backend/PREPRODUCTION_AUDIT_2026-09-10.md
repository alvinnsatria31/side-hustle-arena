# Audit kesiapan produksi Side Hustle Arena — 10 September 2026

**Keputusan: belum layak membuka kompetisi produksi.** Alur inti sudah berjalan di sandbox, tetapi ada masalah pada konfigurasi penilai kedua, input penilaian n8n, kelengkapan proyek, resource, dan komunikasi status submission.

Audit sekitar 18.13–18.28 WIB. Source terakhir yang diperiksa: `e7b4e53`, beserta working tree yang sudah ada. Ada commit dari pekerjaan lain masuk selama audit; kegagalan awal tes generator sudah ditutup oleh perubahan tersebut dan tidak dihitung sebagai bug terbuka. Laporan ini tidak mengubah aplikasi atau konfigurasi produksi.

## Cara membaca bukti

- **Live:** diperiksa langsung melalui endpoint publik atau pembacaan konfigurasi/workflow di VPS. Tidak memicu cron, menilai submission, mengirim email, menerbitkan proyek, atau menukar reward produksi.
- **Reproduksi kode:** menjalankan fungsi asli yang diekstrak dengan TypeScript AST atau node Code n8n menggunakan input terkontrol. Ini bukan simulasi klik browser.
- **Penelusuran source:** penyebab terlihat dari hubungan kode, tetapi skenario belum dijalankan di browser/live.
- **Belum terbukti E2E:** ada implementasi, tetapi seluruh rantainya belum diuji dengan layanan nyata dalam audit ini. Ini tidak otomatis berarti fiturnya rusak.

Tidak memakai angka persentase kesiapan karena coverage sandbox dan acceptance produksi mengukur hal berbeda.

## Masalah yang perlu diselesaikan sebelum rilis

### 1. P1 — Konfigurasi live menolak penilai kedua

**Bahasa mudah:** kalau AI pertama ragu dan sistem meminta penilai kedua, jalur tersebut gagal sebelum memanggil model.

**Bukti live:** container `sk-arena` memakai `APP_ENV=production`, `AI_REVIEW_PROVIDER=openai`. Bundle terpasang `/app/.next/server/chunks/9057.js` dan source hanya menerima `openai-compatible`. Memanggil factory asli dengan nilai konfigurasi tersebut menghasilkan `AI review provider is not configured.` tanpa panggilan eksternal.

Reviewer utama n8n memanggil provider sendiri, sehingga polling n8n yang sukses tidak membuktikan jalur judge aplikasi sehat. Jalur yang membutuhkan judge memanggil factory ini saat menyelesaikan lease.

**Sumber:** `src/server/reviews/model-router.ts:143`; `src/server/reviews/queue-service.ts:266`, `:356`.

**Perbaikan/acceptance:** selaraskan nilai konfigurasi; jalankan submission yang sengaja memicu second judge sampai hasil tersimpan, termasuk retry dan finalisasi.

### 2. P1 — Brief dan batas kemampuan penilaian terbuang di n8n

**Bahasa mudah:** aplikasi sudah menyiapkan penjelasan tugas, tetapi n8n mengirim ke model hanya judul, divisi, rubrik, dan teks bukti. AI kehilangan konteks tentang apa yang sebenarnya diminta dari peserta.

**Bukti:** node live `Build blind prompt` sama bentuknya dengan workflow repo. Reproduksi node asli dengan marker pada `input.brief.mission` dan `input.evidenceLimits`: keduanya tidak masuk prompt; teks sources masuk. Ini bukan klaim bahwa seluruh penilaian yang sudah ada pasti salah.

Masalah lebih besar untuk tugas desain: pipeline membaca gambar lewat OCR dan dokumen sebagai teks, bukan melihat layout atau mencoba interaksi. Instruksi batas bukti yang sudah dibuat aplikasi juga hilang di node ini. Penjelasan dan notes peserta tetap dapat masuk lewat sources; keduanya tidak disamakan dengan brief yang hilang.

**Sumber:** `n8n/arena-grading-workflow.json`, node `Build blind prompt` (sekitar baris 94); `src/server/reviews/queue-service.ts:213`; `src/server/reviews/reviewer-input.ts`, `describeEvidenceLimits`.

**Perbaikan/acceptance:** sertakan brief dan evidence limits, lalu uji isi prompt yang benar-benar diterima model. Kurasi rubrik desain sesuai bukti yang bisa dinilai atau sediakan pemeriksaan visual/manusia.

### 3. P1 — Proyek yang terlihat di domain live masih fixture dan kurang konteks

**Bahasa mudah:** peserta bisa memilih tugas, tetapi bahan untuk mengerjakannya belum cukup.

**Bukti live:** `/api/arena/week/current` mengembalikan `DEV-ARENA-CORE-CURRENT`, judul `Development Arena Core Week`, status `OPEN`. Ketiga proyek publik — Sales Insight Brief, Onboarding Improvement Plan, Checkout Flow Improvement — memiliki `caseBackground:null` dan `roleDescription:null`. Proyek sales meminta analisis dataset; resource tidak tersedia di respons detail.

Ini bukti konten publik belum siap, bukan kesimpulan bahwa database yang terpasang masih database development. Environment aplikasi justru production dengan host database `sk-arena-db`.

**Perbaikan/acceptance:** terbitkan minggu dan brief final, lengkap dengan data/konteks, peran, hasil yang diminta, dan contoh format pengumpulan. Buka setiap proyek sebagai peserta sebelum launch.

### 4. P1 — Resource/dataset belum tersambung sampai peserta

**Bahasa mudah:** generator bisa menyimpan tautan bahan tugas, tetapi peserta tidak bisa mengambilnya dari detail proyek maupun workspace.

**Bukti source:** package generator memiliki `resources`; service detail proyek tidak mengembalikannya; mapper publik menetapkan `resources: []`; workspace memakai `<ResourceList resources={[]} />`. Komponen ResourceList hanya menampilkan judul, tanpa URL atau tautan unduh. Jadi mengisi database saja belum menyelesaikan alur ini.

**Sumber:** `src/server/generation/service.ts:80`; `src/server/arena/project-service.ts:96`; `src/lib/arena-view.ts:206`; `src/app/(app)/app/arena/workspace/[projectId]/page.tsx:1177`; `src/components/arena/KanbanPreview.tsx:10`.

**Perbaikan/acceptance:** bawa URL/metadata melalui API dan mapper, render tautan nyata, lalu uji akses file sebagai peserta tanpa akses admin.

### 5. P1 — Form tidak bisa memenuhi dua requirement bertipe sama

**Bahasa mudah:** bila tugas meminta dua link berbeda, misalnya link laporan dan link spreadsheet, form selalu memasukkan keduanya ke kotak requirement pertama. Requirement kedua tetap dianggap kosong.

**Bukti reproduksi kode:** mapper memilih `.find(type === 'LINK')` dan `.find(type === 'FILE')`, hanya satu ID per tipe. Validator backend menghitung item untuk setiap ID requirement. Dengan dua requirement LINK wajib, form memilih `one` dan submit ditolak `SUBMISSION_REQUIREMENTS_INCOMPLETE`; maxItems=1 juga membuat penambahan kedua ditolak lebih awal. Generator mengizinkan hingga 10 requirement, sehingga bentuk proyek ini sah.

**Sumber:** workspace `page.tsx:181`, `:383`, `:470`; `src/server/submissions/service.ts:244`; `src/server/generation/core.ts:29`.

**Perbaikan/acceptance:** tampilkan upload/link per requirement dengan batas dan format masing-masing. Uji proyek dengan dua FILE, dua LINK, dan campuran keduanya.

### 6. P1 — UI bisa mengaku submission sukses padahal belum masuk review

**Bahasa mudah:** peserta bisa mendapat pesan “Project berhasil dikirim” lalu menunggu hasil yang tidak akan datang.

**Bukti penelusuran source:** halaman submission menerima draft yang punya lampiran/penjelasan, lalu selalu merender hero sukses dan langkah `Submission diterima: done=true`. Pada link yang tidak dapat diakses, backend membuat versi `accessStatus=FAILED`, tanpa alokasi attempt dan tanpa enqueue, tetapi tetap menyetel status submission `SUBMITTED`. UI tidak membaca status akses versi tersebut, sehingga terlihat seperti menunggu review normal.

Halaman recap juga membaca item draft, bukan item snapshot versi yang dinilai. Jika draft diedit setelah submit, tampilan recap dapat berbeda dari kiriman yang masuk reviewer.

**Sumber:** `src/app/(app)/app/arena/submission/[projectId]/page.tsx:66`, `:188`, `:299`; `src/server/submissions/service.ts`, `serializeSubmission`, `createVersion`, `submitArenaSubmission`.

**Perbaikan/acceptance:** bedakan draft, akses gagal, antre, sedang dinilai, gagal permanen, dan final. Tampilkan versi yang benar-benar dikirim beserta tombol memperbaiki; uji refresh setelah submit link tidak dapat diakses.

### 7. P1 — Isi link belum dibekukan saat submit

**Bahasa mudah:** batas waktu mengunci tombol submit, tetapi pemilik Google Docs/website masih bisa mengubah isi link sebelum worker membacanya. Yang dinilai bisa merupakan pekerjaan setelah deadline.

**Bukti penelusuran source:** versi submission menyimpan `externalUrl`; pengecekan saat submit hanya memastikan akses. Pengambilan isi dan penyimpanan review artifact untuk LINK baru dilakukan di `ensureReviewSources` saat membangun input review. FILE sudah memiliki snapshot saat submit; LINK belum memiliki jaminan waktu yang sama.

**Sumber:** `src/server/submissions/service.ts`, `draftItemsAccessible` dan `createVersion`; `src/server/reviews/artifacts.ts:53`; `src/server/reviews/queue-service.ts:213`.

**Perbaikan/acceptance:** bekukan konten link saat submit atau wajibkan artefak ekspor untuk penilaian resmi. Uji submit → ubah isi link → claim terlambat; nilai harus mengacu pada isi yang dikirim sebelum deadline. Tidak mencoba skenario manipulasi terhadap produksi.

### 8. P1 — Scheduler dapat terlihat sukses ketika pekerjaan gagal

**Bahasa mudah:** lampu n8n hijau belum tentu berarti proyek berhasil terbit, email terkirim, atau minggu berhasil ditutup.

**Bukti:** `Summarise the run` di repo dan workflow live mengembalikan `ok:false` tanpa menggagalkan workflow. Reproduksi node dengan HTTP 500 selesai normal dan menghasilkan `{status:500, ok:false}`. `data.done === false` juga dipakai untuk beberapa keadaan skip/deferred, sehingga failure bisnis perlu dibedakan dari pekerjaan yang memang belum waktunya.

Sampel live terbaru justru sehat tetapi kosong: #3169 email-flush mengirim 0 email; #3165 close/finalize skip karena tidak ada minggu yang perlu diproses; #3173 grading tidak menemukan job. Sampel ini tidak membuktikan satu siklus peserta sudah sukses.

**Sumber:** `n8n/arena-trigger-workflow.json`, node `Summarise the run` (sekitar baris 163); `src/server/ops/automation-health.ts`, `HEARTBEAT_EXPECTATIONS` juga belum mencakup generate/drop/close/finalize.

**Perbaikan/acceptance:** pisahkan skip normal dari error, tandai workflow gagal untuk error, dan pasang notifikasi/monitor eksternal. Uji HTTP 500, credential salah, dan antrean macet.

### 9. P1 bersyarat — Reward voucher belum selesai lintas aplikasi

**Bahasa mudah:** poin bisa dipotong dan klaim dicatat, tetapi voucher belum otomatis menjadi kode yang dapat digunakan di checkout main site.

**Bukti:** `pushRewardCode` masih berstatus `CONTRACT PENDING` dan tidak punya pemanggil dalam `src`. `MAIN_SITE_VOUCHER_TOKEN` tidak terpasang di container live. `fulfillRedemption` mencatat referensi fulfillment manual; fungsi tersebut bukan pengirim uang atau pembuat voucher di main site.

**Sumber:** `src/server/rewards/voucher-push.ts:16`, `:31`; `src/server/rewards/redemption-service.ts:158`.

**Perbaikan/acceptance:** bila menjanjikan voucher otomatis, sambungkan kontrak dan uji kode dipakai di checkout. Bila memilih fulfillment manual, nyatakan proses/SLA dan buktikan barang/kode benar-benar diterima sebelum menandai fulfilled. Ini blocker hanya untuk janji reward yang membutuhkan integrasi tersebut.

## Bug UI tambahan

### 10. P2 — Submit pertama dengan link yang belum ditambahkan berhenti di tengah

Isi link pertama, centang checklist, langsung klik submit tanpa tombol `Tambah Link`. Handler menyimpan link ke server, memanggil `setLinks`, lalu memeriksa `links.length` dari render lama yang masih nol. Pesan menjadi “Tambahkan minimal satu file atau link dulu.” dan fungsi submit tidak terpanggil. Peserta harus klik lagi.

**Bukti:** menjalankan handler asli menghasilkan `link_saved`, lalu pesan tersebut; tidak ada `submit_called`. **Sumber:** workspace `page.tsx:479–504`.

**Acceptance:** satu klik menyimpan link dan membuat tepat satu versi submission; tombol dikunci sejak operasi pertama untuk mencegah request bersamaan.

### 11. P2 — Detail proyek lama menampilkan minggu/deadline minggu aktif

Service mengizinkan membuka proyek ARCHIVED, tetapi mapper detail mengambil `getCurrentArenaWeek()` untuk label minggu dan deadline, serta selalu menetapkan `isThisWeek:true`. Workspace historis juga mengambil minggu aktif. Saat minggu berganti, detail proyek lama bisa memberi tanggal yang salah. Beberapa teks submission masih menjanjikan finalisasi Jumat 23:59 meski ad-hoc bisa jatuh di hari lain.

**Bukti:** penelusuran source. **Sumber:** `src/lib/arena-view.ts:177–216`; workspace `page.tsx:268–282`; submission `page.tsx:193`, `:318`.

**Acceptance:** semua label mengacu ke week milik proyek/enrollment; uji proyek historis saat minggu baru aktif dan deadline ad-hoc.

### 12. P2 — Tombol “Batalkan upload” hanya menghilangkan baris

Handler membuang entry dari state UI, tetapi tidak memanggil `XMLHttpRequest.abort()` atau membatalkan finalize. Upload tetap dapat selesai dan menambahkan file ke draft setelah peserta merasa membatalkannya. Karena status busy berasal dari daftar tersebut, tombol submit juga bisa aktif terlalu cepat.

**Bukti:** penelusuran source, belum direproduksi dengan jaringan lambat di browser. **Sumber:** workspace `page.tsx:198` (`putToCos`), `:375` (`runUpload`), `:980–981`.

**Acceptance:** batalkan request dan cegah finalize pascapembatalan; uji upload lambat → cancel → tunggu → reload, file tidak masuk draft.

### 13. P2 — Mode reduced motion memunculkan hydration mismatch

Tes browser memakai `reducedMotion: reduce`. Log React menunjukkan HTML server mempunyai `opacity:0`/transform, tetapi render client pada komponen Reveal/Entrance tidak. React menyatakan atribut tersebut tidak diperbaiki saat hydration. Ini risiko konten tetap tersembunyi atau tampil tidak konsisten bagi pengguna yang mengurangi animasi; screenshot visual untuk mengukur dampak pastinya belum diperoleh.

**Bukti:** warning aktual dalam tes browser, termasuk route showcase yang memakai komponen bersama. **Sumber:** `src/components/motion/Reveal.tsx:16`, `:38`; `playwright.sandbox.config.ts`.

**Acceptance:** render awal konsisten antara server dan client; periksa screenshot dengan reduced motion aktif dan nonaktif, pastikan konten langsung terlihat dan tidak ada hydration warning.

## Mana yang sudah dan belum end-to-end

| Alur | Bukti pada audit ini | Yang masih harus ditutup |
|---|---|---|
| Situs dan katalog | Domain live, health, week, projects, auth-session merespons 200 | Konten minggu/proyek final, bukan fixture |
| Login main site → Arena | Session endpoint tersedia; auth fixture dipakai tes lokal | Login/logout lintas domain nyata, cookie expiry, kembali ke tujuan semula |
| Generate → preview → publish | Kode/tes offline tersedia; generation/auto-publish flag live aktif | Satu batch final berkualitas, resource terbuka, semua divisi yang dijanjikan terbit |
| Pilih → workspace → upload → submit | Lifecycle sandbox 8/8 | Multi-requirement, status gagal, browser dengan storage produksi |
| File tersimpan → reviewer | Snapshot/checksum dan replay upload lulus sandbox | COS nyata; LINK dibekukan sesuai deadline |
| Claim → AI → complete | Workflow live aktif; sampel terkini antrean kosong | Brief sampai model; konfigurasi judge; acceptance model nyata sampai hasil |
| Retry/lease/judge | Ada implementasi dan tes offline | Provider gagal/low-confidence/reclaim pada environment target sampai pulih |
| Deadline → close → finalize | Cadence live per jam; tick terakhir skip dengan benar | Satu minggu berisi peserta selesai otomatis, termasuk ad-hoc |
| Hasil → ranking → poin | Lifecycle sandbox memeriksa hasil tersegel dan poin tepat sekali | Verifikasi siklus live dan tampilan hasil peserta |
| Showcase/consent | Tes browser grant/revoke consent lolos lokal | Verifikasi artefak/consent pada deployment target |
| Inbox → email diterima | Tes offline; email-flush live merespons 200 dengan sent=0 | Email benar-benar masuk inbox, retry dan idempotency |
| Poin → reward diterima | Ledger dan fulfillment manual tersedia | Voucher lintas main site atau proses fulfillment manual yang diterima peserta |
| Admin/monitoring/release | Role tests lokal, workflow aktif, typecheck/lint tersedia | Alarm bisnis, lifecycle/browser dalam CI, snapshot visual mobile |

CV Scanner, Jobs Portal, dan Career Report tidak diaudit mendalam sebagai produk terpisah. Sebagian tes browser yang tersedia memang melewati route tersebut; tidak ada perubahan pada produk/automasi itu.

## Verifikasi dan batas pemeriksaan

- `npm run test:offline` terakhir: **266 pass, 0 fail**. Runner mengecualikan suite yang membutuhkan database/provider sebelum menjalankan suite terpilih; angka skipped=0 dalam ringkasan Node bukan berarti semua suite repo dijalankan.
- `npm run test:local:lifecycle`: **8 pass, 0 fail**, database dan MinIO lokal; reviewer stub, bukan penerimaan model eksternal.
- `npm run test:browser:local`: **17 pass**, Chromium desktop. Ada hydration warning. Suite ini bukan seluruh alur upload/submission Arena dan bukan pemeriksaan seluruh ukuran HP.
- `npm run typecheck`: lolos; `npm run db:check`: lolos, memeriksa kontrak schema repository, bukan bukti backup/restore atau parity semua data produksi.
- `npm run lint`: **0 error, 18 warning** pada saat dijalankan.
- Build produksi (`next build --webpack`) dengan konfigurasi sandbox: **lolos, exit 0**, termasuk kompilasi, TypeScript, prerender, dan build traces. Ini bukti build lokal, bukan deployment baru.
- Probe fungsi asli: membuktikan multi-requirement, stale-state link pertama, input prompt hilang, dan summary HTTP 500 tidak menggagalkan node.
- Browser interaktif melalui CUA tidak tersedia di sesi ini; tidak mengklaim sudah melakukan inspeksi visual manual desktop/mobile atau login produksi.
- Tidak ada pengiriman email, deployment, perubahan environment live, penerbitan proyek, penilaian peserta nyata, atau transaksi reward oleh audit ini.
- File/commit dari pekerjaan lain tetap dipertahankan. Laporan ini adalah hasil audit, bukan implementasi perbaikan.

## Urutan penyelesaian

1. Benahi provider judge dan prompt n8n; siapkan minggu/proyek final beserta resource.
2. Betulkan form per requirement, status kiriman gagal/draft, dan pembekuan konten link.
3. Benahi monitoring error; tentukan apakah reward rilis manual atau otomatis.
4. Perbaiki bug interaksi, tanggal, dan reduced motion.
5. Jalankan satu acceptance lengkap di environment target: login → pilih → buka bahan → upload/link → submit → AI + judge → deadline → finalisasi → ranking/poin → email → fulfillment reward. Sertakan kasus gagal, retry, dan rerun tanpa duplikasi.

**Kriteria go-live:** langkah di atas punya hasil teramati, bukan hanya endpoint 200 atau workflow berlabel success.
