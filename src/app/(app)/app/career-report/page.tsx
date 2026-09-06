'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Briefcase, TrendingUp } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { CountUp } from '@/components/motion/CountUp';
import { Entrance, Reveal, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { EmptyState } from '@/components/states/EmptyState';
import { RecommendedCard } from '@/components/arena/RecommendedCard';
import { useDemo } from '@/features/demo/store';
import { buildCareerReport } from '@/features/demo/report';
import { getProject } from '@/data/mock/projects';
import { cn } from '@/lib/cn';

function SkillBar({ name, score, weak, delay }: { name: string; score: number; weak?: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const [inView, setInView] = useState(false);
  const ref = (node: HTMLDivElement | null) => {
    if (node && !inView) {
      const observer = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && setInView(true)),
        { rootMargin: '-40px' },
      );
      observer.observe(node);
    }
  };
  return (
    <div ref={ref} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 py-2.5 sm:grid-cols-[140px_1fr_40px] sm:gap-4">
      <span className="text-[13.5px] font-semibold text-sk-navy">{name}</span>
      <div className="h-2 overflow-hidden rounded-full bg-sk-track">
        <motion.div
          className={cn(
            'h-full rounded-full',
            weak ? 'bg-gradient-to-r from-sk-warning to-[#f0a94c]' : 'bg-gradient-to-r from-sk-blue to-sk-blue-400',
          )}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: inView || reduce ? `${score}%` : 0 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay }}
        />
      </div>
      <span className={cn('text-right font-mono text-[13px] font-bold', weak ? 'text-sk-warning-ink' : 'text-sk-navy')}>
        {score}
      </span>
    </div>
  );
}

