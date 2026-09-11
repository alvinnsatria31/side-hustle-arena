# Setup Live Voucher dan Jobs

## Voucher website utama

Di `sk-vps`, edit `/opt/sekolah-karir-automation/arena-stack/arena.env` dan isi:

```dotenv
MAIN_SITE_ORIGIN=https://sekolahkarir.id
MAIN_SITE_VOUCHER_TOKEN=<token_rahasia_voucher>
```

Token asli harus berasal dari kontrak API website utama dan tidak boleh masuk Git. Setelah nilainya benar, restart hanya service Arena:

```bash
cd /opt/sekolah-karir-automation/arena-stack
sudo -n docker compose -f docker-compose.arena.yml up -d --no-deps arena
sudo -n docker compose -f docker-compose.arena.yml ps arena
sudo -n docker compose -f docker-compose.arena.yml exec arena sh -lc 'test -n "$MAIN_SITE_ORIGIN" && test -n "$MAIN_SITE_VOUCHER_TOKEN"'
```

Uji dari antrean `/app/admin/rewards` menggunakan satu klaim voucher nonproduksi yang disetujui operator. Status hanya boleh menjadi `FULFILLED` setelah website utama menerima kode.

## Sumber lowongan pertama

Siapkan URL feed HTTPS, bentuk JSON, pemetaan field, dan token dari provider yang benar. Jangan menebak URL atau token. Masukkan token ke `arena.env`, misalnya:

```dotenv
JOBS_PROVIDER_TOKEN=<token_rahasia_provider_lowongan>
```

Daftarkan sumber melalui `/app/admin/jobs`, pilih adapter `http-json`, simpan nama environment variable `JOBS_PROVIDER_TOKEN`, dan biarkan sumber nonaktif sampai sync manual berhasil.

Jika onboarding dilakukan lewat SQL, ganti semua nilai `provider.example` sesuai kontrak provider:

```sql
insert into arena.job_sources
  (slug, name, adapter, config, credential_env_var, is_active, sync_interval_minutes, staleness_days)
values (
  'provider-awal',
  'Provider Lowongan Awal',
  'http-json',
  '{
    "baseUrl": "https://provider.example/api/jobs",
    "itemsPath": "data.items",
    "nextCursorPath": "data.nextCursor",
    "fieldMap": {
      "externalId": "id",
      "title": "title",
      "company": "company.name",
      "applicationUrl": "applicationUrl"
    }
  }'::jsonb,
  'JOBS_PROVIDER_TOKEN',
  false,
  360,
  7
)
on conflict (slug) do nothing;
```

Urutan aktivasi:

1. Pastikan sumber masih `is_active = false`.
2. Jalankan sync manual dari `/app/admin/jobs` dan periksa jumlah item masuk, item invalid, serta pesan error.
3. Periksa data hasil normalisasi di `/app/jobs`, termasuk tautan lamaran HTTPS.
4. Aktifkan sumber dari dashboard setelah hasilnya benar.
5. Pantau sync berikutnya dan nonaktifkan sumber bila mapping provider berubah.
