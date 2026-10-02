# PRD — Admin Terpadu Sekolah Karir
Tanggal: 2 Oktober 2026. Pengguna menyetujui implementasi dan push branch fitur di tiga repo.

## Tujuan
Satu operator, satu pintu admin di website utama: Website, Side Hustle Arena dan Career Tools. UI menarik, teks singkat, responsif. Bukan tiga admin yang ditautkan atau di-iframe.

## Kepemilikan
- sekolah-karir-website: shell, sesi admin dan gateway server-only; CRUD website existing tetap dipertahankan.
- side-hustle-arena: database/services/API internal Arena tetap menjadi sumber kebenaran.
- sekolah-karir-tools: API internal baru, CRUD produk/divisi, moderasi lowongan dan penyesuaian kredit.
- Tiap repo punya docs/UNIFIED-ADMIN-HANDOFF.md untuk kontrak, verifikasi dan langkah deployment.

## Menu
Website berada dalam grup kontekstual; Arena dan Tools punya area kerja native, toolbar dan editor samping. Admin UI lama Arena /app/admin dan /admin diarahkan ke panel utama melalui redirect sementara. Kode lama tidak dihapus secara destruktif; API/data tidak dihapus.
Website program, peserta, konten dan transaksi existing tetap memakai rute/services existing dalam satu shell.

## Lingkup
Produk: draft, edit, publish dan arsip; harga input rupiah, API minor units; versi edit dijaga.
Arena: produk, pesanan, proyek, divisi, kalender, review, reward, stok, pengguna, aktivitas. Hanya tindakan yang sudah diimplementasikan ditampilkan.
Tools: produk/library tiers, pesanan, pengguna, langganan, kredit, lowongan, divisi agen, runs dan aktivitas.
Stok memakai periode nyata, bukan angka nol palsu. Filter dan pagination mengikuti kontrak sumber.
Sebagian modul read-only. Tidak ada pembayaran sukses buatan, refund rupiah, trigger AI Tools manual, RBAC/tim, atau cross-site publishing.
Rubrik Arena tampil siap/belum diatur; authoring rubrik belum dipindahkan. Email/flags/CV report/otomasi lanjutan Arena belum punya parity di panel baru; API tetap ada.

## Keamanan
Cookie website sk_session wajib audience sk-admin dan algoritma HS256. Peserta dan bypass dev tidak memberi operasi remote.
Gateway hanya fixed path/action/origin, same-origin mutations, no-store, timeout, redirect ditolak, body streaming dibatasi.
Bearer target hanya di server; tidak diteruskan dari browser. Operator dicatat dari konfigurasi server.
Produk dan audit atomik; konflik edit tidak menimpa versi terbaru. Kredit atomik/nonnegatif/idempoten.
Website dan Arena/Tools menjaga database terpisah. Tidak menjalankan migrasi/seed/AI/payment produksi untuk tes.

## Rilis
Push branch codex/unified-admin-20261002 bukan merge/deploy.
Deploy API target dan migrasi audit Tools setelah review/backup/staging; konfigurasikan token dan origin pada server; deploy website pusat; aktifkan redirect Arena setelah pusat siap.
Jangan menganggap UI fixture lokal sebagai koneksi produksi.
Perubahan pengguna lain tetap unstaged dan tidak ikut commit.
