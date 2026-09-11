/**
 * One place that turns a week's deadline into words.
 *
 * Every surface used to write "Jumat 23:59 WIB" as a literal — the workspace
 * sidebar, the submission hero, the review-sealed note, the inbox email. It was
 * true for the regular weekly cadence and wrong for every ad-hoc week, which can
 * end on any day: ADHOC-2026-09-08 closed on a Tuesday while four screens told
 * its participants they had until Friday.
 *
 * Pure and timezone-explicit, so it renders identically on the server and in the
 * browser. That matters as much as the wording: a date formatted with the
 * viewer's local zone hydrates differently than the server rendered it.
 */

const TIMEZONE = "Asia/Jakarta";
/** Asia/Jakarta is UTC+7 year-round. Shown so the label is unambiguous. */
const ZONE_SUFFIX = "WIB";

function asDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Jumat · 23:59" — the compact form used on cards and in the header bar. */
export function deadlineLabel(value: Date | string): string {
  const date = asDate(value);
  if (!date) return "";
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: TIMEZONE }).format(date);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIMEZONE }).format(date);
  return `${weekday} · ${time}`;
}

/** "Jumat, 12 September 2026, 23:59 WIB" — for prose that promises a date. */
export function deadlineSentence(value: Date | string): string {
  const date = asDate(value);
  if (!date) return "";
  const full = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIMEZONE,
  }).format(date);
  return `${full} ${ZONE_SUFFIX}`;
}

/**
 * "sampai Jumat, 12 September 2026, 23:59 WIB", or a plain fallback when the
 * caller has no deadline to name. The fallback is deliberately vague rather than
 * confidently wrong — a screen with no week loaded should not invent a day.
 */
export function deadlinePhrase(value: Date | string | null | undefined, fallback = "sampai deadline minggu ini"): string {
  if (!value) return fallback;
  const sentence = deadlineSentence(value);
  return sentence ? `sampai ${sentence}` : fallback;
}
