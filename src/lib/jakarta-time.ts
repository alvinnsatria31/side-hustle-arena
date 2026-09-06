/**
 * Jakarta wall-clock conversion for admin date inputs.
 *
 * The Arena schedules everything in Asia/Jakarta and an operator types a local
 * time, but `<input type="datetime-local">` is read in the *browser's* zone —
 * so an admin travelling, or one whose laptop is set to UTC, would otherwise
 * schedule a launch hours away from what they typed. WIB is a fixed +07:00
 * with no DST, so pinning the offset here is exact rather than approximate.
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** An instant, rendered as the `datetime-local` value an operator reads as WIB. */
export function toJakartaInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

/** The `datetime-local` value an operator typed, read as WIB, back to an instant. */
export function fromJakartaInput(value: string): string | null {
  // Browsers emit `YYYY-MM-DDTHH:mm` and, when the step allows it, seconds too.
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}${match[2] ?? ':00'}+07:00`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

/** Read-only display of a stored instant in Jakarta time. */
export function jakartaDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date);
}
