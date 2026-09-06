# Kontrak grading Hermes/n8n → Arena

> Koreksi audit 2026-09-06: workflow live sudah menunjuk endpoint Arena, tetapi payload masih kontrak lama. Contoh evidence bebas di bawah adalah historis dan **tidak valid** untuk validator production sekarang. Evidence harus berbentuk `[source-id] kutipan persis` (minimal 12 karakter) dari snapshot `input.sources`. Workflow baru sebaiknya claim job lebih dulu, menilai input blind yang dikembalikan, lalu complete lease yang sama. Second judge tetap membutuhkan konfigurasi AI di Arena bila routing memerlukannya. Lihat [audit VPS terbaru](VPS_INTEGRATION_AUDIT_2026-09-06.md) sebelum mengubah workflow.

Dokumen ini menjelaskan persis apa yang harus dikirim workflow n8n agar hasil
penilaiannya diterima Arena. Ditulis untuk orang yang mengedit workflow-nya,
bukan untuk yang membaca kode Arena.

**Keputusan (5 September 2026):** otak penilaian tetap di Hermes/n8n pada VPS
`202.74.75.95`. Yang berubah hanya bentuk keluarannya.

## Yang berubah, dan kenapa

Workflow yang sekarang mengirim **vonis** — satu angka jadi:

```json
{ "submission_id": "…", "score": 87, "ai_feedback": "…",
  "rubric_breakdown": { "solusi": 35, "eksekusi": 34 } }
```

Arena yang baru meminta **bukti**, lalu berhitung sendiri. Model mengusulkan
nilai per kriteria beserta kutipan yang mendasarinya; backend yang memvalidasi,
memutuskan perlu hakim kedua atau tidak, dan menghitung skor tertimbang.

Itu bukan formalitas. Kalau model boleh menetapkan skor akhir, tidak ada lagi
yang bisa menolak nilai yang tidak berdasar, dan tidak ada yang bisa mendeteksi
saat model menilai kriteria yang tidak ada di rubrik.

## Endpoint

```
POST https://arena.sekolahkarir.id/api/webhooks/arena-eval
Authorization: Bearer <ARENA_EVAL_TOKEN>
Content-Type: application/json
```

Token ini **berbeda** dari `ARENA_N8N_WEBHOOK_TOKEN` yang dipakai Arena saat
memanggil n8n. Arah masuk dan arah keluar sengaja tidak berbagi kredensial.

Kalau `ARENA_EVAL_TOKEN` belum diisi di sisi Arena, **semua** panggilan ditolak.
Itu fail-closed yang disengaja: konfigurasi setengah jadi tidak boleh membuka
jalur penulisan nilai.

## Bentuk payload

```json
{
  "version_id": "8b60a31f-777c-4cc6-9f86-a92e3bcadf74",
  "worker_label": "n8n-grading",
  "model": "nama-model-yang-dipakai",
  "output": {
    "criteria": [
      {
        "criterionId": "3f2b1c44-1d2e-4a5b-9c8d-7e6f5a4b3c2d",
        "score": 82,
        "evidence": [
          "Funnel di slide 4 memetakan awareness sampai retensi dengan angka konversi tiap tahap.",
          "Asumsi biaya akuisisi disebut eksplisit di catatan halaman 2."
        ],
        "issues": ["Tidak ada pembanding untuk klaim CAC turun 30%."],
        "confidence": 0.78
      }
    ],
    "strengths": ["Struktur funnel jelas dan berbasis data."],
    "priorityImprovements": ["Sertakan sumber untuk klaim penurunan CAC."],
    "confidence": 0.78
  }
}
```

### Aturan per field

