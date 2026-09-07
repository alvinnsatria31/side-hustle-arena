import { fromJakartaInput } from './jakarta-time';

export function buildAdminLaunchRequest(form: {
  openNow: boolean; opensAt: string; deadline: string; title: string; reason: string; publish: boolean;
}, now = new Date()) {
  const opensAt = form.openNow ? now.toISOString() : fromJakartaInput(form.opensAt);
  const submissionDeadlineAt = fromJakartaInput(form.deadline);
  if (!opensAt || !submissionDeadlineAt) throw new Error('Isi waktu buka dan deadline yang valid.');
  if (new Date(submissionDeadlineAt) <= now || new Date(submissionDeadlineAt) <= new Date(opensAt)) {
    throw new Error('Deadline harus setelah waktu buka dan waktu sekarang.');
  }
  if (!form.reason.trim()) throw new Error('Isi alasan menjalankan workflow.');
  return { opensAt, submissionDeadlineAt, title: form.title.trim() || undefined,
    reason: form.reason.trim(), approve: form.publish, publish: form.publish };
}
