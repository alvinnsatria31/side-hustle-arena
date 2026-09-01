'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Entrance, Reveal } from '@/components/motion/Reveal';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { StatCard } from '@/components/primitives/StatCard';
import { useDemo } from '@/features/demo/store';
import { ARENA_STATS, ARENA_WEEK, ARENA_DEADLINE } from '@/data/mock/arena';
import { RECOMMENDED_PROJECT_SLUG, getProject, mockProjects } from '@/data/mock/projects';
import { CalendarClock, Check, ClipboardList, LayoutGrid, Trophy } from 'lucide-react';

export default function AppArenaPage() {
  const reduce = useReducedMotion();
  const { state } = useDemo();
  const enrollment = state.enrollment;
  const recommended = getProject(RECOMMENDED_PROJECT_SLUG)!;
  const weeklyCount = mockProjects.filter((p) => p.isThisWeek).length;

  const hasEnrollment = Boolean(enrollment && enrollment.status !== 'none');

  return (
    <div>
      <div className="mb-6">
        <Entrance>
          <span className="eyebrow">Arena · Minggu {ARENA_WEEK}</span>
        </Entrance>
        <Entrance delay={0.08}>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[32px]">
            Side Hustle Arena
          </h1>
          <p className="mt-1 text-[14px] text-sk-muted">
            Kerjakan project nyata, kumpulkan feedback dan bukti skill.
          </p>
        </Entrance>
      </div>

      {/* State card */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        {!hasEnrollment && (
          <Card className="p-6 sm:p-7">
            <span className="eyebrow">Arena · Minggu ini</span>
            <h2 className="mb-1.5 mt-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">
              {weeklyCount} project minggu ini sudah tersedia.
            </h2>
            <p className="mb-5 text-[13px] text-sk-muted">
              Berdasarkan CV kamu, kami merekomendasikan project {recommended.category}.
            </p>
            <div className="mb-5 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash p-4.5 px-5">
              <Badge variant="recommended">Direkomendasikan</Badge>
              <div className="mt-2.5 text-[15px] font-bold text-sk-navy">{recommended.title}</div>
              <div className="mt-1 text-[12px] text-sk-muted">
                {recommended.category} · {recommended.difficulty} · {recommended.estimatedTime} · +{recommended.points} pts
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href={`/app/arena/workspace/${recommended.slug}`}>Pilih Project →</ButtonLink>
              <ButtonLink href="/app/arena/projects" variant="ghost" iconLeft={<LayoutGrid size={15} aria-hidden />}>
                Lihat Semua Project
              </ButtonLink>
            </div>
          </Card>
        )}

        {hasEnrollment && enrollment!.status === 'active' && (
          <div className="relative overflow-hidden rounded-[var(--radius-sk-2xl)] bg-gradient-to-br from-sk-navy-2 to-sk-blue p-6 text-white sm:p-7">
            <span aria-hidden className="pointer-events-none absolute -right-20 -top-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(80,180,255,0.25),transparent_70%)]" />
            <div className="relative z-[1]">
              <span className="eyebrow eyebrow-dark">Project Aktif</span>
              <h2 className="mb-3.5 mt-2.5 text-[20px] font-extrabold tracking-[-0.02em] sm:text-[24px]">
                {getProject(enrollment!.projectSlug)?.title}
              </h2>
              <ProgressBar
                value={60}
                animate={false}
                className="max-w-[320px] bg-white/20"
                barClassName="bg-gradient-to-r from-[#5ae0a0] to-[#8ab2ff]"
              />
              <div className="mb-4 mt-2 font-mono text-[11px] tracking-[0.08em] text-white/75">
                60% · STEP 3 · DO THE WORK
              </div>
              <div className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-[#ffd191]">
                <CalendarClock size={13} aria-hidden /> DEADLINE {ARENA_DEADLINE.toUpperCase()}
              </div>
              <ButtonLink href={`/app/arena/workspace/${enrollment!.projectSlug}`} variant="white">
                Lanjutkan Project →
              </ButtonLink>
            </div>
          </div>
        )}

        {hasEnrollment && (enrollment!.status === 'submitted' || enrollment!.status === 'under_review') && (
          <Card className="p-6 sm:p-7">
            <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[var(--radius-sk-lg)] bg-sk-success-tint text-sk-success">
              <Check size={26} strokeWidth={2.5} aria-hidden />
            </div>
            <span className="eyebrow">Submitted</span>
            <h2 className="mb-1.5 mt-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">
              Project berhasil dikirim.
            </h2>
            <p className="mb-4 text-[13px] leading-relaxed text-sk-muted">
              Submission kamu sedang dalam proses review. Feedback akan tersedia dalam 1–2 hari.
            </p>
            <div className="mb-5 flex flex-wrap gap-2">
              <StatusBadge status={enrollment!.status} />
            </div>
            <ButtonLink href={`/app/arena/submission/${enrollment!.projectSlug}`} variant="ghost">
              Lihat Submission
            </ButtonLink>
          </Card>
        )}

        {hasEnrollment && enrollment!.status === 'review_ready' && (
          <div className="rounded-[var(--radius-sk-2xl)] border border-sk-blue-tint-border bg-gradient-to-br from-[#F4F8FF] to-white p-6 sm:p-7">
            <Badge variant="recommended">Feedback siap</Badge>
            <h2 className="mb-1.5 mt-3 text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">
              Feedback kamu sudah tersedia.
            </h2>
            <p className="mb-5 text-[13px] leading-relaxed text-sk-muted">
              Kamu dapat skor <b className="text-sk-navy">{enrollment!.review?.score} / 100</b> —{' '}
              {enrollment!.review?.statusLabel.toLowerCase()}.
            </p>
            <ButtonLink href={`/app/arena/result/${enrollment!.projectSlug}`}>Lihat Result →</ButtonLink>
          </div>
        )}

        {hasEnrollment && enrollment!.status === 'completed' && (
          <Card className="p-6 sm:p-7">
            <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[var(--radius-sk-lg)] bg-sk-success-tint text-sk-success">
              <Trophy size={24} strokeWidth={2} aria-hidden />
            </div>
            <span className="eyebrow">Completed</span>
            <h2 className="mb-1.5 mt-2.5 text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">
              Project selesai — skill terbukti.
            </h2>
            <p className="mb-5 text-[13px] leading-relaxed text-sk-muted">
              Bukti skill dan poin sudah masuk Career Report kamu. Lanjut ke project berikutnya untuk menjaga momentum.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/app/career-report">Buka Career Report →</ButtonLink>
              <ButtonLink href="/app/arena/projects" variant="ghost" iconLeft={<LayoutGrid size={15} aria-hidden />}>
                Cari Project Berikutnya
              </ButtonLink>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Week stats */}
      <div className="mb-3.5 mt-9 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
        Minggu {ARENA_WEEK}
      </div>
      <Reveal>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ARENA_STATS.map((s) => (
            <StatCard key={s.key} label={s.label} value={s.value} small={s.small} />
          ))}
        </div>
      </Reveal>

      {/* Shortcut row */}
      <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sk-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sk-blue-tint text-sk-blue">
            <ClipboardList size={18} aria-hidden />
          </span>
          <div>
            <div className="text-[14px] font-bold text-sk-navy">Cara penilaian bekerja</div>
            <div className="text-[12px] text-sk-muted">Rubrik 4 kriteria × 25 poin, transparan untuk semua project.</div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sk-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sk-blue-tint text-sk-blue">
            <Trophy size={18} aria-hidden />
          </span>
          <div>
            <div className="text-[14px] font-bold text-sk-navy">Weekly Spotlight</div>
            <div className="text-[12px] text-sk-muted">Lihat project terbaik minggu ini dan prosesnya.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
