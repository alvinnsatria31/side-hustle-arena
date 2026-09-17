# Toko Produk Digital

Menjual produk digital — template, panduan, dan aplikasi — dengan dua alat
bayar: Rupiah lewat Midtrans Snap, dan poin Arena yang sudah ada.

## Bentuk sistemnya

Schema Postgres `store`, sejajar dengan `arena` dan `rewards`.

Toko sengaja **tidak** disatukan dengan `rewards.catalog`. Reward adalah hadiah
yang ditebus peserta Arena: stoknya dibatasi per minggu, harganya wajib poin.
Produk toko adalah barang dagangan: stok tak terbatas, harga utamanya Rupiah,
pembelinya siapa pun yang punya akun. Satu tabel untuk dua peran berarti separuh
kolomnya NULL di setiap baris.

Yang **tidak** diduplikasi adalah saldo poin. Pembelian berpoin menulis ke
`rewards.point_ledger` dan `rewards.point_accounts` yang sama lewat jenis entri
`STORE_PURCHASE` dan `STORE_REFUND`, sehingga saldo peserta tetap satu angka di
bawah constraint `balance >= 0` yang sudah menjaganya. Dua dompet terpisah adalah
bug rekonsiliasi yang menunggu waktu.

### Tabel

| Tabel | Isinya |
|---|---|
| `store.products` | Etalase: jenis, status, harga, dan cara pengiriman. |
| `store.orders` | Satu pesanan satu produk, dengan salinan judul dan harga saat beli. |
| `store.entitlements` | Kepemilikan. Satu tabel untuk unduhan maupun akses aplikasi. |
| `store.payment_events` | Setiap notifikasi Midtrans, dicatat sebelum dijalankan. |

### Dua jenis produk

- **`DOWNLOAD`** — barang yang diserahkan. `delivery_kind = LINK` (Notion,
  Drive) atau `FILE` (objek di storage, diserahkan lewat presigned URL 10 menit).
- **`ACCESS`** — kunci. Pembelian membuka `feature_key`, dan halaman yang
  dilindungi memanggil `hasEntitlement(userId, featureKey)`. Inilah cara aplikasi
  dijual di sini: bukan tenant yang di-provision, bukan zip yang di-deploy.

Menambah aplikasi baru **tidak menyentuh toko sama sekali**: daftarkan
`feature_key` di `featurePaths` (`src/server/store/entitlement-service.ts`), buat
SKU `ACCESS` di konsol admin, dan panggil `hasEntitlement` di halamannya.
Contohnya sudah ada: `app-360` → `/app/360`.

### Empat status produk

`DRAFT` (tersembunyi) · `COMING_SOON` (tampil, tombol beli mati) · `ACTIVE`
(dijual) · `ARCHIVED` (ditarik).

`COMING_SOON` bukan `ACTIVE` yang dimatikan, melainkan status tersendiri: produk
yang isinya belum ada tetap layak dipajang. Itu yang menjaga toko tidak pernah
menjual sesuatu yang belum bisa diserahkan.

Kelengkapan dipaksa di `ACTIVE`, bukan di `DRAFT` — check constraint
`store_products_kind_check` dan `store_products_sellable_check` menolak produk
aktif yang tidak punya harga atau tidak punya cara pengiriman. Jadi katalog boleh
diisi sepotong-sepotong, tapi tidak bisa dijual sepotong.

## Alur pembayaran

### Poin — satu transaksi

Kunci akun poin → validasi saldo → buat order `FULFILLED` → debit ledger →
terbitkan entitlement → notifikasi. Tidak ada `PENDING`: poinnya sudah di tangan
kita, tidak ada yang perlu ditunggu.

### Rupiah — order dulu, baru Midtrans

1. Order `PENDING` dibuat dengan `provider_order_id` milik kita sendiri
   (`SKA-<uuid>`) sebelum Midtrans dihubungi. Urutan terbalik — minta ke Midtrans
   dulu, catat belakangan — membuat pembayaran bisa lunas atas referensi yang
   tidak ada di sisi kita, satu-satunya kegagalan yang tidak bisa dibereskan
   otomatis.
2. Snap token diminta **di luar transaksi**. Transaksi yang dibiarkan terbuka
   selama panggilan HTTP 15 detik memegang row lock selama 15 detik.
3. Token dan redirect URL disimpan di order. Midtrans menolak transaksi kedua
   untuk `order_id` yang sudah dikenalnya, jadi pembeli yang menutup popup harus
   diberi token yang sama.
4. `POST /api/webhooks/midtrans` menyelesaikannya.

### Webhook — tiga aturan

1. **Tidak ada yang dipercaya sebelum signature-nya diperiksa.** SHA-512 atas
   `order_id + status_code + gross_amount + server_key`, dibandingkan
   constant-time. Body tanpa signature sah tidak pernah disimpan.