export default function CareerReportPage() {
  const reduce = useReducedMotion();
  const { state, hydrated } = useDemo();
  const report = buildCareerReport(state);
  const nextProject = getProject(report.nextProjectSlug)!;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (hydrated) setMounted(true);
  }, [hydrated]);

  if (mounted && report.projectsCompleted === 0) {
    return (
      <div className="py-10">
        <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Career Report' }]} />
        <div className="mt-10">
          <EmptyState
            title="Belum ada project selesai."
            description="Mulai project pertamamu untuk membangun bukti skill dan memulai Career Report."
            primaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
            secondaryAction={{ label: 'Kembali ke Home', href: '/app' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Career Report' }]} />

      {/* Hero + progress donut */}
      <div className="mb-8 mt-5 grid items-center gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <Entrance>
            <span className="eyebrow">Career Report</span>
          </Entrance>
          <Entrance delay={0.08}>
            <h1 className="mb-2 mt-2.5 text-[30px] font-extrabold tracking-[-0.025em] text-sk-navy sm:text-[38px]">
              Perkembangan skill kamu.
            </h1>
          </Entrance>
          <Entrance delay={0.16}>
            <p className="max-w-[540px] text-[14px] leading-relaxed text-sk-muted">
              {report.projectsCompleted} project terakhir menaikkan skor rata-rata kamu dari{' '}
              <b className="text-sk-navy">{report.previousAverage}</b> ke{' '}
              <b className="text-sk-navy">{report.averageScore}</b>. SQL dan Presentation masih perlu diperkuat — kami punya
              project yang cocok.
            </p>
          </Entrance>
        </div>
        <Entrance delay={0.2}>
          <Card className="flex items-center gap-4 p-5">
            <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90 shrink-0">
              <circle cx="44" cy="44" r="36" stroke="var(--color-sk-track)" strokeWidth="10" fill="none" />
              <motion.circle
                cx="44"
                cy="44"
                r="36"
                stroke="#246BFD"
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 36}
                initial={reduce ? false : { strokeDashoffset: 2 * Math.PI * 36 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 36 * (1 - report.progress / 100) }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              />
            </svg>
            <div>
              <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">CAREER PROGRESS</div>
              <div className="mt-1.5 text-[32px] font-extrabold leading-none tracking-[-0.02em] text-sk-navy">
                <CountUp to={report.progress} />
                <span className="text-[16px] text-sk-muted">%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-sk-success">
                <TrendingUp size={11} aria-hidden /> {report.progressTrend.replace('↑ ', '')}
              </div>
            </div>
          </Card>
        </Entrance>
      </div>

      {/* Summary */}
      <StaggerGroup className="mb-8 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          { k: 'PROJECTS COMPLETED', v: report.projectsCompleted, t: '2 bulan ini' },
          { k: 'SKILLS PROVEN', v: report.skillsProvenCount, t: '↑ +3' },
          { k: 'AVERAGE SCORE', v: report.averageScore, t: `↑ dari ${report.previousAverage}` },
          { k: 'CAREER POINTS', v: report.careerPoints, t: report.level },
        ].map((s) => (
          <StaggerItem key={s.k}>
            <Card className="p-5">
              <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">{s.k}</div>
              <div className="mt-2 text-[28px] font-extrabold tracking-[-0.02em] text-sk-navy">
                <CountUp to={s.v} />
              </div>
              <div className="mt-1 text-[11px] font-semibold text-sk-success">{s.t}</div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: skills + history */}
        <div className="flex flex-col gap-5">
          <Reveal>
            <Card className="p-6 sm:p-7">
              <h3 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
                Your Strongest Skills
              </h3>
              {report.strongestSkills.map((s, i) => (
                <SkillBar key={s.name} name={s.name} score={s.score} delay={i * 0.08} />
              ))}

              <h3 className="mb-3 mt-7 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
                Needs Improvement
              </h3>
              {report.needsImprovement.map((s, i) => (
                <SkillBar key={s.name} name={s.name} score={s.score} weak delay={0.2 + i * 0.08} />
              ))}
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card className="p-6 sm:p-7">
              <h3 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
                Project History
              </h3>
              <StaggerGroup className="divide-y divide-dashed divide-sk-border">
                {report.history.map((h) => (
                  <StaggerItem key={h.projectSlug + h.completedAt}>
                    <div className="grid grid-cols-[50px_1fr] items-center gap-4 py-4 sm:grid-cols-[50px_1fr_auto]">
                      <div className="text-center font-mono text-[22px] font-extrabold tracking-[-0.02em] text-sk-blue">
                        {h.score}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold text-sk-navy">{h.title}</div>
                        <div className="mt-0.5 truncate font-mono text-[11.5px] tracking-[0.05em] text-sk-muted">
                          {h.category.toUpperCase()} · {h.skills.join(' · ').toUpperCase()}
                        </div>
                      </div>
                      <div className="hidden font-mono text-[11.5px] text-sk-muted sm:block">
                        Selesai ·{' '}
                        {new Date(h.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </Card>
          </Reveal>
        </div>

        {/* Right: next project + jobs bridge */}
        <div className="flex flex-col gap-5">
          <Reveal delay={0.15}>
            <RecommendedCard
              project={nextProject}
              compact
              className="!p-6"
              eyebrow="Langkah Selanjutnya"
              reason={report.nextProjectReason}
              ctaLabel="Lihat Project"
              hrefPrefix="/app/arena/projects"
            />
          </Reveal>

          <Reveal delay={0.2}>
            <Card className="border-sk-blue-tint-border bg-gradient-to-b from-[#F4F8FF] to-white p-6">
              <span className="eyebrow">Jobs Connection</span>
              <h4 className="mb-1.5 mt-2 text-[18px] font-bold tracking-[-0.01em] text-sk-navy">
                Kamu siap mencari peluang.
              </h4>
              <p className="mb-4 text-[13px] leading-relaxed text-sk-muted">
                Berdasarkan CV, project, dan skill kamu, kami menemukan {report.jobs.matches} lowongan yang match dengan
                profilmu.
              </p>
              <ButtonLink href="/app/jobs" className="w-full justify-center">
                Lihat Lowongan yang Cocok
              </ButtonLink>
            </Card>
          </Reveal>

          <Reveal delay={0.25}>
            <Card className="p-6">
              <span className="eyebrow">Weekly Spotlight</span>
              <h4 className="mb-1.5 mt-2 text-[16px] font-bold text-sk-navy">Bandingkan dengan yang terbaik.</h4>
              <p className="mb-4 text-[12.5px] leading-relaxed text-sk-muted">
                Lihat proses di balik project terbaik minggu ini untuk referensi standar kualitas.
              </p>
              <ButtonLink href="/arena/showcase" variant="ghost" size="sm">
                Buka Weekly Spotlight
              </ButtonLink>
            </Card>
          </Reveal>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border px-4 py-3.5 text-[12px] text-sk-muted">
        <Briefcase size={14} aria-hidden className="shrink-0 text-sk-blue" />
        Career Report ini dibangun dari bukti nyata: CV scan + project yang sudah direview. Semakin banyak project, semakin
        tajam report-nya.
      </div>
    </div>
  );
}
