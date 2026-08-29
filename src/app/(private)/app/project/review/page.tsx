'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, ArrowLeft, Check } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { EmptyState } from '@/components/states/EmptyState';
import { FolderKanban, FileText, Link as LinkIcon, Paperclip } from 'lucide-react';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { useProjectDraft } from '@/features/weekly-project/useProjectDraft';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';
import { formatDate, formatTime } from '@/lib/format';

export default function ReviewPage() {
  const router = useRouter();
  const { hydrated, selectedSlug, submitProject } = useWeeklyProject();
  const project = selectedSlug ? mockWeeklyProjects.find((p) => p.slug === selectedSlug) : null;
  const { draft } = useProjectDraft(selectedSlug ?? 'default');

  if (!hydrated) return null;
  if (!project) {
    return (
      <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-10">
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="Belum ada project"
          description="Pilih 1 project minggu ini untuk direview."
          cta={{ label: 'Lihat Project', href: '/app/projects' }}
        />
      </div>
    );
  }

  const deliverables = project.deliverables.map((d) => ({
    id: d.id,
    title: d.title,
    done: !!draft?.deliverables[d.id],
  }));
  const incomplete = deliverables.filter((d) => !d.done);

  return (
    <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
        <Link href="/app/project" className="hover:text-[var(--color-ink-primary)]">
          {project.title}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/app/project/workspace" className="hover:text-[var(--color-ink-primary)]">
          Workspace
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-ink-primary)] font-semibold">Review</span>
      </div>

      <h1 className="mt-3 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
        Review submission
      </h1>
      <p className="mt-1.5 text-[14px] text-[var(--color-ink-tertiary)]">
        Cek ulang semuanya sebelum dikirim. Setelah dikirim, submission tidak dapat diedit.
      </p>

      <div className="mt-7 space-y-4">
        <Card padding="lg">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Project</h2>
          <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
              {project.division}
            </p>
            <p className="mt-1.5 text-[15px] font-semibold text-[var(--color-ink-primary)]">{project.title}</p>
            <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
              {project.difficulty} · {project.effort} · +{project.rewardPoints} pts
            </p>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Deliverables</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {deliverables.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2.5 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]"
              >
                <span
                  className={
                    'h-5 w-5 rounded-full flex items-center justify-center ' +
                    (d.done ? 'bg-[var(--color-success)] text-white' : 'bg-white border border-[var(--color-border-strong)] text-transparent')
                  }
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className={d.done ? 'text-[13.5px] text-[var(--color-ink-primary)]' : 'text-[13.5px] text-[var(--color-ink-tertiary)]'}>
                  {d.title}
                </span>
              </li>
            ))}
          </ul>
          {incomplete.length > 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] p-3.5">
              <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-[var(--color-ink-secondary)]">
                <span className="font-semibold text-[var(--color-ink-primary)]">
                  {incomplete.length} deliverable belum ditandai selesai.
                </span>{' '}
                Kamu tetap bisa submit, tapi evaluator akan melihat status ini.
              </p>
            </div>
          )}
        </Card>

        <Card padding="lg">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Attached</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {draft?.text ? (
              <AttachedItem icon={<FileText className="h-4 w-4" />} label="Campaign Strategy Document" sub="Text submission" />
            ) : null}
            {draft?.link ? (
              <AttachedItem icon={<LinkIcon className="h-4 w-4" />} label="External link" sub={draft.link} />
            ) : null}
            <AttachedItem icon={<Paperclip className="h-4 w-4" />} label="Campaign_Strategy_v1.pdf" sub="PDF · 1.2 MB" />
            <AttachedItem icon={<Paperclip className="h-4 w-4" />} label="Persona_Slides.pdf" sub="PDF · 0.8 MB" />
          </ul>
        </Card>

        <Card padding="lg">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Deadline</h2>
          <p className="mt-2 text-[14px] font-semibold text-[var(--color-ink-primary)]">
            {project.deadlineLabel}
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
            Submit sebelum deadline. Hasil evaluasi keluar Sabtu.
          </p>
        </Card>

        <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-soft)] border border-transparent p-4 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
          <p className="text-[13px] text-[var(--color-ink-secondary)]">
            <span className="font-semibold text-[var(--color-ink-primary)]">Perhatian: </span>
            Setelah dikirim, submission tidak dapat diedit.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Link href="/app/project/workspace">
            <Button variant="secondary" iconLeft={<ArrowLeft className="h-4 w-4" />}>
              Kembali Edit
            </Button>
          </Link>
          <Button
            variant="primary"
            onClick={() => {
              submitProject();
              router.push('/app/project/submitted');
            }}
          >
            Submit Project
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttachedItem({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <li className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white">
      <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)] truncate">{label}</p>
        <p className="text-[12px] text-[var(--color-ink-tertiary)] truncate">{sub}</p>
      </div>
    </li>
  );
}
