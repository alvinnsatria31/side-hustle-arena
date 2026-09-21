import assert from 'node:assert/strict';
import test from 'node:test';

const { dashboardFocus } = await import('../src/lib/dashboard-view.ts');
const enrollment = { project: { slug: 'sales-brief' }, status: 'ACTIVE', workspace: { currentStep: 'WORK' }, submission: null, ranking: null };

test('dashboard action follows actual participant progress', () => {
  assert.deepEqual(dashboardFocus(enrollment), { label: 'Lanjutkan proyek', href: '/app/arena/workspace/sales-brief', progress: 60, stage: 'Pengerjaan', step: 'WORK' });
  assert.deepEqual(dashboardFocus({ ...enrollment, submission: { latestVersionId: 'v1' } }), { label: 'Lihat kiriman', href: '/app/arena/submission/sales-brief', progress: 100, stage: 'Menunggu hasil', step: null });
  assert.deepEqual(dashboardFocus({ ...enrollment, ranking: { finalScore: 85 } }), { label: 'Lihat hasil', href: '/app/arena/result/sales-brief', progress: 100, stage: 'Hasil tersedia', step: null });
  assert.deepEqual(dashboardFocus({ ...enrollment, status: 'VOIDED' }), { label: 'Jelajahi proyek', href: '/app/arena/projects', progress: 0, stage: 'Dibatalkan', step: null });
});
