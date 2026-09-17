# Toko Produk Digital — Desain

Tanggal: 17 September 2026. Status: disetujui pemilik, siap diimplementasi.

## Masalah

Sekolah Karir punya barang digital yang layak dijual — skema sistem penilaian
360 derajat, template CV, template lamaran kerja — tapi tidak punya cara
menjualnya. Yang ada hanya katalog reward Arena (`rewards.catalog`), dan itu
ditebus dengan poin oleh peserta, bukan dibeli dengan uang oleh publik.

## Keputusan yang sudah diambil

| Pertanyaan | Jawaban |
|---|---|
| Alat bayar | Rupiah **dan** poin Arena, per produk |
| Pembeli | Wajib login; tidak ada guest checkout |
| Gateway | Midtrans Snap |
| Jenis produk | `DOWNLOAD` (file/link) dan `ACCESS` (buka fitur di dalam platform) |
| Produk aplikasi | Dijual model "akses terkunci di dalam platform", bukan SaaS multi-tenant, bukan source code |
| Isi produk | Placeholder; pemilik mengisi lewat konsol admin |

Produk berjenis `ACCESS` diluncurkan dengan status `COMING_SOON`: tampil di
etalase, tombol beli mati. Sistem penilaian 360 belum ada, dan toko tidak boleh
menjual sesuatu yang belum bisa diserahkan.

## Arsitektur

Schema Postgres baru `store`, sejajar dengan `arena` dan `rewards`.

Reward dan produk jual sengaja **tidak** disatukan. Reward adalah hadiah yang
ditebus peserta Arena, stoknya dibatasi per minggu, harganya wajib poin. Produk
toko adalah barang dagangan: stok tak terbatas, harga utamanya Rupiah, pembelinya
tidak harus peserta. Menyatukan keduanya memaksa separuh kolom jadi NULL dan
membuat satu tabel menanggung dua peran.

Yang **tidak** diduplikasi adalah saldo poin. Jalur pembayaran poin di toko
menulis ke `rewards.point_ledger` dan `rewards.point_accounts` yang sama, dengan
jenis entri baru `STORE_PURCHASE` dan `STORE_REFUND`. Saldo peserta tetap satu
angka, dan check constraint `balance >= 0` yang sudah ada otomatis melindungi
toko juga. Dua dompet terpisah adalah bug akuntansi yang menunggu waktu.

### Tabel

**`store.products`** — etalase. Kolom harga `price_idr_minor` dan `points_cost`
dua-duanya nullable: satu terisi berarti satu alat bayar, dua-duanya terisi
berarti pembeli memilih. Produk `DOWNLOAD` menyimpan `delivery_kind` (`LINK`
atau `FILE`) beserta `delivery_url` atau `delivery_object_key`. Produk `ACCESS`
menyimpan `feature_key` dan `access_duration_days` (NULL = selamanya).

Check constraint menegakkan apa yang wajib terisi pada status `ACTIVE`, bukan
pada `DRAFT`/`COMING_SOON` — justru supaya pemilik bisa menabung produk setengah
jadi tanpa dipaksa database, tapi tidak bisa menyalakannya sebelum lengkap.

**`store.orders`** — satu pesanan, satu produk. Menyimpan `payment_method`
(`IDR`/`POINTS`), status (`PENDING`→`PAID`→`FULFILLED`, plus `FAILED`,
`EXPIRED`, `REFUNDED`), **salinan judul dan harga saat beli** supaya perubahan
harga tidak mengubah riwayat, dan `idempotency_key` — pola yang sama dengan
`rewards.redemptions`.

**`store.entitlements`** — apa yang dimiliki seorang pengguna. Dipakai untuk
kedua jenis produk: bagi `DOWNLOAD` ia hak mengunduh ulang, bagi `ACCESS` ia
kunci pembuka fitur. Satu tabel, sehingga halaman "Produk Saya" satu daftar.
Unique index parsial `(user_id, product_id) WHERE revoked_at IS NULL` mencegah
kepemilikan ganda tanpa menghalangi pembelian ulang setelah pencabutan.

**`store.payment_events`** — setiap notifikasi Midtrans dicatat dengan
`event_key` unik. Midtrans memang mengirim ulang notifikasi; tanpa tabel ini
webhook ganda akan memberikan produk dua kali.

### Alur

**Bayar poin** — satu transaksi: kunci akun poin, validasi saldo, buat order
`FULFILLED`, debit ledger, terbitkan entitlement, kirim notifikasi. Tidak ada
`PENDING`; poin adalah uang yang sudah ada di tangan kita.

**Bayar Rupiah** — order `PENDING` dibuat lebih dulu dengan `provider_order_id`
milik kita sendiri, lalu Snap token diminta ke Midtrans. Pembeli membayar di
popup Snap. Midtrans memanggil `/api/webhooks/midtrans`; signature diverifikasi
dengan SHA-512 atas `order_id + status_code + gross_amount + server_key`, event
dicatat (unik), dan hanya jika baru: order jadi `PAID` lalu `FULFILLED` dan
entitlement terbit. Jumlah yang dibayar dicocokkan dengan jumlah yang ditagih —
notifikasi dengan nominal berbeda ditolak, tidak diproses.

**Penyerahan** — `LINK` mengembalikan URL apa adanya. `FILE` menerbitkan
presigned URL 10 menit dari storage yang sudah ada. `ACCESS` tidak menyerahkan
apa-apa: halaman yang dilindungi memanggil `hasEntitlement(userId, featureKey)`.

## Permukaan

- `/store`, `/store/[slug]` — publik, bisa dilihat tanpa login; tombol beli
  mengarahkan ke login bila anonim.
- `/app/store` — "Produk Saya": daftar entitlement, tombol unduh ulang, riwayat pesanan.
- `/app/360` — halaman placeholder terkunci, contoh nyata pemakaian `ACCESS`.
- `/app/admin/store` — CRUD produk, unggah berkas, daftar pesanan.
- `/api/store/*`, `/api/webhooks/midtrans`, `/api/internal/store/*`.

Seluruh permukaan berada di balik `NEXT_PUBLIC_STORE_ENABLED`, mengikuti pola
`isCvScannerEnabled()`: satu variabel mematikan navigasi dan API sekaligus,
sehingga toko tidak bisa setengah diluncurkan.

## Penanganan galat

Memakai `ArenaDomainError` yang sudah ada, dengan kode baru: `PRODUCT_NOT_FOUND`,
`PRODUCT_NOT_PURCHASABLE`, `PAYMENT_METHOD_UNAVAILABLE`, `ALREADY_OWNED`,
`INSUFFICIENT_POINTS`, `PAYMENT_PROVIDER_FAILED`, `ENTITLEMENT_NOT_FOUND`.
Webhook selalu membalas 200 untuk notifikasi yang signature-nya sah tapi sudah
pernah diproses — selain itu Midtrans akan mengulang selamanya.

## Pengujian

Suite offline `scripts/store-checkout.test.mjs`: verifikasi signature Midtrans
(sah, palsu, nominal berbeda), pemetaan status transaksi, penurunan idempotency
key, validasi harga produk, dan klasifikasi entri ledger toko oleh
`summarizePoints` — yang terakhir menjaga agar pembelian toko tidak terhitung
sebagai poin yang diperoleh.
