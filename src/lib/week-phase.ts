/**
 * Where the current week stands for someone who has not taken a brief yet.
 *
 * `canSelect` alone cannot word a page: "not open yet" and "already over" are
 * both `false`, and they need opposite sentences. Pages that showed one line
 * for both ended up calling a finished week "Proyek Minggu Ini" with a deadline
 * of "Senin · 23.59" that read as next Monday.
 */
export type WeekPhase = 'open' | 'upcoming' | 'closed';

export function weekPhase(selection: { canSelect: boolean; reason?: string }): WeekPhase {
  if (selection.canSelect) return 'open';
  return selection.reason === 'WEEK_NOT_OPEN' ? 'upcoming' : 'closed';
}

export const ENROLMENT_LABEL: Record<WeekPhase, string> = {
  open: 'Pendaftaran dibuka',
  upcoming: 'Segera dibuka',
  closed: 'Pendaftaran ditutup',
};

/** Heading for a list of the week's projects. */
export const PROJECT_LIST_TITLE: Record<WeekPhase, string> = {
  open: 'Proyek Minggu Ini',
  upcoming: 'Proyek Sprint Berikutnya',
  closed: 'Proyek Sprint Terakhir',
};

export const PROJECT_LIST_LEDE: Record<WeekPhase, string> = {
  open: 'Pilih satu proyek yang sesuai dengan kemampuan yang ingin kamu latih.',
  upcoming: 'Pendaftaran belum dibuka. Baca dulu brief-nya supaya kamu siap memilih begitu sprint dimulai.',
  closed: 'Pendaftaran sprint ini sudah ditutup. Brief-nya masih bisa dibaca, dan proyek baru muncul di sini begitu sprint berikutnya dibuka.',
};