| Field | Aturan |
|---|---|
| `version_id` | UUID versi submission yang dinilai. **Bukan** `submission_id`. Satu submission bisa punya beberapa versi. |
| `worker_label` | Bebas, maks 80 karakter. Masuk ke audit sebagai `external-eval:<label>`. |
| `model` | Opsional, maks 120 karakter. Isi dengan nama model sungguhan supaya jejak audit berguna. |
| `output.criteria[]` | 1–20 item. **Setiap kriteria rubrik harus muncul tepat satu kali.** Kurang, lebih, atau ganda → ditolak. |
| `criterionId` | UUID kriteria dari rubrik project. Id yang tidak dikenal ditolak — itu tanda model menilai sesuatu yang tidak ada. |
| `score` | 0–100, dan tidak boleh melebihi `maxScore` kriteria itu. |
| `evidence[]` | **Minimal satu, maksimal sepuluh.** Kosong ditolak. Ini pagar utamanya: nilai tanpa bukti tidak diterima. |
| `issues[]` | Maksimal sepuluh. Boleh kosong. |
| `confidence` | 0–1, per kriteria dan sekali lagi di tingkat keseluruhan. Nilai rendah memicu hakim kedua. |
| `strengths[]`, `priorityImprovements[]` | Maksimal sepuluh masing-masing. Boleh kosong. |

Semua string dipangkas dan tidak boleh kosong.

## Yang dilakukan Arena setelah menerima

1. Mencari job `PENDING` untuk versi itu. Tidak ada → `{ ok: true, deduped: true }`.
   Kiriman ulang tidak pernah menilai dua kali, tanpa perlu idempotency key.
2. Menyewa job itu atas nama worker eksternal, lewat antrean yang sama dengan
   worker mana pun.
3. Memvalidasi keluaran terhadap rubrik.
4. Menjalankan hakim kedua bila keyakinannya rendah.
5. **Menghitung skor tertimbang sendiri**, lalu menyimpannya.
6. Menulis audit `EVAL_INGESTED`.

Kegagalan model atau worker tidak pernah memakan jatah 3× review peserta.

## Menguji payload sebelum menyentuh production

```bash
node scripts/verify-eval-payload.mjs contoh.json
```

Skrip itu memvalidasi berkas JSON terhadap skema yang sama persis dengan yang
dipakai endpoint, dan menjelaskan setiap kesalahan dalam bahasa manusia. Pakai
ini saat menyusun node "Post Result" di n8n, supaya iterasinya tidak lewat
production.

## Yang masih perlu dikerjakan di sisi n8n

Empat hal, dan semuanya di luar repo ini:

1. **Repoint** node hasil ke `https://arena.sekolahkarir.id/api/webhooks/arena-eval`.
   Workflow lama masih menunjuk URL situs utama.
2. **Ubah bentuk keluaran** Agent 2 menjadi `output` di atas: per kriteria, dengan
   bukti, bukan satu angka.
3. **Kirim `criterionId` yang sungguhan.** Rubrik Arena memakai UUID; workflow
   lama memakai nama bebas seperti `solusi`. Workflow perlu membaca rubrik
   project lebih dulu.
4. **Ganti cadensi** dari borongan tiap Sabtu menjadi per-submission, karena
   Arena mengantre tiap versi begitu dikirim.

Catatan penting: import workflow ke n8n masuk dalam keadaan **tidak aktif**, dan
container perlu di-restart setelahnya.

## Kunci AI: dua jalur, dua rumah

Kunci model live ada di VPS ini. Yang perlu disalin dari VPS ke env Arena
(Vercel production / `.env` lokal) — jangan commit:

```
AI_REVIEW_PROVIDER=openai-compatible
AI_API_BASE_URL=<base URL chat-completions yang dipakai n8n>
AI_API_KEY=<kunci yang dipakai n8n>
AI_REVIEW_MODEL=…  AI_VALIDATOR_MODEL=…  AI_JUDGE_MODEL=…  AI_GENERATION_MODEL=…
```

- **Jalur A (Hermes grading, keputusan saat ini):** kunci tetap di VPS dalam
  n8n; Arena cuma butuh `ARENA_EVAL_TOKEN` untuk menerima webhook di atas.
- **Jalur B (worker internal Arena `POST /api/internal/reviews/run` + generator
  Senin):** butuh salinan `AI_API_*` di atas. Tanpa itu worker gagal tertutup
  dan generator jalan library-only (tetap jujur di log cron).

## Yang belum bisa diaudit

Isi workflow-nya sendiri — prompt Agent 2, model yang dipakai, rubrik yang
ditanamkan, dan guardrail-nya — belum pernah dibaca. Yang terdokumentasi di sini
hanyalah kontrak yang tampak dari sisi kode kedua repo.

Untuk mengauditnya diperlukan salah satu dari: export JSON workflow, akses UI
n8n, atau akses SSH ke VPS.
