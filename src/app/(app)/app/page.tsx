'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarClock, Check, FileText, Sparkles, Target, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { CountUp } from '@/components/motion/CountUp';
import { Entrance, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { StatusBadge, WORKSPACE_STEP_LABELS } from '@/components/primitives/StatusBadge';
import { useDemo } from '@/features/demo/store';
import { buildCareerReport } from '@/features/demo/report';
import { DEMO_GREETING_TIME, DEMO_USER } from '@/data/mock/user';
import { ARENA_DEADLINE } from '@/data/mock/arena';
import { NEXT_PROJECT_SLUG, RECOMMENDED_PROJECT_SLUG, getProject } from '@/data/mock/projects';

const STEPS = ['brief', 'plan', 'work', 'review', 'submit'] as const;

function formatDateToday() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CareerHomePage() {
  const reduce = useReducedMotion();
  const { state, snapshot, dispatch } = useDemo();
  const enrollment = state.enrollment;
  const user = state.user ?? DEMO_USER;

  const stepIndex = enrollment ? STEPS.indexOf(enrollment.workspaceStep) : 0;
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const recommended = getProject(RECOMMENDED_PROJECT_SLUG)!;
  const report = buildCareerReport(state);
  const nextProject = getProject(NEXT_PROJECT_SLUG)!;

  /* ---------- Best card per demo state ---------- */
  let bestCard: React.ReactNode;

  if (state.cvScan.status !== 'completed') {
    bestCard = (
      <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-[#0B1933] via-[#1a2f5a] to-sk-blue p-7 text-white sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-40 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(80,180,255,0.22),transparent_70%)]" />
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[480px]">
            <span className="eyebrow eyebrow-dark">Mulai Dari Sini</span>
            <h3 className="mb-2 mt-2.5 text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]">
              Scan CV kamu dulu.
            </h3>
            <p className="mb-6 text-[13.5px] leading-relaxed text-white/75">
              Career Report, rekomendasi project, dan bukti skill semuanya mulai dari satu CV scan. Gratis, 20–30 detik.
            </p>
            <ButtonLink href="/app/cv-scanner" variant="white">
              Scan CV Sekarang →
            </ButtonLink>
          </div>
          <div className="hidden rounded-[var(--radius-sk-xl)] border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:block">
            <div className="font-mono text-[10px] tracking-[0.15em] text-white/65">YANG KAMU DAPAT</div>
            <ul className="mt-3 flex flex-col gap-2 text-[12.5px] text-white/85">
              <li className="flex items-center gap-2"><Check size={13} aria-hidden className="text-[#5ae0a0]" /> CV Score + 4 metrik</li>
              <li className="flex items-center gap-2"><Check size={13} aria-hidden className="text-[#5ae0a0]" /> Career Evidence per skill</li>
              <li className="flex items-center gap-2"><Check size={13} aria-hidden className="text-[#5ae0a0]" /> Rekomendasi project minggu ini</li>
            </ul>
          </div>
        </div>
      </div>
    );
  } else if (!enrollment || enrollment.status === 'none') {
    bestCard = (
      <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-blue via-[#3b7dff] to-[#5c93ff] p-7 text-white sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-40 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)]" />
        <div className="relative z-[1]">
          <span className="eyebrow eyebrow-dark">Langkah Terbaik Selanjutnya</span>
          <h3 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] sm:text-[30px]">
            Bangun bukti skill {recommended.category}.
          </h3>
          <p className="mb-6 max-w-[520px] text-[13.5px] leading-relaxed text-white/85">
            CV kamu menyebut skill ini, tapi belum ada project yang membuktikannya. Ambil satu project minggu ini di Arena.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink
              href={`/app/arena/workspace/${recommended.slug}`}
              onClick={() => dispatch({ type: 'ENROLL', projectSlug: recommended.slug })}
              variant="white"
            >
              Pilih Project Ini →
            </ButtonLink>
            <ButtonLink href="/app/arena/projects" variant="ghostOnDark">
              Lihat Project Lain
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  } else if (enrollment.status === 'active') {
    const project = getProject(enrollment.projectSlug)!;
    bestCard = (
      <div className="best-card">
        <div className="relative z-[1]">
          <span className="eyebrow eyebrow-dark">Lanjutkan Project Minggu Ini</span>
          <h3 className="mb-2 mt-2 max-w-[440px] text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[32px]">
            {project.title}
          </h3>
          <p className="mb-5 max-w-[440px] text-[13.5px] leading-relaxed text-white/75">
            Kamu di step &ldquo;{WORKSPACE_STEP_LABELS[enrollment.workspaceStep]}&rdquo;.{' '}
            {enrollment.workspaceStep === 'work'
              ? 'Selesaikan deliverables utama sebelum lanjut ke review.'
              : enrollment.workspaceStep === 'review'
                ? 'Tuntaskan checklist sebelum submit.'
                : 'Selesaikan step ini untuk lanjut.'}
          </p>
          <div className="mb-[18px] flex items-center gap-3.5">
            <div className="h-1.5 max-w-[280px] flex-1 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#5ae0a0] to-[#8ab2ff]"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="font-mono text-[11px] tracking-[0.1em] text-white/85">
              {progress}% · STEP {stepIndex + 1} / 5
            </span>
          </div>
          <div className="mb-5 flex items-center gap-2 font-mono text-[11.5px] text-[#ffd191]">
            <CalendarClock size={13} aria-hidden />
            Deadline · {ARENA_DEADLINE} · Jumat minggu ini
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/app/arena/workspace/${project.slug}`} variant="white">
              Lanjutkan Project →
            </ButtonLink>
            <ButtonLink href={`/app/arena/projects/${project.slug}`} variant="ghostOnDark">
              Lihat Brief
            </ButtonLink>
          </div>
        </div>
        <div className="side-mini">
          <div className="font-mono text-[10px] tracking-[0.15em] text-white/65">PROJECT STEPS</div>
          <div className="mb-3 mt-2 text-[18px] font-bold">{WORKSPACE_STEP_LABELS[enrollment.workspaceStep]}</div>
          <ol className="flex flex-col gap-2.5">
            {STEPS.map((step, i) => {
              const done = i < stepIndex;
              const now = i === stepIndex;
              return (
                <li
                  key={step}
                  className={
                    done
                      ? 'flex items-center gap-2.5 text-[12.5px] text-white'
                      : now
                        ? 'flex items-center gap-2.5 text-[12.5px] text-white'
                        : 'flex items-center gap-2.5 text-[12.5px] text-white/55'
                  }
                >
                  <span
                    className={
                      done
                        ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#5ae0a0] text-[10px] font-bold text-sk-navy-2'
                        : now
                          ? 'flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-sk-blue shadow-[0_0_0_3px_rgba(255,255,255,0.25)]'
                          : 'flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white/60'
                    }
                    aria-hidden
                  >
                    {done ? <Check size={11} strokeWidth={3.5} /> : i + 1}
                  </span>
                  {WORKSPACE_STEP_LABELS[step]}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    );
  } else if (enrollment.status === 'submitted' || enrollment.status === 'under_review') {
    bestCard = (
      <Card className="p-7 sm:p-8">
        <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[var(--radius-sk-lg)] bg-sk-success-tint text-[24px] text-sk-success">
          <Check size={26} strokeWidth={2.5} aria-hidden />
        </div>
        <span className="eyebrow">Submitted</span>
        <h3 className="mb-2 mt-2 text-[22px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[26px]">
          Project berhasil dikirim.
        </h3>
        <p className="mb-4 text-[13px] leading-relaxed text-sk-muted">
          Submission kamu sedang dalam proses review. Feedback akan tersedia dalam 1–2 hari.
        </p>
        <div className="mb-5 flex flex-wrap gap-2">
          <StatusBadge status={enrollment.status} />
          <Badge variant="slate">
            Submitted ·{' '}
            {new Date(enrollment.submission!.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </Badge>
        </div>
        <ButtonLink href={`/app/arena/submission/${enrollment.projectSlug}`} variant="ghost">
          Lihat Submission
        </ButtonLink>
      </Card>
    );
  } else if (enrollment.status === 'review_ready') {
    bestCard = (
      <div className="rounded-[var(--radius-sk-2xl)] border border-sk-blue-tint-border bg-gradient-to-br from-[#F4F8FF] to-white p-7 sm:p-8">
        <Badge variant="recommended">Feedback siap</Badge>
        <h3 className="mb-2 mt-3.5 text-[22px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[26px]">
          Feedback kamu sudah tersedia.
        </h3>
        <p className="mb-5 text-[13px] leading-relaxed text-sk-muted">
          Kamu dapat skor <b className="text-sk-navy">{enrollment.review!.score} / 100</b> —{' '}
          {enrollment.review!.statusLabel.toLowerCase()}. Ada{' '}
          {enrollment.review!.strengths.length} area kekuatan dan {enrollment.review!.improvements.length} area yang bisa
          ditingkatkan.
        </p>
        <ButtonLink href={`/app/arena/result/${enrollment.projectSlug}`}>Lihat Result →</ButtonLink>
      </div>
    );
  } else {
    // completed
    bestCard = (
      <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-[#0B1933] via-[#1a2f5a] to-sk-blue p-7 text-white sm:p-8">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-40 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(90,224,160,0.2),transparent_70%)]" />
        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[500px]">
            <span className="eyebrow eyebrow-dark">Project Selesai</span>
            <h3 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] sm:text-[30px]">
              Bukti skill baru sudah masuk Career Report.
            </h3>
            <p className="mb-6 text-[13.5px] leading-relaxed text-white/75">
              Lihat perkembangan skill kamu, lalu lanjut ke rekomendasi project berikutnya untuk menjaga momentum.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/app/career-report" variant="white">
                Lihat Career Report →
              </ButtonLink>
              <ButtonLink href={`/app/arena/result/${enrollment.projectSlug}`} variant="ghostOnDark">
                Lihat Feedback Terakhir
              </ButtonLink>
            </div>
          </div>
          <div className="hidden rounded-[var(--radius-sk-xl)] border border-white/15 bg-white/10 p-5 text-center backdrop-blur-md sm:block">
            <Trophy size={22} className="mx-auto mb-2 text-[#ffd191]" aria-hidden />
            <div className="text-[28px] font-extrabold tracking-[-0.02em]">+{enrollment.review?.pointsEarned ?? 0}</div>
            <div className="font-mono text-[9.5px] tracking-[0.15em] text-white/65">CAREER POINTS</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-7">
        <Entrance>
          <span className="eyebrow">Career Home</span>
        </Entrance>
        <Entrance delay={0.08}>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[32px]">
            {DEMO_GREETING_TIME}, {user.name} <span aria-hidden>👋</span>
          </h1>
        </Entrance>
        <Entrance delay={0.16}>
          <p className="mt-1 text-[14px] text-sk-muted">
            {formatDateToday()}
            {' · '}
            {enrollment?.status === 'active'
              ? 'Kamu punya 1 project aktif minggu ini.'
              : enrollment?.status === 'review_ready'
                ? 'Feedback baru tersedia untuk kamu.'
                : state.cvScan.status !== 'completed'
                  ? 'Mulai dengan scan CV — gratis, 5 menit.'
                  : 'Satu langkah kecil hari ini, bukti skill besar nanti.'}
          </p>
        </Entrance>
      </div>

      {/* Primary next action */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        {bestCard}
      </motion.div>

      {/* Career snapshot */}
      <div className="mb-3.5 mt-9 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
        Career Snapshot
      </div>
      <StaggerGroup className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StaggerItem>
          <Card className="p-5">
            <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">CV SCORE</div>
            <div className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy">
              {snapshot.cvScore !== null ? (
                <CountUp to={snapshot.cvScore} />
              ) : (
                <span className="text-sk-faint">—</span>
              )}
              <small className="ml-1 text-[13px] font-semibold text-sk-muted">/100</small>
            </div>
            <div className="mt-1 text-[11px] font-semibold text-sk-success">
              {snapshot.cvScore !== null ? '↑ +6 sejak scan pertama' : 'Belum scan'}
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-5">
            <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">PROJECTS COMPLETED</div>
            <div className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy">
              <CountUp to={snapshot.projectsCompleted} />
            </div>
            <div className="mt-1 text-[11px] font-semibold text-sk-body">
              {enrollment?.status === 'active' ? '1 aktif' : 'Mulai satu minggu ini'}
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-5">
            <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">SKILLS PROVEN</div>
            <div className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy">
              <CountUp to={snapshot.skillsProven.length} />
            </div>
            <div className="mt-1 flex flex-wrap gap-1 pt-0.5">
              {snapshot.skillsProven.slice(0, 3).map((s) => (
                <span key={s} className="rounded bg-sk-blue-tint px-1.5 py-0.5 font-mono text-[9.5px] text-sk-blue">
                  {s}
                </span>
              ))}
              {snapshot.skillsProven.length > 3 && (
                <span className="rounded bg-sk-track px-1.5 py-0.5 font-mono text-[9.5px] text-sk-muted">
                  +{snapshot.skillsProven.length - 3}
                </span>
              )}
            </div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-5">
            <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">CAREER POINTS</div>
            <div className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy">
              <CountUp to={snapshot.careerPoints} />
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sk-body">
              <Sparkles size={11} className="text-sk-violet" aria-hidden />
              {snapshot.level}
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>

      {/* Secondary: next up loop teaser (only when a project was just completed) */}
      {enrollment?.status === 'completed' && (
        <div className="mt-9">
          <div className="mb-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
            Setelah Ini
          </div>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-sk-muted">Rekomendasi berikutnya</div>
              <h4 className="mt-1 text-[17px] font-bold text-sk-navy">{nextProject.title}</h4>
              <p className="mt-1 max-w-[520px] text-[12.5px] text-sk-muted">{report.nextProjectReason}</p>
            </div>
            <ButtonLink href={`/app/arena/projects/${nextProject.slug}`} iconRight={<ArrowRight size={15} aria-hidden />}>
              Lihat Project
            </ButtonLink>
          </Card>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-9 grid gap-3.5 sm:grid-cols-3">
        {[
          { href: '/app/cv-scanner', label: 'Scan CV', desc: 'Perbarui analisis CV kamu', Icon: FileText },
          { href: '/app/arena', label: 'Side Hustle Arena', desc: 'Project & submission kamu', Icon: Zap },
          { href: '/app/jobs', label: 'Jobs', desc: 'Lowongan yang match profilmu', Icon: Target },
        ].map(({ href, label, desc, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-sk-blue/40 hover:shadow-sk-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sk-blue-tint text-sk-blue">
              <Icon size={18} aria-hidden />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-sk-navy">{label}</span>
              <span className="block text-[12px] text-sk-muted">{desc}</span>
            </span>
            <ArrowRight size={15} aria-hidden className="ml-auto shrink-0 text-sk-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-sk-blue" />
          </Link>
        ))}
      </div>
    </div>
  );
}
