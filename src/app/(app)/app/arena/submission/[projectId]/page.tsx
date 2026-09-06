'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarClock, Check, Download, ExternalLink, FileText, Link2 } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { ErrorState } from '@/components/states/ErrorState';
import {
  ArenaApiError,
  formatBytes,
  getMyEnrollmentForProject,
  getDownloadGrant,
  getSubmission,
  getVisibleProjectDetail,
  type ArenaSubmission,
} from '@/lib/arena-client';

function statusLabel(status: string): string {
  switch (status) {
    case 'SUBMITTED':
      return 'MENUNGGU REVIEW';
    case 'UNDER_REVIEW':
      return 'SEDANG DIREVIEW';
    case 'REVIEWED_HIDDEN':
      return 'DISEGEL SAMPAI FINALISASI';
    case 'FINALIZED':
      return 'FINAL';
    case 'DRAFT':
      return 'DRAFT';
    case 'VOIDED':
      return 'DIBATALKAN';
    default:
      return status.replace(/_/g, ' ');
  }
}

export default function SubmissionPage() {
  const reduce = useReducedMotion();
  const params = useParams<{ projectId: string }>();
  const [boot, setBoot] = useState<'loading' | 'ready' | 'missing' | 'empty' | 'expired' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<ArenaSubmission | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getVisibleProjectDetail(params.projectId);
        const enrollment = await getMyEnrollmentForProject(detail.id, detail.slug);
        if (cancelled) return;
        if (!enrollment) {
          setBoot('empty');
          return;
        }
        const sub = await getSubmission(enrollment.enrollmentId);
        if (cancelled) return;
        const hasContent =
          sub.items.length > 0 || Boolean(sub.explanation) || sub.status !== 'DRAFT';
        if (!hasContent) {
          setBoot('empty');
          return;
        }
        setSubmission(sub);
        setProjectTitle(detail.title);
        setEnrollmentId(enrollment.enrollmentId);
        setBoot('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ArenaApiError && (err.code === 'PROJECT_NOT_FOUND' || err.code === 'PROJECT_NOT_PUBLISHED')) {
          setBoot('missing');
        } else if (err instanceof ArenaApiError && err.status === 401) {
          setBoot('expired');
        } else {
          setBootError(err instanceof ArenaApiError ? err.message : 'Coba muat ulang halaman ini.');
          setBoot('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.projectId]);

  if (boot === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
        <span className="h-8 w-8 rounded-full border-[3px] border-sk-blue-tint border-t-sk-blue anim-spin" />
      </div>
    );
  }

  if (boot === 'empty') {
    return (
      <ErrorState
        title="Belum ada submission."
        description="Kamu belum menyelesaikan submission untuk project ini. Selesaikan workspace dulu, lalu submission kamu akan tampil di sini."
        primaryAction={{ label: 'Buka Workspace', href: '/app/arena' }}
        secondaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
      />
    );
  }

  if (boot === 'missing') {
    return (
      <ErrorState
        title="Project tidak ditemukan."
        description="Project yang kamu cari tidak tersedia atau sudah berakhir."
        primaryAction={{ label: 'Buka Arena', href: '/app/arena' }}
        secondaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
      />
    );
  }

  if (boot === 'expired') {
    return (
      <ErrorState
        title="Sesi berakhir."
        description="Login ulang untuk melihat submission kamu."
        primaryAction={{ label: 'Login', href: '/login' }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  if (boot === 'error' || !submission) {
    return (
      <ErrorState
        title="Submission gagal dimuat."
        description={bootError ?? 'Coba muat ulang halaman ini.'}
        primaryAction={{ label: 'Muat Ulang', href: `/app/arena/submission/${params.projectId}` }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  const finalized = submission.status === 'FINALIZED';
  const links = submission.items.filter((item) => item.itemType === 'LINK' && item.externalUrl);
  const files = submission.items.filter((item) => item.itemType === 'FILE');

  const downloadFile = async (itemId: string, fallbackName: string) => {
    if (!enrollmentId || downloadingId) return;
    setDownloadingId(itemId);
    setDownloadError(null);
    try {
      // Short-lived signed URL from the backend — never a permanent public URL.
      const grant = await getDownloadGrant(enrollmentId, itemId);
      const anchor = document.createElement('a');
      anchor.href = grant.url;
      anchor.download = grant.filename ?? fallbackName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setDownloadError(err instanceof ArenaApiError ? err.message : 'Download gagal. Coba lagi.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'App', href: '/app' },
          { label: 'Arena', href: '/app/arena' },
          { label: 'Submission' },
        ]}
      />

      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="mt-5">
        {/* Success hero */}
        <Card className="p-7 sm:p-9">
          <div className="mb-5 flex h-[64px] w-[64px] items-center justify-center rounded-[var(--radius-sk-xl)] bg-sk-success-tint text-sk-success">
            <Check size={30} strokeWidth={2.6} aria-hidden />
          </div>
          <span className="eyebrow">Submitted</span>
          <h1 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[32px]">
            Project berhasil dikirim.
          </h1>
          <p className="mb-6 max-w-[560px] text-[14px] leading-relaxed text-sk-muted">
            {finalized
              ? 'Review selesai dan week sudah difinalisasi — feedback kamu tersedia.'
              : 'Submission kamu sedang dalam proses review. Hasilnya disegel sampai finalisasi Jumat 23:59 WIB. Kamu bisa menutup halaman ini — status tersimpan di server.'}
          </p>

          <div className="mb-7 flex flex-wrap gap-2">
            <Badge variant="slate">{statusLabel(submission.status)}</Badge>
            <Badge variant="slate">Attempt {submission.reviewAttemptsUsed}/3</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            {finalized ? (
              <ButtonLink href={`/app/arena/result/${params.projectId}`}>Lihat Result</ButtonLink>
            ) : (
              <ButtonLink href="/app/arena" variant="ghost">
                Kembali ke Arena
              </ButtonLink>
            )}
            <ButtonLink href={`/app/arena/projects/${params.projectId}`} variant="ghost">
              Lihat Brief Project
            </ButtonLink>
          </div>
        </Card>

        {/* Submission recap */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="p-6 sm:p-7">
            <h2 className="mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
              Detail Submission
            </h2>
            <dl className="flex flex-col gap-4">
              <div>
                <dt className="mb-1 text-[12px] font-semibold text-sk-navy">Project</dt>
                <dd className="text-[13.5px] text-sk-muted">{projectTitle}</dd>
              </div>
              {files.length > 0 && (
                <div>
                  <dt className="mb-1.5 text-[12px] font-semibold text-sk-navy">
                    Files ({files.length})
                  </dt>
                  <dd className="flex flex-col gap-2">
                    {files.map((item) => (
                      <span
                        key={item.id}
                        className="flex max-w-full items-center gap-2.5 rounded-lg border border-sk-border bg-sk-bg px-3.5 py-2.5"
                      >
                        <FileText size={15} aria-hidden className="shrink-0 text-sk-blue" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-sk-navy">
                            {item.originalFilename ?? 'File'}
                          </span>
                          <span className="block font-mono text-[11px] text-sk-muted">
                            {item.mimeType ?? ''}{item.mimeType && item.fileSizeBytes != null ? ' · ' : ''}
                            {item.fileSizeBytes != null ? formatBytes(item.fileSizeBytes) : ''}
                          </span>
                        </span>
                        <button
                          type="button"
                          disabled={downloadingId === item.id}
                          aria-label={`Download ${item.originalFilename ?? 'file'}`}
                          onClick={() => {
                            void downloadFile(item.id, item.originalFilename ?? 'download');
                          }}
                          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-bold text-sk-blue transition-colors hover:bg-sk-blue-tint disabled:opacity-60"
                        >
                          <Download size={13} aria-hidden />
                          {downloadingId === item.id ? '…' : 'Download'}
                        </button>
                      </span>
                    ))}
                    {downloadError && (
                      <span role="alert" className="text-[12px] text-sk-error">
                        {downloadError}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {links.map((item) => (
                <div key={item.id}>
                  <dt className="mb-1 text-[12px] font-semibold text-sk-navy">
                    Submission Link{item.label ? ` · ${item.label}` : ''}
                  </dt>
                  <dd>
                    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-sk-border bg-sk-bg px-3.5 py-2.5 font-mono text-[12.5px] text-sk-navy">
                      <Link2 size={14} className="shrink-0 text-sk-blue" aria-hidden />
                      <span className="truncate">{item.externalUrl}</span>
                      <ExternalLink size={13} className="shrink-0 text-sk-faint" aria-hidden />
                    </span>
                  </dd>
                </div>
              ))}
              {submission.explanation && (
                <div>
                  <dt className="mb-1 text-[12px] font-semibold text-sk-navy">Short Explanation</dt>
                  <dd className="text-[13.5px] leading-relaxed text-sk-muted">{submission.explanation}</dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Review progress */}
          <Card className="p-6">
            <h2 className="mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
              Proses Review
            </h2>
            <ol className="flex flex-col gap-4">
              {[
                { label: 'Submission diterima', done: true },
                { label: 'Reviewer memeriksa deliverables', done: submission.status !== 'SUBMITTED' && submission.status !== 'DRAFT' },
                { label: 'Feedback tersedia', done: finalized },
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      s.done ? 'bg-sk-success-tint text-sk-success' : 'bg-sk-track text-sk-faint'
                    }`}
                    aria-hidden
                  >
                    {s.done ? <Check size={12} strokeWidth={3.5} /> : <CalendarClock size={12} />}
                  </span>
                  <span className={`text-[13px] ${s.done ? 'font-semibold text-sk-navy' : 'text-sk-muted'}`}>{s.label}</span>
                </li>
              ))}
            </ol>
            {!finalized && (
              <p className="mt-5 rounded-xl bg-sk-bg px-3.5 py-3 text-[11.5px] leading-relaxed text-sk-muted">
                Hasil review disegel sampai finalisasi Jumat 23:59 WIB — bukan hitungan detik.
              </p>
            )}
            {finalized && (
              <ButtonLink href={`/app/arena/result/${params.projectId}`} size="sm" className="mt-5" fullWidth>
                Buka Feedback
              </ButtonLink>
            )}
          </Card>
        </div>

        <div className="mt-6">
          <Link href="/app/arena" className="text-[13px] font-semibold text-sk-blue transition-colors hover:text-sk-blue-700">
            ← Kembali ke Arena
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
