import assert from "node:assert/strict";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function requireDevelopmentDatabase() {
  assert.equal(process.env.APP_ENV, "development", "Store catalog seed requires APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for the store catalog seed");
}

/**
 * Digital shop seed — development only, idempotent by slug.
 *
 * These are PLACEHOLDERS. Every row lands as DRAFT (invisible) or COMING_SOON
 * (visible, unbuyable) with no delivery target, because the products do not
 * exist yet: the owner writes the copy, sets the price, uploads the file and
 * flips the status from the console at /app/admin/store.
 *
 * Nothing here can be sold by accident. The `store_products_*_check`
 * constraints refuse ACTIVE without a price and a way to deliver, so a seed row
 * can only become sellable once somebody has actually filled it in.
 *
 * Re-runs refresh only the scaffolding — title, summary, description, sort
 * order. Price, status, delivery and feature key are left exactly as the owner
 * last set them, so seeding again never un-publishes a live product or resets
 * a price somebody tuned.
 */
const products = [
  {
    slug: "sistem-penilaian-360",
    title: "Sistem Penilaian 360°",
    summary: "Aplikasi umpan balik melingkar untuk tim: atasan, rekan, dan diri sendiri menilai lewat rubrik yang sama.",
    description: [
      "PLACEHOLDER — isi deskripsi jualannya di /app/admin/store.",
      "",
      "Produk ini berjenis ACCESS: pembelian membuka halaman /app/360 untuk akun pembeli,",
      "bukan mengirim berkas. Halaman itu sudah ada dan sudah terkunci; isinya masih",
      "placeholder sampai aplikasinya dibangun.",
      "",
      "Sebelum bisa dijual: isi harga, dan status diubah ke ACTIVE.",
    ].join("\n"),
    productKind: "ACCESS",
    status: "COMING_SOON",
    featureKey: "app-360",
    accessDurationDays: null,
    sortOrder: 10,
  },
  {
    slug: "template-cv-ats",
    title: "Paket Template CV Lolos ATS",
    summary: "Template CV siap isi yang terbaca rapi oleh sistem pelacak pelamar.",
    description: [
      "PLACEHOLDER — isi deskripsi jualannya di /app/admin/store.",
      "",
      "Produk berjenis DOWNLOAD. Unggah berkasnya (atau tempel link Notion/Drive)",
      "lewat konsol admin, isi harga, lalu ubah status ke ACTIVE.",
    ].join("\n"),
    productKind: "DOWNLOAD",
    status: "DRAFT",
    featureKey: null,
    accessDurationDays: null,
    sortOrder: 20,
  },
  {
    slug: "template-lamaran-kerja",
    title: "Paket Template Melamar Kerja",
    summary: "Surat lamaran, email follow-up, dan pesan pembuka rekruter — tinggal sesuaikan.",
    description: [
      "PLACEHOLDER — isi deskripsi jualannya di /app/admin/store.",
      "",
      "Produk berjenis DOWNLOAD. Unggah berkasnya (atau tempel link Notion/Drive)",
      "lewat konsol admin, isi harga, lalu ubah status ke ACTIVE.",
    ].join("\n"),
    productKind: "DOWNLOAD",
    status: "DRAFT",
    featureKey: null,
    accessDurationDays: null,
    sortOrder: 30,
  },
];

async function seed() {
  requireDevelopmentDatabase();
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    for (const product of products) {
      await sql`
        insert into store.products
          (slug, title, summary, description, product_kind, status, feature_key, access_duration_days, sort_order)
        values
          (${product.slug}, ${product.title}, ${product.summary}, ${product.description}, ${product.productKind},
           ${product.status}, ${product.featureKey}, ${product.accessDurationDays}, ${product.sortOrder})
        on conflict (slug) do update set
          title = excluded.title,
          summary = excluded.summary,
          description = excluded.description,
          sort_order = excluded.sort_order,
          updated_at = now()
      `;
    }
    console.log(`Store catalog ready: ${products.length} placeholder products. Fill them in at /app/admin/store.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await seed();
