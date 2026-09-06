# Workflow grading n8n — kontrak claim/lease

Dokumen ini adalah paket migrasi untuk mengganti workflow grading live, yang
sampai sekarang masih mengirim payload kontrak lama meskipun endpoint-nya sudah
menunjuk Arena baru (handoff blocker 4, dan temuan P2 di
[audit VPS](VPS_INTEGRATION_AUDIT_2026-09-06.md)).

**Jangan ubah workflow live sampai app production dan token siap.** Isi dokumen
ini bisa disiapkan dan diuji lebih dulu tanpa menyentuh apa pun di VPS.

## Yang berubah secara mendasar

Workflow lama mengirim **vonis** untuk satu `submission_id`: satu skor akhir,
sekali tembak, tanpa ada yang memegang pekerjaan itu.

Workflow baru **meminjam pekerjaan** lebih dulu. Arena memberikan satu job
beserta lease, workflow menilai *hanya* input yang dikembalikan job itu, lalu
menutup lease yang sama. Tiga akibat yang tidak boleh disalahpahami:

1. **Workflow tidak lagi memilih submission.** Tidak ada lagi query ke database
   atau daftar submission. `/claim` yang menentukan, dan ia memberi satu saja.
2. **Workflow tidak menentukan skor akhir.** Ia mengusulkan skor per kriteria
   beserta bukti; backend yang memvalidasi, memutuskan perlu hakim kedua, dan
   menghitung skor tertimbang.
3. **Bukti harus bisa ditelusuri.** Kutipan yang tidak ada di sumber ditolak.

## Kontrak HTTP

Semua endpoint memakai `Authorization: Bearer <INTERNAL_AUTOMATION_TOKEN>`.
Token ini **berbeda** dari `ARENA_EVAL_TOKEN` (ingest legacy) dan dari
`VPS_WEBHOOK_TOKEN` (Arena memanggil n8n). Jangan pakai satu token untuk dua
arah. Guard-nya fail-closed: token kosong di sisi Arena menolak semua panggilan.

### 1. Ambil pekerjaan

```
POST /api/internal/reviews/claim
{ "workerId": "n8n-grading" }
```

Antrean kosong menjawab `200` dengan `{ "data": { "job": null, "reason": "QUEUE_EMPTY" } }`.
Ini bukan error — workflow harus berhenti diam-diam, bukan retry.

Kalau ada pekerjaan:

```json
{ "data": { "job": {
  "jobId": "…uuid…",
  "versionId": "…uuid…",
  "attemptNumber": 1,
  "leaseExpiresAt": "2026-09-07T10:20:00.000Z",
  "input": {
    "projectTitle": "…", "divisionName": "…",
    "explanation": "…", "notes": "…",
    "rubric": [{ "id": "…uuid…", "name": "Execution", "weight": 3, "maxScore": 100,
                 "description": null, "reviewInstruction": null }],
    "items": [{ "itemType": "LINK", "externalUrl": "…", "downloadUrl": null }],
    "sources": [{ "id": "explanation", "kind": "TEXT", "text": "…", "sha256": "…" }]
  }
} } }
```

`input` sengaja **blind**: tidak ada skor sebelumnya, tidak ada feedback lama,
tidak ada identitas peserta. Jangan menambahkan konteks dari mana pun — itulah
yang membuat percobaan ke-2 dan ke-3 dinilai jujur.

Lease berlaku **600 detik**. Selesaikan sebelum `leaseExpiresAt`, atau job akan
diambil ulang worker lain dan hasil telat Anda ditolak.

### 2. Nilai hanya `input.sources`

Model hanya boleh mengutip dari `sources[].text`. Setiap string bukti wajib
berbentuk:

```
[<source-id>] <kutipan persis, minimal 12 karakter>
```

`<source-id>` harus salah satu `sources[].id` (`explanation`, `notes`, atau
`item:<uuid>`), dan kutipannya harus muncul **verbatim** di `text` sumber itu.
Validator menolak selain itu — inilah yang menghentikan model mengarang bukti.

### 3. Tutup lease

```
POST /api/internal/reviews/complete
{ "jobId": "…", "workerId": "n8n-grading", "output": { … } }
```

