'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { BottomActionTray } from '@/components/layout/BottomActionTray';
import { ProjectBrief } from '@/components/arena/ProjectBrief';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { useDemoAuth } from '@/features/auth/useDemoAuth';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';

interface Props {
  slug: string;
}

export function ProjectDetailClient({ slug }: Props) {
  const project = mockWeeklyProjects.find((p) => p.slug === slug);
  if (!project) {
    return null;
  }
  const router = useRouter();
  const { isAuthed } = useDemoAuth();
  const { selectedSlug, selectProject } = useWeeklyProject();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isSelected = selectedSlug === project.slug;
  const isOtherSelected = !!selectedSlug && !isSelected;

  const handlePrimary = () => {
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    selectProject(project.slug);
    if (!isAuthed) {
      router.push('/register');
      return;
    }
    router.push('/app/project');
  };

  return (
    <div className="pb-32 lg:pb-12">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_280px] items-start">
          <div>
            <ProjectBrief project={project} />
          </div>

          {/* Desktop sticky CTA */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-tertiary)]">
                Deadline
              </p>
              <p className="mt-1.5 text-[14.5px] font-semibold text-[var(--color-ink-primary)] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-brand-500)]" />
                {project.deadlineLabel}
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
                Hasil evaluasi keluar pada hari Sabtu.
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {isSelected ? (
                  <Button variant="primary" fullWidth onClick={() => router.push('/app/project')}>
                    Lanjutkan Project
                  </Button>
                ) : isOtherSelected ? (
                  <Button variant="secondary" fullWidth disabled>
                    Pilih 1 project per minggu
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handlePrimary}
                    iconRight={<ArrowRight className="h-4 w-4" />}
                  >
                    Ambil Project Minggu Ini
                  </Button>
                )}
                <a href="#brief">
                  <Button variant="ghost" fullWidth>
                    Lihat brief lagi
                  </Button>
                </a>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <BottomActionTray>
        {isSelected ? (
          <Button variant="primary" fullWidth size="lg" onClick={() => router.push('/app/project')}>
            Lanjutkan Project
          </Button>
        ) : isOtherSelected ? (
          <Button variant="secondary" fullWidth size="lg" disabled>
            Pilih 1 project per minggu
          </Button>
        ) : (
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={handlePrimary}
            iconRight={<ArrowRight className="h-4 w-4" />}
          >
            Ambil Project Minggu Ini
          </Button>
        )}
      </BottomActionTray>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Yakin memilih project ini?"
        description={`Kamu hanya bisa mengambil 1 project minggu ini. Setelah dikonfirmasi, pilihan tidak dapat diganti.`}
        warning="Setelah konfirmasi, project lain minggu ini akan terkunci."
        primaryLabel="Ya, Ambil Project"
        onPrimary={handleConfirm}
      >
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
            {project.division}
          </span>
          <p className="mt-1.5 text-[14px] font-semibold text-[var(--color-ink-primary)]">{project.title}</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
            {project.effort} · +{project.rewardPoints} pts
          </p>
        </div>
      </ConfirmSheet>
    </div>
  );
}
