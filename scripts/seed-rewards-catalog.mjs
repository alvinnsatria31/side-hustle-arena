import assert from "node:assert/strict";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function requireDevelopmentDatabase() {
  assert.equal(process.env.APP_ENV, "development", "Rewards catalog seed requires APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for the rewards catalog seed");
}

/**
 * Reward catalog seed — development only, idempotent by slug.
 *
 * SKU policy (decided by the product owner on 2026-09-11, replacing the
 * 2026-09-04 "one USD 20 SKU" rule): six official rewards, all active, forming
 * the milestone ladder 300 → 600 → 1.000 → 1.500 → 2.200 → 2.700 points. The
 * last one, CASH REWARD Rp500.000, is the main reward.
 *
 * - `usd-20-cash` is retired, not deleted: it may carry redemption history, so
 *   it stays as an inactive row and leaves the ladder.
 * - Money is stored in minor units. The IDR minor unit is the sen (ISO 4217
 *   exponent 2), so Rp500.000 is 50,000,000.
 * - Re-runs only refresh operational columns (title/description/active flag);
 *   an admin-edited price or inventory mode is never clobbered.
 * - LIMITED rewards need an inventory period before they can be claimed; set
 *   the stock from the admin Reward page. Until then they show "Stok habis".
 */
const skus = [
  {
    slug: "notion-kit",
    title: "Template Notion & Resume Starter Kit",
    description: "Template Notion untuk melacak lamaran kerja plus resume starter kit siap pakai. Dikirim digital setelah klaim diproses.",
    pointsCost: 300,
    rewardType: "DIGITAL",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "UNLIMITED",
    isActive: true,
  },
  {
    slug: "ebook",
    title: "E-Book Banting Stir Karir & HR Interview Guide",
    description: "E-book panduan pindah karir dan panduan menjawab interview HR. Dikirim digital setelah klaim diproses.",
    pointsCost: 600,
    rewardType: "DIGITAL",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "UNLIMITED",
    isActive: true,
  },
  {
    slug: "voucher-50",
    title: "Voucher Diskon 50% Masterclass",
    description: "Voucher potongan 50% untuk satu masterclass Sekolah Karir. Kode voucher muncul di profilmu setelah klaim.",
    pointsCost: 1000,
    rewardType: "DISCOUNT",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "UNLIMITED",
    isActive: true,
  },
  {
    slug: "cv-review",
    title: "1-on-1 CV & Portfolio Review (20 Menit)",
    description: "Sesi 1-on-1 selama 20 menit bersama tim Sekolah Karir untuk membedah CV dan portfolio. Jadwal diatur setelah klaim.",
    pointsCost: 1500,
    rewardType: "SERVICE",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "LIMITED",
    isActive: true,
  },
  {
    slug: "free-pass",
    title: "100% Free Pass All Masterclass",
    description: "Akses gratis ke seluruh masterclass Sekolah Karir. Kode akses muncul di profilmu setelah klaim.",
    pointsCost: 2200,
    rewardType: "MASTERCLASS",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "LIMITED",
    isActive: true,
  },
  {
    slug: "cash-500k",
    title: "CASH REWARD Rp500.000",
    description: "Hadiah utama: uang tunai Rp500.000. Klaim diverifikasi manual oleh tim sebelum pencairan.",
    pointsCost: 2700,
    rewardType: "MONETARY",
    monetaryValueMinor: 50_000_000,
    currency: "IDR",
    inventoryMode: "LIMITED",
    isActive: true,
  },
  {
    slug: "usd-20-cash",
    title: "Cash Reward USD 20 (dihentikan)",
    description: "Digantikan CASH REWARD Rp500.000 sejak 11 September 2026. Tidak bisa diklaim lagi.",
    pointsCost: 2000,
    rewardType: "MONETARY",
    monetaryValueMinor: 2000,
    currency: "USD",
    inventoryMode: "LIMITED",
    isActive: false,
  },
];

async function seed() {
  requireDevelopmentDatabase();
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    for (const sku of skus) {
      await sql`
        insert into rewards.catalog (slug, title, description, points_cost, reward_type, monetary_value_minor, currency, inventory_mode, is_active)
        values (${sku.slug}, ${sku.title}, ${sku.description}, ${sku.pointsCost}, ${sku.rewardType}, ${sku.monetaryValueMinor}, ${sku.currency}, ${sku.inventoryMode}, ${sku.isActive})
        on conflict (slug) do update set
          title = excluded.title,
          description = excluded.description,
          is_active = excluded.is_active,
          updated_at = now()
      `;
    }
    const active = skus.filter((sku) => sku.isActive).length;
    console.log(`Reward catalog ready: ${active} active SKUs, ${skus.length - active} retired.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await seed();