Bentuk `output`:

```json
{
  "criteria": [{ "criterionId": "<id dari rubric>", "score": 82,
                 "evidence": ["[explanation] satu tabel master"],
                 "issues": [], "confidence": 0.78 }],
  "strengths": ["…"], "priorityImprovements": ["…"], "confidence": 0.78
}
```

Aturan yang paling sering dilanggar workflow buatan tangan:

- **Setiap kriteria rubrik wajib dinilai tepat satu kali.** Kurang satu ditolak,
  dobel ditolak, id asing ditolak.
- `score` tidak boleh melebihi `maxScore` kriteria itu.
- Minimal satu bukti per kriteria.
- `confidence` di bawah `0.70` **tidak gagal**, tetapi memicu hakim kedua di sisi
  Arena. Jangan mengarang angka tinggi untuk menghindarinya.

### 4. Kalau gagal, laporkan — jangan diamkan

```
POST /api/internal/reviews/fail
{ "jobId": "…", "workerId": "n8n-grading", "code": "MODEL_TIMEOUT",
  "message": "upstream model did not answer within the lease" }
```

Job kembali ke `RETRY` dengan backoff, dan **jatah 3 review peserta tidak
terpakai**. Membiarkan lease kedaluwarsa tanpa lapor juga pulih sendiri, tetapi
tanpa jejak sebab — selalu lapor.

`workerId` yang tidak memegang lease ditolak, baik di `complete` maupun `fail`.

## Bentuk workflow

`n8n/arena-grading-workflow.json` di repo ini adalah titik awal yang bisa
di-import. Alurnya:

1. **Schedule Trigger** — tiap 2 menit sudah cukup; antrean kosong itu murah.
2. **HTTP Request → `/claim`** — kirim `workerId`.
3. **IF `job` null** — berhenti diam-diam.
4. **Code: susun prompt** — rubrik + `sources`, dan instruksi format bukti
   `[source-id] kutipan`.
5. **HTTP Request → model.**
6. **Code: bentuk `output`** — petakan `criterionId` dari `rubric[].id`, jangan
   dari nama kriteria.
7. **IF hasil model valid → `/complete`; kalau tidak → `/fail`** dengan sebabnya.

Langkah 6 adalah tempat kegagalan paling umum: model diminta mengembalikan nama
kriteria, lalu workflow menebak id-nya. Kirimkan id rubrik ke dalam prompt dan
minta model mengembalikannya apa adanya.

## Cara menguji tanpa menyentuh yang live

```
npm run test:n8n:contract
```

Suite ini menjalankan route handler Arena yang sebenarnya — guard bearer, skema
zod, dan service yang sama seperti production — dan membuktikan urutan penuh:
tolak tanpa token, claim blind, tolak bukti yang dikarang, tolak bukti tanpa
anchor `[source-id]`, job kembali `RETRY` bukan hangus, complete yang sah,
penolakan replay lease yang sudah selesai, dan jalur `fail` yang tidak memakan
jatah peserta.

Kalau payload workflow Anda lolos aturan yang sama, endpoint akan menerimanya.
Untuk memeriksa satu berkas payload calon terhadap rubrik sungguhan:

```
node scripts/verify-eval-payload.mjs contoh.json --version <uuid>
```

Jangan iterasi dengan menembak endpoint live dan membaca 400.

> Catatan kejujuran: JSON workflow di repo belum pernah dijalankan di dalam n8n —
> tidak ada instance n8n non-produksi yang tersedia di lingkungan ini. Yang
> **sudah terbukti** adalah kontrak HTTP yang ditargetkannya, lewat suite di
> atas. Perlakukan JSON itu sebagai draft yang harus di-import ke staging n8n
> dan dijalankan sekali sebelum menyentuh workflow produksi.

## Yang masih butuh keputusan owner

- Salinan staging workflow live (atau export yang sudah diredaksi) untuk migrasi.
- `INTERNAL_AUTOMATION_TOKEN` production, terpisah dari dua token lain.
- Konfirmasi model dan endpoint inference yang dipakai Hermes.
