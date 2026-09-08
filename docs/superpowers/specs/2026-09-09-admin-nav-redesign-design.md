# Rombak navigasi konsol admin

Tanggal: 9 September 2026

## Konteks

Subdomain `arena.sekolahkarir.id` menjalankan empat produk peserta: CV Scanner,
Arena, Career Report, dan Jobs. Konsol adminnya hanya mencerminkan satu di
antaranya. Dari 13 halaman admin, 11 milik Arena, 1 menutup sebagian Jobs
(`Sumber Lowongan` — kesehatan provider saja), dan dua produk sisanya tidak
punya surface admin sama sekali.

Tiga gejala yang muncul dari situ:

1. **Nama grup tidak memandu.** Rail dikelompokkan sebagai
   "Konten / Operasi / Orang & Reward / Sistem" — kategori jenis pekerjaan, bukan
   sesuatu yang bisa dicari operator. Yang mencari Jobs harus tahu namanya
   "Sumber Lowongan" dan letaknya di bawah "Operasi".
2. **Dua menu nyaris kembar.** `Trigger Workflow` dan `Otomasi` bersebelahan dan
   sama-sama menjalankan job. Komentar di `AdminSidebar.tsx` sendiri mengakui
   keduanya sulit dibedakan sampai perlu ikon berbeda — itu menambal gejala,
   bukan sebabnya.
3. **Masalah tidak mengejar operator.** Satu-satunya tempat masalah muncul adalah
   kartu "Kesehatan otomasi" di Overview. Admin yang langsung membuka halaman
   lain bisa tidak melihat antrean review macet selama berjam-jam.

Hasil yang dituju: rail yang mencerminkan seluruh subdomain, mengajarkan urutan
kerja Arena, dan menunjukkan apa yang butuh tindakan tanpa perlu diklik.

## Keputusan yang sudah dikunci

| Keputusan | Pilihan | Alasan |
| --- | --- | --- |
| Bentuk rail | Produk sebagai grup, alur Arena bersarang | Konsol dipakai sesekali; melihat seluruh peta lebih berharga daripada rail pendek. Pola tab menyembunyikan tiga dari empat produk — mengulang masalah yang mau diselesaikan. |
| Kepadatan | Badge hanya untuk yang butuh tindakan | Hitungan hiasan ("Peserta 1.204") menambah keramaian tanpa menolong. Rail tanpa angka jadi punya arti: tidak ada kerjaan. |
| Subteks per menu | Tidak dipakai | Menggandakan tinggi rail; subteks dibaca sekali, scroll dirasakan tiap hari. Penjelasan ditaruh di `description` milik `AdminShell`. |
| Konsolidasi | `Trigger Workflow` digabung ke `Otomasi` | Keduanya satu pekerjaan: menyuruh sesuatu jalan sekarang. |
| Halaman produk baru | Ringkas, read-only | Cukup untuk "admin paham keadaan" tanpa menambah endpoint, scope, dan audit trail baru. |
| Career Report | Entri menu ada, halaman "belum tersedia" | Tidak punya data operasional (lihat di bawah). Menu tetap mencerminkan subdomain; isinya menyusul. |

## Temuan yang membentuk desain

**Career Report tidak punya data operasional.** `getCareerReport()` di
`src/server/career/report-service.ts` murni turunan — dihitung on-the-fly per
user dari `getParticipantOverview` + CV terakhir + taksonomi skill. Tidak ada
tabel, tidak ada event generasi, tidak ada kegagalan tercatat. Karena itu
halamannya sengaja hardcoded sebagai "belum tersedia" alih-alih menampilkan
angka yang tidak punya sumber.

**CV Scanner punya data nyata.** `arena.cv_scans` (userId, result, createdAt) dan
`getSpendWindow()` di `src/server/cv/rate-limit.ts` menyediakan kuota dan
pemakaian. Skema itu sengaja tidak menyimpan berkas atau teks CV, jadi tidak ada
yang bisa dimoderasi — ringkasan read-only memang bentuk yang tepat.

**Scope `storage` tidak punya halaman.** Terdaftar di `arenaAdminScopes` tapi
tidak dipakai menu mana pun. Dibiarkan apa adanya di luar cakupan ini; dicatat
supaya tidak terlupa.

## Struktur rail

```
Overview                              ● penanda bila health ≠ OK

PRODUK
  CV Scanner        /app/admin/cv-scanner        (baru)
  Career Report     /app/admin/career-report     (baru, placeholder)
  Jobs              /app/admin/careers           (label diubah)
  Arena
    Siapkan         Project · Divisi · Minggu
    Jalankan        Otomasi · Review
    Hasil           Reward

LINTAS PRODUK
  Peserta · Email · Saklar Darurat · Audit Log
```

`Peserta`, `Email`, `Saklar Darurat`, dan `Audit Log` berada di Lintas Produk
karena memang melintasi produk — user dan notifikasi bukan milik Arena saja.
`Reward` tetap di Arena karena poinnya lahir dari Arena.

**Penomoran grup dihitung ulang dari grup yang tampil.** Rail menyembunyikan item
di luar scope; kalau grup pertama hilang seluruhnya, penomoran statis akan mulai
dari "2" dan terbaca seperti bug.

## Penggabungan Trigger Workflow ke Otomasi

