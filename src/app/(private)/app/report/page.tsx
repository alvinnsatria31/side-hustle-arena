import { Trophy, TrendingUp, Target, Flame, ArrowRight, Briefcase, BarChart3, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { CareerMetric } from '@/components/ui/CareerMetric';
import { SkillBar } from '@/components/ui/SkillBar';
import { ScoreLineChart } from '@/components/ui/ScoreLineChart';
import { Badge } from '@/components/primitives/Badge';
import { EmptyState } from '@/components/states/EmptyState';
import { mockCareerReport } from '@/data/mock/career-report';
import { formatDateShort } from '@/lib/format';

export default function CareerReportPage() {
  const report = mockCareerReport;

  const isEmpty = report.projectsCompleted === 0;

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-12">
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Career Report kamu akan mulai terbentuk"
          description="Setelah project pertamamu dinilai, skor dan skill-mu akan muncul di sini."
          cta={{ label: 'Lihat Project Minggu Ini', href: '/arena/projects' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
            Career Report
          </span>
          <h1 className="mt-2 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            Bagaimana karirmu berkembang.
          </h1>
        </div>
        <Link href="/app/portfolio">
          <Button variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>
            Lihat Portfolio
          </Button>
        </Link>
      </div>

      {/* Top metrics */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CareerMetric
          label="Projects Completed"
          value={report.projectsCompleted}
          sublabel="total"
          icon={<Briefcase className="h-4.5 w-4.5" />}
        />
        <CareerMetric
          label="Average Score"
          value={report.averageScore}
          sublabel="avg"
          icon={<Trophy className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <CareerMetric
          label="Best Skill"
          value={report.bestSkill}
          sublabel="from skills profile"
          icon={<Target className="h-4.5 w-4.5" />}
        />
        <CareerMetric
          label="Current Streak"
          value={`${report.currentStreakWeeks} weeks`}
          sublabel="konsisten"
          icon={<Flame className="h-4.5 w-4.5" />}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Score Growth</h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
                Tren nilai rata-rata per minggu.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[var(--radius-pill)] bg-[var(--color-success-soft)] text-[12px] font-semibold text-[var(--color-success)]">
              <TrendingUp className="h-3.5 w-3.5" />
              +12 pts (4 weeks)
            </span>
          </div>
          <div className="mt-5">
            <ScoreLineChart data={report.growth} />
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Skill Profile</h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
            Berdasarkan hasil evaluasi project.
          </p>
          <ul className="mt-5 flex flex-col gap-4">
            {report.skills.map((s) => (
              <li key={s.id}>
                <SkillBar label={s.label} score={s.score} highlight={s.label === report.bestSkill} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Project history */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-[var(--color-ink-primary)]">Project History</h2>
          <span className="text-[12.5px] text-[var(--color-ink-tertiary)]">
            {report.history.length} project
          </span>
        </div>
        <Card padding="none" className="mt-3 overflow-hidden">
          <ul className="divide-y divide-[var(--color-border)]">
            {report.history.map((h) => (
              <li key={h.id}>
                <Link
                  href="/app/project/result"
                  className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--color-surface-soft)] transition-colors"
                >
                  <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center text-[12px] font-bold">
                    {h.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--color-ink-primary)] truncate">
                      {h.title}
                    </p>
                    <p className="text-[12px] text-[var(--color-ink-tertiary)]">
                      {h.division} · {formatDateShort(h.date)}
                    </p>
                  </div>
                  <Badge variant="success" size="sm">Selesai</Badge>
                  <ChevronRight className="h-4 w-4 text-[var(--color-ink-tertiary)]" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
