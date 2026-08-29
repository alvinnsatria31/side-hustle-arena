'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { CheckCircle2, Clock, Calendar, FileText, Link as LinkIcon, Paperclip } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import { formatDate, formatTime } from '@/lib/format';

export default function SubmittedPage() {
  const router = useRouter();
  const { selectedSlug, submittedAt, submitProject, showResult } = useWeeklyProject();
  const project = selectedSlug ? mockWeeklyProjects.find((p) => p.slug === selectedSlug) : null;

  // If user lands here without submitting, default to now
  useEffect(() => {
    if (!submittedAt && project) {
      submitProject();
    }
  }, [submittedAt, project, submitProject]);

  if (!project) return null;

  const submitted = submittedAt ? new Date(submittedAt) : new Date();
  const resultAt = new Date(submitted.getTime() + 12 * 60 * 60 * 1000); // ~12h after

  return (
    <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-12 lg:py-16">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-[30px] sm:text-[36px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em]">
          Project berhasil dikirim
        </h1>
        <p className="mt-2 text-[14.5px] text-[var(--color-ink-secondary)] max-w-md mx-auto">
          Submission kamu sudah kami terima. Hasil evaluasi keluar Sabtu.
        </p>
      </div>

      <div className="mt-10 space-y-4">
        <Card padding="lg">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-tertiary)]">
                Submitted
              </p>
              <p className="mt-1.5 text-[15px] font-semibold text-[var(--color-ink-primary)] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-ink-tertiary)]" />
                {formatDate(submitted)} · {formatTime(submitted)}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-tertiary)]">
                Hasil Evaluasi
              </p>
              <p className="mt-1.5 text-[15px] font-semibold text-[var(--color-ink-primary)] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-ink-tertiary)]" />
                Sabtu, mulai 12:00 WIB
              </p>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
            <span className="inline-flex items-center gap-2 h-7 px-3 rounded-[var(--radius-pill)] bg-[var(--color-warning-soft)] text-[12px] font-semibold text-[var(--color-warning)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
              Menunggu Evaluasi
            </span>
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink-primary)]">Submission</h3>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
            Disimpan read-only setelah dikirim.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            <li className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]">
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-white text-[var(--color-brand-600)] flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)] truncate">
                  Campaign Strategy Document
                </p>
                <p className="text-[12px] text-[var(--color-ink-tertiary)]">Text submission</p>
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">
                Read-only
              </span>
            </li>
            <li className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]">
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-white text-[var(--color-brand-600)] flex items-center justify-center">
                <Paperclip className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)] truncate">
                  Campaign_Strategy_v1.pdf
                </p>
                <p className="text-[12px] text-[var(--color-ink-tertiary)]">PDF · 1.2 MB</p>
              </div>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-tertiary)]">
                Read-only
              </span>
            </li>
          </ul>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Link href="/app">
            <Button variant="secondary">Kembali ke Beranda</Button>
          </Link>
          <Button
            variant="primary"
            onClick={() => {
              showResult();
              router.push('/app/project/result');
            }}
          >
            Lihat Preview Hasil
          </Button>
        </div>
      </div>
    </div>
  );
}
