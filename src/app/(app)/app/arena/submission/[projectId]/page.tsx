'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarClock, Check, ExternalLink, FileText, Link2 } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { ErrorState } from '@/components/states/ErrorState';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { useDemo } from '@/features/demo/store';
import { getProject } from '@/data/mock/projects';
import { useDemoReviewTicker } from '@/features/demo/store';

export default function SubmissionPage() {
  const reduce = useReducedMotion();
  useDemoReviewTicker();
  const { state } = useDemo();
  const enrollment = state.enrollment;

  if (!enrollment || !enrollment.submission) {
    return (
      <ErrorState
        title="Belum ada submission."
        description="Kamu belum menyelesaikan submission untuk project ini. Selesaikan workspace dulu, lalu submission kamu akan tampil di sini."
        primaryAction={{ label: 'Buka Workspace', href: '/app/arena' }}
        secondaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
      />
    );
  }

  const project = getProject(enrollment.projectSlug)!;
  const submittedAt = new Date(enrollment.submission.submittedAt);
  const reviewReady = enrollment.status === 'review_ready' && enrollment.review;

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
            {reviewReady
              ? 'Review selesai — feedback kamu sudah tersedia.'
              : 'Submission kamu sedang dalam proses review. Feedback akan tersedia dalam 1–2 hari. Kamu bisa menutup halaman ini — status tersimpan otomatis.'}
          </p>

          <div className="mb-7 flex flex-wrap gap-2">
            <StatusBadge status={enrollment.status} />
            <Badge variant="slate">
              Submitted · {submittedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{' '}
              {submittedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            {reviewReady ? (
              <ButtonLink href={`/app/arena/result/${enrollment.projectSlug}`}>Lihat Result →</ButtonLink>
            ) : (
              <ButtonLink href="/app/arena" variant="ghost">
                Kembali ke Arena
              </ButtonLink>
            )}
            <ButtonLink href={`/app/arena/projects/${project.slug}`} variant="ghost">
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
                <dd className="text-[13.5px] text-sk-muted">{project.title}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[12px] font-semibold text-sk-navy">Submission Link</dt>
                <dd>
                  <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-sk-border bg-sk-bg px-3.5 py-2.5 font-mono text-[12.5px] text-sk-navy">
                    <Link2 size={14} className="shrink-0 text-sk-blue" aria-hidden />
                    <span className="truncate">{enrollment.submission.url}</span>
                    <ExternalLink size={13} className="shrink-0 text-sk-faint" aria-hidden />
                  </span>
                </dd>
              </div>
              {enrollment.submission.explanation && (
                <div>
                  <dt className="mb-1 text-[12px] font-semibold text-sk-navy">Short Explanation</dt>
                  <dd className="text-[13.5px] leading-relaxed text-sk-muted">{enrollment.submission.explanation}</dd>
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
                { label: 'Reviewer memeriksa deliverables', done: enrollment.status !== 'submitted' },
                { label: 'Feedback tersedia', done: reviewReady },
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
            {!reviewReady && (
              <p className="mt-5 rounded-xl bg-sk-bg px-3.5 py-3 text-[11.5px] leading-relaxed text-sk-muted">
                <FileText size={11} className="mr-1 inline" aria-hidden />
                Demo lokal: review selesai otomatis beberapa detik setelah submit.
              </p>
            )}
            {reviewReady && (
              <ButtonLink href={`/app/arena/result/${enrollment.projectSlug}`} size="sm" className="mt-5" fullWidth>
                Buka Feedback →
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
