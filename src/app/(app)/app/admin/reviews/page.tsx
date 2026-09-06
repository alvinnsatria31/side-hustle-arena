'use client';

import { useCallback, useState } from 'react';
import {
  listAdminReviewsClient,
  overrideAdminReview,
  rerunAdminReview,
  useAdminResource,
  voidAdminEnrollment,
  type AdminReviewRow,
} from '@/lib/admin-client';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { ArenaApiError } from '@/lib/arena-client';

const STATUSES = ['', 'NEEDS_RESOLUTION', 'PROCESSING', 'COMPLETED_HIDDEN', 'PUBLISHED', 'FAILED', 'VOIDED'] as const;
const STATUS_VARIANT: Record<string, 'blue' | 'mint' | 'amber' | 'slate' | 'recommended'> = {
  NEEDS_RESOLUTION: 'amber',
  PROCESSING: 'blue',
  COMPLETED_HIDDEN: 'slate',
  PUBLISHED: 'mint',
  FAILED: 'amber',
  VOIDED: 'slate',
};

type Action =
  | { kind: 'override'; review: AdminReviewRow }
  | { kind: 'rerun'; review: AdminReviewRow }
  | { kind: 'void'; review: AdminReviewRow };

export default function AdminReviewsPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('NEEDS_RESOLUTION');
  const loader = useCallback(() => listAdminReviewsClient({ status: status || undefined, limit: 50 }), [status]);
  const reviews = useAdminResource(loader);

  const [action, setAction] = useState<Action | null>(null);
  const [score, setScore] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAction = (a: Action) => {
    setAction(a);
    setScore(a.kind === 'override' ? String(a.review.finalScore ?? a.review.aiScore ?? '') : '');
    setReason('');
    setError(null);
  };

  const submit = async () => {
    if (!action) return;
    if (!reason.trim()) {
      setError('Alasan wajib diisi untuk jejak audit.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      if (action.kind === 'override') {
        const parsed = Number(score);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error('Skor harus 0–100.');
        await overrideAdminReview({ reviewId: action.review.id, newScore: parsed, reason });
      } else if (action.kind === 'rerun') {
        await rerunAdminReview({ versionId: action.review.versionId, reason });
      } else {
        await voidAdminEnrollment({ enrollmentId: action.review.enrollmentId, reason });
      }
      setAction(null);
      await reviews.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : err instanceof Error ? err.message : 'Aksi gagal.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AdminShell title="Review" action={<AdminRefreshButton refresh={reviews.refresh} loading={reviews.loading} />}>
      <div className="mb-5">
        <label className="flex max-w-full flex-wrap items-center gap-3 text-sm font-semibold text-sk-navy">
          Status
          <select
            aria-label="Filter status review"
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
            className="h-11 w-64 max-w-full rounded-md border border-sk-border bg-white px-3 text-sm font-normal"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || 'Semua status'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reviews.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {reviews.error.message}
        </div>
      )}

      <div className="space-y-3">
        {reviews.data?.map((review) => (
          <Card key={review.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sk-navy">{review.weekCode}</span>
                  <Badge variant={STATUS_VARIANT[review.status] ?? 'slate'}>{review.status}</Badge>
                  <span className="text-xs text-sk-muted">run #{review.runNumber}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-sk-body">
                  <span>AI: {review.aiScore ?? '—'}</span>
                  <span>Final: {review.finalScore ?? '—'}</span>
                  <span>Confidence: {review.confidence ?? '—'}</span>
                  <span className="text-sk-muted">{review.model ?? 'stub'}</span>
                </div>
                {review.summary && <p className="mt-2 max-w-2xl text-sm text-sk-muted">{review.summary}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => openAction({ kind: 'rerun', review })}>
                  Rerun
                </Button>
                <Button size="sm" onClick={() => openAction({ kind: 'override', review })}>
                  Override
                </Button>
                <Button size="sm" variant="destructive" onClick={() => openAction({ kind: 'void', review })}>
                  Void peserta
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {reviews.data?.length === 0 && !reviews.loading && (
          <p className="py-10 text-center text-sm text-sk-muted">Tidak ada review dengan status ini.</p>
        )}
      </div>

      <Modal open={action !== null} onClose={() => setAction(null)} labelledBy="review-action-title">
        <div className="p-7">
          <h3 id="review-action-title" className="mb-2 text-lg font-bold text-sk-navy">
            {action?.kind === 'override' && 'Override skor'}
            {action?.kind === 'rerun' && 'Jalankan ulang review'}
            {action?.kind === 'void' && 'Void peserta ini'}
          </h3>
          <p className="mb-4 text-sm text-sk-muted">
            {action?.kind === 'override' && 'Skor asli tetap tersimpan untuk audit; ini menambahkan skor final baru.'}
            {action?.kind === 'rerun' && 'Menjalankan review baru untuk submission ini tanpa memakai jatah attempt peserta.'}
            {action?.kind === 'void' &&
              'Membatalkan enrollment ini (mis. plagiarisme). Poin yang sudah dibagikan akan ditarik balik, tapi skor review tetap tersimpan untuk audit.'}
          </p>
          {action?.kind === 'override' && (
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Skor baru (0-100)"
              className="mb-3"
            />
          )}
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan (wajib, tersimpan di audit log)"
            rows={3}
            className="mb-4"
          />
          {error && <p className="mb-4 text-sm text-sk-error">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setAction(null)} disabled={pending}>
              Batal
            </Button>
            <Button variant={action?.kind === 'void' ? 'destructive' : 'primary'} onClick={submit} loading={pending}>
              Konfirmasi
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
