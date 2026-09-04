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
 * SKU policy (PRD §35, confirmed 2026-09-04: PRD-only pricing):
 * - `usd-20-cash` is the ONLY confirmed, active SKU: 2,000 points → USD 20,
 *   LIMITED inventory. This is the locked business rule; do not retune here.
 * - The five supporting SKUs are website-proven ideas seeded INACTIVE with
 *   their names only: PRD lists them as potentials WITHOUT prices, so they
 *   ship as unpriced proposals for admin approval and can never be claimed
 *   until the PO prices each one explicitly.
 * - Re-runs only refresh operational columns (title/description/active flag);
 *   an admin-edited price is never clobbered.
 */
const skus = [
  {
    slug: "usd-20-cash",
    title: "Cash Reward USD 20",
    description: "Tukar 2.000 Arena Points dengan cash reward USD 20. Klaim ditinjau manual oleh tim sebelum pencairan.",
    pointsCost: 2000,
    rewardType: "MONETARY",
    monetaryValueMinor: 2000,
    currency: "USD",
    inventoryMode: "LIMITED",
    isActive: true,
  },
  {
    slug: "notion-kit",
    title: "Template Notion & Resume Starter Kit",
    description: "Proposal SKU dari katalog website — menunggu keputusan ekonomi points/XP.",
    pointsCost: 300,
    rewardType: "DIGITAL",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "UNLIMITED",
    isActive: false,
  },
  {
    slug: "ebook",
    title: "E-Book Banting Stir Karir & HR Interview Guide",
    description: "Proposal SKU dari katalog website — menunggu keputusan ekonomi points/XP.",
    pointsCost: 600,
    rewardType: "DIGITAL",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "UNLIMITED",
    isActive: false,
  },
  {
    slug: "voucher-50",
    title: "Voucher Diskon 50% Masterclass",
    description: "Proposal SKU dari katalog website — menunggu keputusan ekonomi points/XP.",
    pointsCost: 1000,
    rewardType: "DISCOUNT",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "UNLIMITED",
    isActive: false,
  },
  {
    slug: "cv-review",
    title: "1-on-1 CV & Portfolio Review (20 Menit)",
    description: "Proposal SKU dari katalog website — menunggu keputusan ekonomi points/XP.",
    pointsCost: 1500,
    rewardType: "SERVICE",
    monetaryValueMinor: null,
    currency: null,
    inventoryMode: "LIMITED",
    isActive: false,
  },
  {
    slug: "free-pass",
    title: "100% Free Pass All Masterclass",
    description: "Proposal SKU dari katalog website — menunggu keputusan ekonomi points/XP.",
    pointsCost: 2200,
    rewardType: "MASTERCLASS",
    monetaryValueMinor: null,
    currency: null,
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
    console.log(`Reward catalog ready: ${skus.length} SKUs (1 active, ${skus.length - 1} pending PO approval).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await seed();
