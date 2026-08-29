import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Star, Briefcase, Building2 } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { SkillChip } from '@/components/primitives/SkillChip';
import { mockPortfolio } from '@/data/mock/portfolio';

export default async function PreviewCaseStudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = mockPortfolio.find((p) => p.id === id);
  if (!project) notFound();

  return (
    <div>
      <div className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-[1100px] px-5 lg:px-8 h-12 flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
          <Link href="/app/portfolio" className="hover:text-[var(--color-ink-primary)]">
            Portfolio
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[var(--color-ink-primary)] font-semibold">Preview · {project.title}</span>
        </div>
      </div>

      <article className="mx-auto max-w-[760px] px-5 lg:px-8 py-12 lg:py-16">
        {project.featured && (
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-pill)] bg-[var(--color-brand-50)] text-[12px] font-semibold text-[var(--color-brand-700)]">
            <Star className="h-3 w-3 fill-current" />
            Featured
          </span>
        )}

        <h1 className="mt-4 text-[36px] sm:text-[48px] font-bold text-[var(--color-ink-primary)] tracking-[-0.025em] leading-[1.05]">
          {project.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-[var(--color-ink-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            {project.role}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            {project.division}
          </span>
          <span>·</span>
          <span>{project.period}</span>
        </div>

        <p className="mt-7 text-[18px] leading-relaxed text-[var(--color-ink-secondary)]">
          {project.summary}
        </p>

        <Section label="Challenge">{project.challenge}</Section>
        <Section label="My Role">{project.role}. {project.summary}</Section>
        <Section label="Approach">{project.approach}</Section>

        <section className="mt-12">
          <h2 className="text-[20px] font-semibold text-[var(--color-ink-primary)]">Deliverables</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {project.deliverables.map((d) => (
              <li
                key={d}
                className="flex items-start gap-2.5 text-[15px] text-[var(--color-ink-secondary)] leading-relaxed"
              >
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--color-brand-500)] shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-[20px] font-semibold text-[var(--color-ink-primary)]">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.skills.map((s) => (
              <SkillChip key={s} label={s} />
            ))}
          </div>
        </section>

        <Section label="Result">{project.result}</Section>

        {project.evaluatorQuote && (
          <section className="mt-12 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] p-7">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
              Evaluator Feedback
            </p>
            <blockquote className="mt-3 text-[18px] leading-relaxed text-[var(--color-ink-primary)] font-medium">
              “{project.evaluatorQuote}”
            </blockquote>
            <p className="mt-3 text-[12.5px] text-[var(--color-ink-tertiary)]">— Sekolah Karir Evaluator</p>
          </section>
        )}

        <div className="mt-14 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Link href="/app/portfolio">
            <Button variant="secondary">Kembali</Button>
          </Link>
          <Link href={`/app/portfolio/${project.id}/edit`}>
            <Button variant="primary">Edit Case Study</Button>
          </Link>
        </div>
      </article>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[20px] font-semibold text-[var(--color-ink-primary)]">{label}</h2>
      <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--color-ink-secondary)]">{children}</p>
    </section>
  );
}
