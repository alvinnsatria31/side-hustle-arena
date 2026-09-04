/**
 * Leaderboard handle rules — transferred from sekolah-karir-website
 * (`src/lib/username-guard.ts`) for Arena display identity (PRD §33).
 *
 * A username is not private data: it is shown to every other participant on
 * the leaderboard, so the checks are about what a stranger will read, not
 * about account safety. Three concerns, kept separate on purpose:
 *
 *   1. shape    — length and character set, so the board stays legible
 *   2. reserved — handles that would let someone impersonate the platform
 *   3. language — a small, deliberately blunt profanity screen
 *
 * The profanity list is intentionally short. An exhaustive filter is a losing
 * game and produces false positives that block real names (the Scunthorpe
 * problem), so this catches the lazy cases and leaves the rest to admin
 * review. Consumed by future profile/JIT-username flows; no DB dependency.
 */

/** Handles nobody may take: they imply the account speaks for the platform. */
const RESERVED = new Set([
  'admin',
  'administrator',
  'root',
  'mod',
  'moderator',
  'staff',
  'support',
  'help',
  'official',
  'sekolahkarir',
  'sekolah',
  'karir',
  'sidehustle',
  'arena',
  'system',
  'null',
  'undefined',
  'anonymous',
  'me',
  'you',
]);

/**
 * Matched as substrings against the normalised handle. Indonesian and
 * English, lowercase.
 */
const PROFANITY = [
  'anjing',
  'bangsat',
  'kontol',
  'memek',
  'ngentot',
  'ngentod',
  'pepek',
  'jancok',
  'jancuk',
  'asu',
  'bajingan',
  'kampret',
  'goblok',
  'tolol',
  'babi',
  'pantek',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'porn',
  'nazi',
  'hitler',
];

/** How long a participant must wait between renames. */
export const USERNAME_RENAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/**
 * Lower-cases and strips everything that is not a letter or digit — the same
 * normalisation the column is stored in, so an existing handle round-trips
 * unchanged.
 */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type UsernameCheck = { ok: true; username: string } | { ok: false; error: string };

/**
 * Shape + reserved + language, in that order so the message a user sees is
 * the most actionable one rather than whichever rule happened to run first.
 */
export function checkUsername(raw: string): UsernameCheck {
  const username = normalizeUsername(raw);

  if (username.length < USERNAME_MIN) {
    return {
      ok: false,
      error: `Username minimal ${USERNAME_MIN} karakter (huruf atau angka).`,
    };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, error: `Username maksimal ${USERNAME_MAX} karakter.` };
  }
  // An all-digit handle reads as an id, not a person, and sorts strangely
  // next to real names on the board.
  if (/^\d+$/.test(username)) {
    return { ok: false, error: 'Username tidak boleh angka semua.' };
  }
  if (RESERVED.has(username)) {
    return { ok: false, error: 'Username ini dipesan sistem. Pilih yang lain.' };
  }
  if (PROFANITY.some((word) => username.includes(word))) {
    return { ok: false, error: 'Username mengandung kata yang tidak pantas.' };
  }

  return { ok: true, username };
}

/**
 * Null `changedAt` means never renamed, which is always allowed. Returns the
 * milliseconds still to wait, or 0 when free.
 */
export function renameCooldownRemaining(
  changedAt: Date | null,
  now: Date = new Date()
): number {
  if (!changedAt) return 0;
  const elapsed = now.getTime() - changedAt.getTime();
  return Math.max(0, USERNAME_RENAME_COOLDOWN_MS - elapsed);
}

/** "3 hari lagi" / "5 jam lagi" — for the error message on a blocked rename. */
export function formatCooldown(ms: number): string {
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours >= 24) {
    const days = Math.ceil(hours / 24);
    return `${days} hari lagi`;
  }
  return `${hours} jam lagi`;
}