- Isi `TriggerWorkflow` menjadi bagian teratas di `/app/admin/jobs`.
- `/app/admin/workflows` tetap ada sebagai `redirect()` ke `/app/admin/jobs`
  supaya bookmark dan tautan dokumen tidak mati.
- Halaman gabungan butuh dua izin berbeda: `overview` untuk daftar job,
  `projects` untuk rilis off-schedule. Bagian rilis **hanya dirender** bila scope
  `projects` ada. Tanpa ini terjadi kemunduran halus: sebelumnya scope `projects`
  menjaga seluruh halaman `workflows`, dan menggabungkannya begitu saja akan
  menampilkan tombol yang pasti ditolak server.

## Badge tindakan

Hanya muncul bila ada yang perlu dikerjakan. Semua sumbernya sudah ada — tidak
ada pipeline metrik baru.

| Entri | Sumber | Muncul bila |
| --- | --- | --- |
| Overview | `health.level` | bukan `OK` |
| Review | `overview.needsResolution.length` | > 0 |
| Email | `health.email.backlog` | > 0 |
| Otomasi | `health.heartbeats` yang `overdue` | ada yang lewat |
| CV Scanner | sinyal `cv-spend` | WARN/ALERT |
| Career Report, Jobs, lainnya | — | tidak ada badge |

**Pengambilan data.** Rail adalah Client Component (butuh `usePathname`) dan tidak
punya akses data. Angka diambil sekali oleh `AdminLayout` (Server Component) dari
`getAutomationHealth()` yang sudah ada, lalu diteruskan sebagai prop. Menyegar
tiap pindah halaman. **Tidak ada polling** — biaya tanpa manfaat untuk konsol
yang dibuka sesekali.

**Aksesibilitas.** Penanda di Overview tidak boleh mengandalkan warna saja: tiap
badge membawa teks `sr-only` yang menyebut jumlah dan artinya (mis. "3 perlu
tindakan"). `aria-current="page"` yang sudah ada dipertahankan, begitu pula focus
ring — jangan dihapus demi estetika.

## Halaman baru

**`/app/admin/cv-scanner`** — read-only, scope `overview`:
- kuota jam berjalan dari `getSpendWindow()` (terpakai / plafon)
- jumlah scan hari ini dan 7 hari terakhir dari `arena.cv_scans`
- catatan eksplisit bahwa berkas dan teks CV tidak pernah disimpan, supaya tidak
  ada yang mencarinya

**`/app/admin/career-report`** — placeholder, scope `overview`:
- satu kartu yang menyatakan menu belum tersedia dan menjelaskan report dihitung
  on-the-fly tanpa menyimpan apa pun
- tanpa angka, tanpa tombol

## Berkas yang disentuh

| Berkas | Perubahan |
| --- | --- |
| `src/components/admin/AdminSidebar.tsx` | struktur `GROUPS` baru, sub-grup bersarang, badge, penomoran dinamis, prop `badges` |
| `src/app/(app)/app/admin/layout.tsx` | ambil `getAutomationHealth()`, turunkan badge ke rail |
| `src/app/(app)/app/admin/jobs/page.tsx` | sisipkan `TriggerWorkflow` dengan penjaga scope `projects` |
| `src/app/(app)/app/admin/workflows/page.tsx` | ganti isi dengan `redirect('/app/admin/jobs')` |
| `src/app/(app)/app/admin/cv-scanner/page.tsx` | baru |
| `src/app/(app)/app/admin/career-report/page.tsx` | baru, placeholder |
| `src/server/ops/automation-health.ts` | tambah fungsi turunan `getAdminNavBadges(health)` yang memetakan `AutomationHealth` menjadi `Record<href, {count, label}>`; murni, tanpa query baru |

Pola yang dipakai ulang: `AdminShell` untuk kanvas dan judul, `Card`/`PanelHeading`
untuk panel, `Badge` untuk penanda, token `sk-*` yang sudah ada. **Tidak ada
sistem warna atau font baru** — rekomendasi dari pencarian design-system sempat
mengarah ke pola landing page (palet gelap, tipografi raksasa, GSAP) yang tidak
berlaku untuk konsol internal dan akan membuang token `sk-*`.

## Verifikasi

1. `npx tsc --noEmit` bersih.
2. `npm run test:offline` tetap 263/263.
3. Rail dengan scope penuh menampilkan seluruh grup, penomoran 1–3 berurutan.
4. Rail dengan scope `["reviews"]` saja: grup kosong hilang, penomoran tetap mulai
   dari 1, tidak ada nomor bolong.
5. `/app/admin/workflows` mengalihkan ke `/app/admin/jobs`.
6. Halaman Otomasi dengan scope `overview` saja tidak menampilkan bagian rilis.
7. Badge muncul hanya saat sumbernya bukan nol; rail bersih saat semuanya sehat.
8. Keyboard: tab menyusuri rail sesuai urutan visual, focus ring terlihat.

## Di luar cakupan

- Membangun admin penuh (moderasi, kontrol kuota) untuk CV Scanner dan Career
  Report.
- Menyentuh Jobs Portal, WhatsApp CS/Volunteer, atau otomasi produk lain.
- Memberi rumah untuk scope `storage`.
- Mengubah navigasi peserta (`AppNavbar`, `MobileBottomNav`).
