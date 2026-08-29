'use client';

import Link from 'next/link';
import {
  ScanLine,
  FolderKanban,
  FileBarChart,
  Briefcase,
  Gift,
  ArrowRight,
  Sparkles,
  Zap,
  Trophy,
  Award,
} from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { CareerMetric } from '@/components/ui/CareerMetric';
import { mockUser } from '@/data/mock/user';
import { mockWeeklyProjects } from '@/data/mock/projects';
import { mockCareerReport } from '@/data/mock/career-report';
import { useWeeklyProject } from '@/features/weekly-project/useWeeklyProject';

export default function DashboardPage() {
  const { selectedSlug } = useWeeklyProject();
  const activeProject = selectedSlug
    ? mockWeeklyProjects.find((p) => p.slug === selectedSlug)
    : mockWeeklyProjects[0];
  const progress = 70;
  const daysLeft = 2;

  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      {/* Greeting */}
      <div className="anim-fade-up">
        <h1 className="text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
          Selamat datang kembali, {mockUser.name.split(' ')[0]}.
        </h1>
        <p className="mt-1.5 text-[14.5px] text-[var(--color-ink-tertiary)]">
          Lanjutkan perkembangan karirmu minggu ini.
        </p>
      </div>

      {/* Primary: Weekly project */}
      <div className="mt-6">
        <Card padding="lg" className="bg-gradient-to-br from-[var(--color-brand-50)] via-white to-white border-[var(--color-brand-100)] overflow-hidden relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
              Weekly Project
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-warning)]">
              <Zap className="h-3.5 w-3.5" />
              {daysLeft} hari lagi
            </span>
          </div>
          <h2 className="mt-3 text-[22px] sm:text-[26px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            {activeProject?.title}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-ink-tertiary)]">
            {activeProject?.division}
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[12.5px] text-[var(--color-ink-tertiary)] mb-2">
              <span>Progress</span>
              <span className="font-semibold text-[var(--color-ink-primary)]">{progress}%</span>
            </div>
            <ProgressBar value={progress} color="brand" size="lg" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href="/app/project">
              <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />}>
                Lanjutkan Project
              </Button>
            </Link>
            <Link href="/app/projects">
              <Button variant="ghost">Lihat Project Lain</Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Metric row */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <CareerMetric
          label="CV Terbaru"
          value={78}
          sublabel="GOOD · perlu perbaikan"
          icon={<ScanLine className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <CareerMetric
          label="Points"
          value={`${mockUser.points.toLocaleString('id-ID')}`}
          sublabel="pts · akumulasi"
          icon={<Sparkles className="h-4.5 w-4.5" />}
        />
        <CareerMetric
          label="Career Report"
          value={mockCareerReport.averageScore}
          sublabel={`avg · ${mockCareerReport.projectsCompleted} project selesai`}
          icon={<Trophy className="h-4.5 w-4.5" />}
        />
      </div>

      {/* Quick access */}
      <div className="mt-8">
        <h3 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Akses cepat</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAccess
            href="/app/scanner"
            label="Scan CV"
            description="Cek kelolosan ATS"
            Icon={ScanLine}
          />
          <QuickAccess
            href="/app/projects"
            label="Weekly Project"
            description="Pilih & kerjakan"
            Icon={FolderKanban}
          />
          <QuickAccess
            href="/app/report"
            label="Career Report"
            description="Pantau skill & growth"
            Icon={FileBarChart}
          />
          <QuickAccess
            href="/app/portfolio"
            label="Portfolio"
            description="Case study profesional"
            Icon={Briefcase}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAccess
            href="/app/rewards"
            label="Rewards"
            description="Tukar poin karirmu"
            Icon={Gift}
          />
          <QuickAccess
            href="/app/profile"
            label="Profile"
            description="Atur minat & fokus"
            Icon={Award}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAccess({
  href,
  label,
  description,
  Icon,
}: {
  href: string;
  label: string;
  description: string;
  Icon: typeof ScanLine;
}) {
  return (
    <Link href={href} className="group">
      <Card padding="md" interactive className="h-full">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center group-hover:bg-[var(--color-brand-100)] transition-colors">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-[var(--color-ink-primary)]">{label}</p>
            <p className="text-[12.5px] text-[var(--color-ink-tertiary)] mt-0.5">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--color-ink-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Card>
    </Link>
  );
}
