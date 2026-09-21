/**
 * Preset avatar catalogue — the face a participant shows on the leaderboard,
 * the top bar and their profile (PRD §33).
 *
 * Deliberately not uploads: a picked preset costs nothing to store, cannot
 * carry anything that needs moderating, and renders identically on every
 * surface. Adding a row here ships a new avatar with no migration and no
 * backfill.
 *
 * Since 2026-09-22 the presets are illustrated portraits (the owner's sheet,
 * sliced into `public/arena/avatars/aNNN.webp`) instead of emoji. The emoji ids
 * that accounts already store stay valid and resolve to a portrait, so nobody
 * has to pick again and no stored value becomes an error.
 */

export interface AvatarPreset {
  id: string;
  /** Used as the image alt text and the picker's accessible name. */
  label: string;
  /** The portrait's own background colour: the placeholder while it loads. */
  tint: string;
  image: string;
}

/** Background colours sampled from each portrait, in sheet order. */
const TINTS = [
  '#cce6fd', '#ecdefd', '#d7e8fd', '#d9f4db', '#fce0e0', '#d4e6fe', '#d6f5d9', '#ebdafd', '#fde1d0', '#d8f6d6', '#ede6fd',
  '#e3f2e1', '#e5e2fe', '#feebc6', '#e6d5fd', '#fed7d7', '#dce8fc', '#fee1cf', '#d8f5e3', '#cbe4fd', '#ebe0fd', '#cceefd',
  '#d1e5fd', '#e9e2fd', '#d3f5e5', '#feded1', '#d8e5fd', '#d5e5fd', '#dcf7d9', '#e7e4fd', '#fed3d5', '#d8f6d3', '#fee5ec',
  '#ccf0fd', '#e3dffd', '#fedbe3', '#e4e3fd', '#dcf6d4', '#fee0d1', '#cbeefd', '#d8f4e4', '#dce9fd', '#fdd5de', '#cfe6fd',
  '#feddd4', '#ddf7d5', '#cbf3f5', '#ede0fd', '#fee9c6', '#e9defd', '#d8f4e4', '#fde0eb', '#d1e6fd', '#e1f7d9', '#f6e7e6',
  '#fedbda', '#ecdefd', '#cce4fe', '#e2f8d9', '#ebdcfd', '#d1f6df', '#fee4ca', '#c7e2fd', '#ddd9fd', '#fedde6', '#cde4fd',
  '#caedfe', '#fed7db', '#ddf6d5', '#e8d7fd', '#cdeefe', '#d4f6d7', '#fedad8', '#c9e3fe', '#d5f7dd', '#fee3c8', '#dae7fd',
  '#dbf5df', '#eedffd', '#d9f3e5', '#feddea', '#d7f4e1', '#eee2fd', '#d6f5e7', '#d4e8fd', '#fed9d5', '#cdf0fd', '#deddfc',
  '#feecc9', '#cbe4fd', '#fee0ca', '#eae1fd', '#fee1ec', '#d5f6dd', '#fee2d3', '#d2f6e6', '#d5e4fe', '#e3f3e2', '#d6e7fd',
  '#d0e5fd', '#fed4d5', '#cae3fd', '#d6f5e5', '#efe0fd', '#d5e4fd', '#fed4d5', '#dfddfd', '#fbe2de', '#e0defd', '#fedde3',
];

export const AVATARS: AvatarPreset[] = TINTS.map((tint, index) => {
  const n = String(index + 1).padStart(3, '0');
  return { id: `a${n}`, label: `Avatar ${index + 1}`, tint, image: `/arena/avatars/a${n}.webp` };
});

/** The id given to every new account, and the fallback for an unknown one. */
export const DEFAULT_AVATAR_ID = 'a001';

/**
 * The emoji presets accounts picked before the portraits, each pinned to a
 * portrait so the person keeps one stable face instead of a new one per page.
 */
const LEGACY_IDS: Record<string, string> = {
  rocket: 'a001', fire: 'a015', bolt: 'a025', star: 'a009', brain: 'a036',
  target: 'a023', palette: 'a052', camera: 'a043', pen: 'a044', chart: 'a058',
  code: 'a006', mic: 'a069', coffee: 'a013', cat: 'a076', ghost: 'a055', crown: 'a080',
};

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

/** Stable, well-spread index for a name, so an account without a pick still gets its own face. */
function seededIndex(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % AVATARS.length;
}

/**
 * Never throws and never returns undefined. A picked id wins; an old emoji id
 * maps to its portrait; anything else — no pick yet, or a retired id — takes a
 * portrait derived from `seed` (a display name) so a leaderboard of people who
 * never chose still looks like a room of different people, and finally the
 * default.
 */
export function avatarFor(id: string | null | undefined, seed?: string | null): AvatarPreset {
  const legacy = id && Object.hasOwn(LEGACY_IDS, id) ? LEGACY_IDS[id] : undefined;
  const picked = id ? (BY_ID.get(id) ?? (legacy ? BY_ID.get(legacy) : undefined)) : undefined;
  if (picked) return picked;
  if (seed) return AVATARS[seededIndex(seed)];
  return BY_ID.get(DEFAULT_AVATAR_ID)!;
}

export function isValidAvatarId(id: string): boolean {
  return BY_ID.has(id) || Object.hasOwn(LEGACY_IDS, id);
}
