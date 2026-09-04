/**
 * Pure feature-flag core: no server-only import, no database import.
 * Safe to unit-test under plain node. The server wrapper lives in
 * feature-flags.ts next to this file.
 */

export const arenaFeatureKeys = [
  "arena-enrollment",
  "arena-submissions",
  "arena-publish",
  "rewards-redemption",
] as const;

export type ArenaFeatureKey = (typeof arenaFeatureKeys)[number];

export interface ArenaFeatureDefinition {
  key: ArenaFeatureKey;
  label: string;
  blurb: string;
}

export const ARENA_FEATURES: ArenaFeatureDefinition[] = [
  {
    key: "arena-enrollment",
    label: "Project selection",
    blurb: "Menutup pemilihan project mingguan. Workspace dan draft yang sudah ada tidak terpengaruh.",
  },
  {
    key: "arena-submissions",
    label: "Submissions",
    blurb: "Menutup draft, link, upload, dan submit/resubmit. Review yang sudah antre tetap diproses.",
  },
  {
    key: "arena-publish",
    label: "Weekly publish",
    blurb: "Menahan publish project mingguan (Senin) sampai dibuka kembali.",
  },
  {
    key: "rewards-redemption",
    label: "Reward redemption",
    blurb: "Menutup penukaran reward saja — katalog tetap bisa dilihat.",
  },
];

export interface ArenaFeatureState {
  closed: boolean;
  message: string | null;
}

export const ARENA_FEATURE_OPEN: ArenaFeatureState = { closed: false, message: null };

export function featureLabel(key: ArenaFeatureKey): string {
  return ARENA_FEATURES.find((f) => f.key === key)?.label ?? "Fitur ini";
}

/** Pure resolver — missing row means open. */
export function resolveArenaFeatureState(
  rows: Array<{ key: string; maintenanceMode: boolean; message: string | null }>,
  key: ArenaFeatureKey,
): ArenaFeatureState {
  const row = rows.find((r) => r.key === key);
  if (!row) return ARENA_FEATURE_OPEN;
  return row.maintenanceMode ? { closed: true, message: row.message } : ARENA_FEATURE_OPEN;
}
