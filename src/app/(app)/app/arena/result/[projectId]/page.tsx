'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { CountUp } from '@/components/motion/CountUp';
import { Entrance } from '@/components/motion/Reveal';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import { useDemo } from '@/features/demo/store';
import { getProject } from '@/data/mock/projects';
import { DEMO_USER } from '@/data/mock/user';

export default function ProjectResultPage() {
  const params = useParams<{ projectId: string }>();
  const reduce = useReducedMotion();
  const { state, dispatch } = useDemo();
  const [counted, setCounted] = useState(false);

  const enrollment = state.enrollment;
  const belongsHere = Boolean(enrollment && enrollment.projectSlug === params.projectId);
  const review = belongsHere ? enrollment!.review : null;

  // Opening the result marks the project as completed (loop closes).
  useEffect(() => {
    if (belongsHere && review && enrollment!.status !== 'completed') {
      dispatch({ type: 'COMPLETE_PROJECT' });
    }
  }, [belongsHere, review, enrollment?.status, dispatch]);

  useEffect(() => {
    if (review) {
      const t = window.setTimeout(() => setCounted(true), reduce ? 0 : 250);
      return () => window.clearTimeout(t);
    }
  }, [review, reduce]);

  if (!belongsHere || !review) {
    return (
      <ErrorState
        title="Feedback belum tersedia."
        description="Kamu belum punya hasil review untuk project ini. Selesaikan workspace dan submit dulu — feedback muncul otomatis setelah review selesai."
        primaryAction={{ label: 'Buka Arena', href: '/app/arena' }}
        secondaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
      />
    );
  }

  const project = getProject(enrollment!.projectSlug)!;
  const user = state.user ?? DEMO_USER;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'App', href: '/app' },
          { label: 'Arena', href: '/app/arena' },
          { label: 'Submission', href: `/app/arena/submission/${project.slug}` },
          { label: 'Result' },
        ]}
      />

      {/* Reward hero */}
      <Entrance className="mt-5">
        <div className="relative overflow-hidden rounded-[var(--radius-sk-4xl)] bg-gradient-to-br from-sk-navy via-sk-navy-2 to-sk-navy-4 p-8 text-white sm:p-11">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-52 -top-[280px] h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(90,224,160,0.2),transparent_65%)]"
          />
          <div className="relative z-[1] grid items-center gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              <span className="eyebrow eyebrow-dark">Project Result</span>
              <h1 className="mb-2.5 mt-3 text-[32px] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[44px]">
                Great work, {user.name}.
              </h1>
              <p className="mb-5 max-w-[520px] text-[14.5px] leading-relaxed text-white/75">{review.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="recommended">{review.statusLabel}</Badge>
                <Badge variant="dark">
                  {project.category} · Week {project.week}
                </Badge>
              </div>
            </div>
            <div className="rounded-[var(--radius-sk-2xl)] border border-white/15 bg-white/10 p-6 text-center backdrop-blur-md">
              <motion.div
                initial={reduce ? false : { scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
                className="text-[88px] font-extrabold leading-none tracking-[-0.05em] sm:text-[100px]"
                style={{
                  background: 'linear-gradient(180deg,#fff,#8ab2ff)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <CountUp to={review.score} />
              </motion.div>
              <div className="mt-2 font-mono text-[14px] text-white/60">/ 100</div>
              <div className="mt-2.5 text-[13px] font-bold tracking-[0.05em] text-[#5ae0a0]">{review.statusLabel}</div>
            </div>
          </div>
        </div>
      </Entrance>

      {/* Rubric breakdown */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        className="mb-7 mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {review.rubric.map((r, i) => (
          <Card key={r.label} className="p-5">
            <div className="mb-2 font-mono text-[10px] tracking-[0.1em] text-sk-muted">{r.label.toUpperCase()}</div>
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[30px] font-extrabold tracking-[-0.02em] text-sk-navy">
                {counted ? <CountUp to={r.score} duration={0.7} /> : 0}
              </span>
              <span className="font-mono text-[12px] text-sk-muted">/{r.max}</span>
            </div>
            <ProgressBar
              value={(r.score / r.max) * 100}
              delay={0.3 + i * 0.1}
              barClassName="bg-gradient-to-r from-sk-blue to-sk-mint"
            />
          </Card>
        ))}
      </motion.div>

      {/* Feedback panels */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        className="mb-7 grid gap-5 md:grid-cols-2"
      >
        <Card className="p-6">
          <PanelHeading pin="g">Kekuatan</PanelHeading>
          <ul className="flex flex-col gap-3">
            {review.strengths.map((s, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-sk-text">
                <span aria-hidden className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-sk-success-tint text-sk-success">
                  <Check size={12} strokeWidth={3} />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <PanelHeading pin="a">Perlu ditingkatkan</PanelHeading>
          <ul className="flex flex-col gap-3">
            {review.improvements.map((s, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-sk-text">
                <span aria-hidden className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-sk-warning-wash text-sk-warning-ink">
                  <TriangleAlert size={11} strokeWidth={2.4} />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

      {/* Skills proven + points */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
        className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-sk-2xl)] border border-sk-blue-tint-border bg-gradient-to-br from-[#F4F8FF] to-white p-7 sm:p-8"
      >
        <div>
          <div className="mb-4 font-mono text-[11px] tracking-[0.15em] text-sk-blue">SKILLS PROVEN</div>
          <div className="flex flex-wrap gap-2.5">
            {review.skillsProven.map((skill, i) => (
              <motion.span
                key={skill}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.5 + i * 0.12, ease: 'easeOut' }}
                className="inline-flex items-center gap-2 rounded-full border border-sk-blue-tint-border bg-white px-4 py-2.5 text-[13px] font-semibold text-sk-navy shadow-sm"
              >
                <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-sk-success text-white">
                  <Check size={11} strokeWidth={3.5} />
                </span>
                {skill}
              </motion.span>
            ))}
          </div>
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.85, ease: 'easeOut' }}
          className="text-right"
        >
          <div className="text-[36px] font-extrabold leading-none tracking-[-0.02em] text-sk-blue">+{review.pointsEarned}</div>
          <div className="mt-1 font-mono text-[11px] tracking-[0.1em] text-sk-muted">CAREER POINTS</div>
        </motion.div>
      </motion.div>

      {/* Close the loop */}
      <div className="flex flex-wrap justify-end gap-3">
        <ButtonLink href="/app/arena/projects" variant="ghost">
          Lihat Project Berikutnya
        </ButtonLink>
        <ButtonLink href="/app/career-report">
          Lihat Career Report <ArrowRight size={15} aria-hidden />
        </ButtonLink>
      </div>
    </div>
  );
}
