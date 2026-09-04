/**
 * Preset avatar catalogue — transferred from sekolah-karir-website
 * (`src/lib/avatars.ts`) for Arena leaderboard/display identity (PRD §33).
 *
 * Deliberately not uploads: a picked preset costs nothing to store, cannot
 * carry anything that needs moderating, and renders identically on every
 * surface without an image request. Adding a row here ships a new avatar
 * with no migration and no backfill.
 *
 * Emoji rather than image files: no asset pipeline, no CDN allowlist, and
 * nothing to go missing when a bucket is reconfigured. This matters doubly
 * here because file bytes live in Tencent COS while identity display data
 * lives in Neon — avatars stay renderable even if object storage is down.
 */

export interface AvatarPreset {
  id: string;
  emoji: string;
  /** Shown in the picker and used as the image alt text. */
  label: string;
  tint: string;
}

export const AVATARS: AvatarPreset[] = [
  { id: 'rocket', emoji: '🚀', label: 'Roket', tint: '#DBEAFE' },
  { id: 'fire', emoji: '🔥', label: 'Api', tint: '#FEE2E2' },
  { id: 'bolt', emoji: '⚡', label: 'Petir', tint: '#FEF3C7' },
  { id: 'star', emoji: '⭐', label: 'Bintang', tint: '#FEF9C3' },
  { id: 'brain', emoji: '🧠', label: 'Otak', tint: '#FCE7F3' },
  { id: 'target', emoji: '🎯', label: 'Target', tint: '#FFE4E6' },
  { id: 'palette', emoji: '🎨', label: 'Palet', tint: '#EDE9FE' },
  { id: 'camera', emoji: '📸', label: 'Kamera', tint: '#E0E7FF' },
  { id: 'pen', emoji: '✍️', label: 'Pena', tint: '#F1F5F9' },
  { id: 'chart', emoji: '📈', label: 'Grafik', tint: '#DCFCE7' },
  { id: 'code', emoji: '💻', label: 'Koding', tint: '#CFFAFE' },
  { id: 'mic', emoji: '🎙️', label: 'Mikrofon', tint: '#FAE8FF' },
  { id: 'coffee', emoji: '☕', label: 'Kopi', tint: '#FEF3C7' },
  { id: 'cat', emoji: '🐱', label: 'Kucing', tint: '#FFEDD5' },
  { id: 'ghost', emoji: '👻', label: 'Hantu', tint: '#E2E8F0' },
  { id: 'crown', emoji: '👑', label: 'Mahkota', tint: '#FEF08A' },
];

/** The id given to every new account, and the fallback for an unknown one. */
export const DEFAULT_AVATAR_ID = 'rocket';

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

/**
 * Never throws and never returns undefined: an id retired from the catalogue,
 * or corrupted in the column, degrades to the default rather than blanking a
 * leaderboard row.
 */
export function avatarFor(id: string | null | undefined): AvatarPreset {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_AVATAR_ID)!;
}

export function isValidAvatarId(id: string): boolean {
  return BY_ID.has(id);
}