2. **Tidak ada yang dijalankan dua kali.** `store.payment_events.event_key` unik.
   Baris yang ada tapi `applied_at`-nya kosong justru **diproses ulang** — itu
   bentuk pengiriman yang tercatat lalu crash sebelum mengubah apa pun, dan
   retry Midtrans adalah satu-satunya kesempatan menyelesaikannya.
3. **Jumlah yang dibayar harus sama dengan yang ditagih.** Notifikasi dengan
   nominal berbeda dicatat, diaudit, dan tidak pernah menyerahkan apa pun.

`capture` dengan `fraud_status: challenge` dipetakan ke `PENDING`, bukan `PAID` —
Midtrans sedang menahannya untuk ditinjau manusia. Status yang tidak dikenal juga
`PENDING`: status yang belum pernah kita lihat bukan izin untuk menyerahkan
barang.

Kode status balasan dipilih berdasarkan cara Midtrans membacanya: **200** untuk
apa pun yang dimengerti (termasuk duplikat dan order tak dikenal — mengulangnya
tidak akan mengubah hasil), **401** untuk signature palsu, **400** untuk body
yang bukan notifikasi, **500** hanya kalau kesalahan ada di kita.

## Permukaan

| Rute | Untuk siapa |
|---|---|
| `/store`, `/store/[slug]` | Publik. Bisa dilihat tanpa login; checkout memaksa masuk. |
| `/app/store` | Pembeli: daftar kepemilikan + riwayat pesanan. |
| `/app/360` | Contoh halaman terkunci `ACCESS`. |
| `/app/admin/store` | Owner: CRUD produk, unggah berkas, kelola pesanan. |
| `POST /api/webhooks/midtrans` | Midtrans. |

Scope admin: `store` (terpisah dari `rewards` — yang satu membagi hadiah, yang
satu memindahkan uang pelanggan).

## Menyalakannya

`NEXT_PUBLIC_STORE_ENABLED=true` membuka navigasi, halaman publik, dan API
pembeli sekaligus. Konsol admin **tidak** ikut tertutup: mengisi etalase justru
yang dikerjakan sebelum toko dibuka.

**`NEXT_PUBLIC_*` di-inline saat build image, bukan dibaca saat runtime.** Di
sk-vps itu berarti:

```bash
STORE=true MIDTRANS_CLIENT_KEY=Mid-client-xxx deploy/sk-vps/build-and-ship.sh
```

`MIDTRANS_SERVER_KEY` adalah rahasia dan tetap variabel runtime di file env VPS —
jangan pernah dibakar ke image. Aplikasi menolak server key yang tidak cocok
dengan `MIDTRANS_ENVIRONMENT` (sandbox berawalan `SB-`), karena Midtrans hanya
menjawab 401 tanpa petunjuk kalau keduanya berselisih.

Terakhir: arahkan **Payment Notification URL** di dashboard Midtrans
(Settings → Configuration) ke `https://<host>/api/webhooks/midtrans`.

Jalur poin tidak butuh satu pun kunci Midtrans, jadi toko sudah bisa melayani
peserta Arena sebelum akun merchant jadi.

## Menjalankan dan menguji

```bash
npm run db:migrate         # APP_ENV=development
npm run db:seed:store      # tiga produk placeholder, semuanya DRAFT/COMING_SOON
npm run test:store         # signature, pemetaan status, idempotensi, ledger
```

Seed hanya menyegarkan judul, ringkasan, deskripsi, dan urutan. Harga, status,
pengiriman, dan feature key tidak pernah ditimpa, sehingga menjalankannya lagi
tidak menurunkan produk yang sudah live.

## Pemeliharaan

- **Pesanan menggantung.** Job `store-expiry` (tiap jam) menutup order `PENDING`
  yang lewat batas bayar. Midtrans memang mengirim notifikasi `expire`, tapi
  order `PENDING` memblokir percobaan berikutnya lewat
  `store_orders_pending_unique` — jadi notifikasi yang tidak sampai akan mengunci
  pembeli dari produknya selamanya tanpa sapuan ini.
- **Pembayaran masuk tapi notifikasinya hilang.** Pastikan dulu di dashboard
  Midtrans, lalu "Tandai lunas" di `/app/admin/store`. Alasan yang diketik masuk
  ke audit log — "admin menandai lunas" bukan jawaban yang bisa diperiksa orang
  lain nanti.
- **Refund.** Poin dikembalikan dari konsol dan kepemilikannya dicabut.
  Refund **Rupiah dilakukan di dashboard Midtrans**; webhook `refund` yang
  menyusul akan mencabut kepemilikannya di sini. Konsol tidak pernah mengaku
  memindahkan uang yang tidak bisa dipindahkannya.

## Yang belum ada

- Refund Rupiah harus dimulai dari dashboard Midtrans, bukan dari konsol.
- Tidak ada keranjang belanja: satu pesanan satu produk.
- Tidak ada kode diskon atau kupon.
- Aplikasi penilaian 360° itu sendiri belum dibangun — `/app/360` adalah halaman
  placeholder di balik kunci yang sudah berfungsi.
