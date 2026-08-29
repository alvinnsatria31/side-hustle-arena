import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { CheckCircle2, FileText, Video, Database, LayoutTemplate } from 'lucide-react';
import { SkillChip } from '@/components/primitives/SkillChip';
import type { WeeklyProject } from '@/types/project';

const resourceIcon = {
  document: FileText,
  video: Video,
  dataset: Database,
  template: LayoutTemplate,
};

interface ProjectBriefProps {
  project: WeeklyProject;
  className?: string;
}

export function ProjectBrief({ project, className }: ProjectBriefProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Badge variant="brand" size="md">{project.division}</Badge>
        <Badge variant="outline" size="md">{project.difficulty}</Badge>
      </div>
      <h1 className="mt-4 text-[32px] sm:text-[40px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em] leading-[1.1]">
        {project.title}
      </h1>
      <p className="mt-2 text-[13.5px] text-[var(--color-ink-tertiary)]">
        {project.difficulty} · {project.effort} · +{project.rewardPoints} pts
      </p>

      <div className="mt-10 space-y-10">
        <Section label="The Case" title="Latar Belakang">
          <p>{project.case}</p>
        </Section>

        <Section label="Your Role" title="Peranmu">
          <p>{project.role}</p>
        </Section>

        <Section label="Objective" title="Tujuan">
          <p>{project.objective}</p>
        </Section>

        <Section label="Deliverables" title="Yang Perlu Diserahkan">
          <ul className="space-y-2.5">
            {project.deliverables.map((d) => (
              <li key={d.id} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 text-[var(--color-brand-500)] shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-[var(--color-ink-primary)]">{d.title}</p>
                  {d.description && (
                    <p className="text-[12.5px] text-[var(--color-ink-tertiary)] mt-0.5">{d.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section label="Resources" title="Referensi">
          <div className="grid gap-2 sm:grid-cols-2">
            {project.resources.map((r) => {
              const Icon = resourceIcon[r.kind];
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-soft)] transition-colors"
                >
                  <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)] truncate">
                      {r.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-ink-tertiary)] uppercase tracking-wider">{r.kind}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section label="Skills" title="Skill yang Dilatih">
          <div className="flex flex-wrap gap-1.5">
            {project.skills.map((s) => (
              <SkillChip key={s} label={s} />
            ))}
          </div>
        </Section>

        <Section label="Deadline" title="Batas Waktu">
          <Card padding="md" className="bg-[var(--color-brand-50)] border-[var(--color-brand-100)]">
            <p className="text-[14px] font-semibold text-[var(--color-brand-700)]">{project.deadlineLabel}</p>
            <p className="text-[12.5px] text-[var(--color-ink-secondary)] mt-1">
              Hasil evaluasi keluar pada hari Sabtu.
            </p>
          </Card>
        </Section>
      </div>
    </div>
  );
}

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
          {label}
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <h2 className="mt-3 text-[20px] font-semibold text-[var(--color-ink-primary)]">{title}</h2>
      <div className="mt-3 text-[14.5px] leading-relaxed text-[var(--color-ink-secondary)]">{children}</div>
    </section>
  );
}
