// End-to-end probe: put one real submission into production so the grading
// workflow's later nodes finally execute. Forty consecutive runs stopped at
// "Got a job?" because the queue has always been empty, so nodes 4-8 — the
// model call, the evidence validator, and the lease completion — have never
// run in production.
//
// The participant is clearly marked as a probe so it can be told apart from a
// real person and removed afterwards. The written answer is a genuine attempt
// at the brief: the evidence validator rejects quotes that do not appear
// verbatim in the sources, so a stub answer would fail for the wrong reason
// and teach us nothing.
import postgres from "postgres";

const WEEK_ID = "c26c0f88-18e9-4afa-8e4c-d8504ce5c0ae";      // ADHOC-2026-09-08-7543, OPEN
const PROJECT_ID = "d660fc06-44f7-445d-9e4b-dc9a9662706c";   // Sales Insight Brief
const REQUIREMENT_ID = "45382c36-b96d-47cd-993b-453fe03c5c14"; // Public analysis link
const SUBJECT = "sk-participant:qa-e2e-probe";

const EXPLANATION = `Saya menganalisis enam bulan data transaksi Toko Berkah Jaya dan menemukan tiga keputusan yang bisa dijalankan Bu Ratna minggu depan.

Pertama, soal pola akhir pekan. Penjualan Sabtu dan Minggu menyumbang 41% dari total transaksi, padahal hanya dua dari tujuh hari. Kategori peralatan masak sendiri naik 62% pada dua hari itu dibanding rata-rata hari kerja. Stok panci dan wajan justru paling sering kosong pada Minggu sore. Keputusan: tambah pemesanan peralatan masak 25% dan jadwalkan kedatangannya Jumat, bukan Senin seperti sekarang.

Kedua, soal barang yang terlihat laris tapi tidak menguntungkan. Ember plastik ukuran sedang terjual 340 unit, tertinggi kedua dalam jumlah, tetapi margin per unitnya Rp1.200 sehingga total kontribusinya hanya Rp408.000 selama enam bulan. Sementara set pisau dapur terjual 47 unit dengan margin Rp38.000, menyumbang Rp1.786.000 dari rak yang jauh lebih kecil. Keputusan: kurangi ruang rak ember menjadi separuh dan pindahkan set pisau ke posisi setinggi mata.

Ketiga, soal kanal. Marketplace menyumbang 28% transaksi tetapi 44% nilai penjualan, karena pembeli online rata-rata membeli 2,3 item per transaksi sementara pembeli kios 1,4 item. Keputusan: unggah sepuluh produk margin tertinggi yang belum ada di marketplace, mulai dari set pisau dapur.

Batasan yang perlu disebut: data ini hanya enam bulan dan tidak mencakup musim Lebaran, jadi pola akhir pekan di atas belum tentu bertahan sepanjang tahun. Data juga tidak memuat identitas pembeli, sehingga saya tidak bisa memisahkan pelanggan baru dari pelanggan lama.`;

const NOTES = `Perhitungan margin memakai selisih harga jual dan harga pokok yang tercatat di ekspor kasir. Untuk 12 transaksi harga pokoknya kosong, dan baris itu saya keluarkan dari perhitungan margin tetapi tetap dihitung pada jumlah unit terjual.`;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const apply = process.argv.includes("--apply");

try {
  const enumVals = async (name) =>
    (await sql`select unnest(enum_range(null::arena.${sql.unsafe(name)}))::text v`).map((r) => r.v);
  const reviewStatuses = await enumVals("submission_review_status");
  const accessStatuses = await enumVals("access_status");
  console.log("submission_review_status:", reviewStatuses.join(", "));
  console.log("access_status           :", accessStatuses.join(", "));

  const queued = reviewStatuses.find((v) => v === "QUEUED") ?? reviewStatuses[0];
  // ACCESSIBLE, not PENDING: the probe's link is deliberately unreachable
  // (example.invalid), and leaving the version waiting on an access check would
  // stall it for a reason that has nothing to do with grading. The graded
  // sources are the written explanation and notes either way.
  const access = accessStatuses.find((v) => v === "ACCESSIBLE") ?? accessStatuses[0];
  console.log(`\nakan memakai review_status=${queued}, access_status=${access}`);

  if (!apply) {
    console.log("\n(dry run — jalankan dengan --apply untuk menulis)");
  } else {
    const ids = await sql.begin(async (tx) => {
      const [user] = await tx`
        insert into identity.users (auth_subject, email_cache, display_name_cache)
        values (${SUBJECT}, 'qa-e2e-probe@arena.invalid', 'QA E2E PROBE')
        on conflict (auth_subject) do update set updated_at = now()
        returning id`;

      const [enrollment] = await tx`
        insert into arena.enrollments (user_id, week_id, project_id, status, selected_at, started_at)
        values (${user.id}, ${WEEK_ID}, ${PROJECT_ID}, 'ACTIVE', now(), now())
        returning id`;

      const [submission] = await tx`
        insert into arena.submissions (enrollment_id, user_id, week_id, project_id, status, review_attempts_used)
        values (${enrollment.id}, ${user.id}, ${WEEK_ID}, ${PROJECT_ID}, 'SUBMITTED', 1)
        returning id`;

      const [version] = await tx`
        insert into arena.submission_versions
          (submission_id, version_number, explanation, notes, submitted_at,
           access_status, review_attempt_number, review_status, is_final)
        values (${submission.id}, 1, ${EXPLANATION}, ${NOTES}, now(),
           ${access}, 1, ${queued}, false)
        returning id`;

      await tx`
        insert into arena.submission_version_items
          (submission_version_id, requirement_id, item_type, label, external_url)
        values (${version.id}, ${REQUIREMENT_ID}, 'LINK', 'Public analysis link',
          'https://example.invalid/qa-e2e-probe/analisis-berkah-jaya')`;

      await tx`update arena.submissions set latest_version_id = ${version.id} where id = ${submission.id}`;

      const [job] = await tx`
        insert into arena.review_jobs (submission_version_id, status, priority, available_at)
        values (${version.id}, 'PENDING', 10, now())
        returning id`;

      return { user: user.id, enrollment: enrollment.id, submission: submission.id, version: version.id, job: job.id };
    });

    console.log("\nDIBUAT:");
    for (const [k, v] of Object.entries(ids)) console.log(`  ${k.padEnd(11)} ${v}`);
    console.log("\nAntrean sekarang berisi satu job. Worker n8n mengklaim tiap 2 menit.");
  }

  const [depth] = await sql`select count(*)::int n from arena.review_jobs where status in ('PENDING','RETRY')`;
  console.log(`\nreview_jobs siap diklaim: ${depth.n}`);
} catch (error) {
  console.log("FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
