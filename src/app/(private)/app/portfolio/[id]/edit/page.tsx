import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { CaseStudyEditor } from '@/components/ui/CaseStudyEditor';
import { mockPortfolio } from '@/data/mock/portfolio';

export default async function EditCaseStudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = mockPortfolio.find((p) => p.id === id);
  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
        <Link href="/app/portfolio" className="hover:text-[var(--color-ink-primary)]">
          Portfolio
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[var(--color-ink-primary)] font-semibold">Edit Case Study</span>
      </div>

      <div className="mt-3">
        <h1 className="text-[26px] sm:text-[32px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
          {project.title}
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-tertiary)]">
          {project.division} · {project.period}
        </p>
      </div>

      <div className="mt-7">
        <CaseStudyEditor project={project} />
      </div>
    </div>
  );
}
