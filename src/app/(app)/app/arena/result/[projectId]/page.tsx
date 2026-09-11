'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { deadlinePhrase } from '@/lib/deadline';
import { Check, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { CountUp } from '@/components/motion/CountUp';
import { Entrance } from '@/components/motion/Reveal';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { ErrorState } from '@/components/states/ErrorState';
import {
  ArenaApiError,
  getMyEnrollmentForProject,
  getResult,
  getVisibleProjectDetail,
  type ArenaResult,
} from '@/lib/arena-client';

type Ranked = Extract<ArenaResult, { ranked: true }>;
type Sealed = Extract<ArenaResult, { sealed: true }>;

export default function ProjectResultPage() {
  const params = useParams<{ projectId: string }>();
  const reduce = useSettledReducedMotion();
  const [boot, setBoot] = useState<'loading' | 'ready' | 'sealed' | 'unranked' | 'missing' | 'expired' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [result, setResult] = useState<Ranked | null>(null);
  const [sealed, setSealed] = useState<Sealed | null>(null);
  const [projectCategory, setProjectCategory] = useState('');
  const [deadlineIso, setDeadlineIso] = useState<string | null>(null);
  const [counted, setCounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getVisibleProjectDetail(params.projectId);
        const enrollment = await getMyEnrollmentForProject(detail.id, detail.slug);
        if (cancelled) return;
        if (!enrollment) {
          setBoot('missing');
          return;
        }
        const res = await getResult(enrollment.enrollmentId);
        if (cancelled) return;
        setProjectCategory(detail.division.name);
        // This project's week: an ad-hoc week does not finalise on a Friday.
        setDeadlineIso(detail.week?.submissionDeadlineAt ?? null);
        if (res.sealed) {
          setSealed(res);
          setBoot('sealed');
        } else if (!res.finalized || !res.ranked) {
          setBoot('unranked');
        } else {
          setResult(res);
          setBoot('ready');
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ArenaApiError && (err.code === 'PROJECT_NOT_FOUND' || err.code === 'PROJECT_NOT_PUBLISHED')) {
          setBoot('missing');
        } else if (err instanceof ArenaApiError && err.status === 401) {
          setBoot('expired');
        } else {
          setBootError(err instanceof ArenaApiError ? err.message : 'Coba muat ulang halaman ini.');
          setBoot('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.projectId]);

  useEffect(() => {
    if (boot === 'ready') {
      const t = window.setTimeout(() => setCounted(true), reduce ? 0 : 250);
      return () => window.clearTimeout(t);
    }
  }, [boot, reduce]);

  if (boot === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
        <span className="h-8 w-8 rounded-full border-[3px] border-sk-blue-tint border-t-sk-blue anim-spin" />
      </div>
    );
  }

  if (boot === 'sealed') {
    return (
      <div>
        <Breadcrumb
          items={[
            { label: 'App', href: '/app' },
            { label: 'Arena', href: '/app/arena' },
            { label: 'Submission', href: `/app/arena/submission/${params.projectId}` },
            { label: 'Result' },
          ]}
        />
        <Card className="mt-5 p-7 sm:p-9">
          <span className="eyebrow">Disegel sampai finalisasi</span>
          <h1 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[32px]">
            Feedback belum bisa dibuka.
          </h1>
          <p className="mb-6 max-w-[560px] text-[14px] leading-relaxed text-sk-muted">
            Reviewer mungkin sudah menilai, tapi skor dikunci {deadlinePhrase(deadlineIso, 'sampai finalisasi minggu ini')} biar
            adil buat semua peserta. Jatah review kepakai {sealed?.reviewAttemptsUsed ?? 0}/3.
          </p>
          <div className="mb-7 flex flex-wrap gap-2">
            <Badge variant="slate">{(sealed?.submissionStatus ?? 'DRAFT').replace(/_/g, ' ')}</Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/app/arena/submission/${params.projectId}`} variant="ghost">
              Lihat Submission
            </ButtonLink>
            <ButtonLink href="/app/arena" variant="ghost">
              Kembali ke Arena
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  if (boot === 'unranked') {
    return (
      <ErrorState
        title="Belum ada hasil final."
        description="Week ini sudah difinalisasi tapi submission kamu tidak masuk peringkat (tidak submit, tidak lolos syarat, atau dibatalkan). Coba lagi minggu depan."
        primaryAction={{ label: 'Buka Arena', href: '/app/arena' }}
        secondaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
      />
    );
  }

  if (boot === 'missing') {
    return (
      <ErrorState
        title="Feedback belum tersedia."
        description="Kamu belum punya hasil review untuk project ini. Selesaikan workspace dan submit dulu."
        primaryAction={{ label: 'Buka Arena', href: '/app/arena' }}
        secondaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
      />
    );
  }

  if (boot === 'expired') {
    return (
      <ErrorState
        title="Sesi berakhir."
        description="Login ulang untuk melihat hasil kamu."
        primaryAction={{ label: 'Login', href: '/login' }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  if (boot === 'error' || !result) {
    return (
      <ErrorState
        title="Hasil gagal dimuat."
        description={bootError ?? 'Coba muat ulang halaman ini.'}
        primaryAction={{ label: 'Muat Ulang', href: `/app/arena/result/${params.projectId}` }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'App', href: '/app' },
          { label: 'Arena', href: '/app/arena' },
          { label: 'Submission', href: `/app/arena/submission/${params.projectId}` },
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
                Great work.
              </h1>
              <p className="mb-5 max-w-[520px] text-[14.5px] leading-relaxed text-white/75">{result.summary ?? ''}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="recommended">Peringkat #{result.rank}</Badge>
                <Badge variant="dark">
                  {projectCategory} · {result.weekCode}
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
                <CountUp to={Math.round(result.finalScore)} />
              </motion.div>
              <div className="mt-2 font-mono text-[14px] text-white/60">/ 100</div>
              <div className="mt-2.5 text-[13px] font-bold tracking-[0.05em] text-[#5ae0a0]">Peringkat #{result.rank}</div>
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
        {result.rubric.map((r, i) => (
          <Card key={r.label} className="p-5">
            <div className="mb-2 font-mono text-[10px] tracking-[0.1em] text-sk-muted">{r.label.toUpperCase()}</div>
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[30px] font-extrabold tracking-[-0.02em] text-sk-navy">
                {counted ? <CountUp to={Math.round(r.score)} duration={0.7} /> : 0}
              </span>
              <span className="font-mono text-[12px] text-sk-muted">/{Math.round(r.max)}</span>
            </div>
            <ProgressBar
              value={r.max > 0 ? (r.score / r.max) * 100 : 0}
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
            {result.strengths.map((s, i) => (
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
            {result.improvements.map((s, i) => (
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
            {result.skillsProven.map((skill, i) => (
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
          <div className="text-[36px] font-extrabold leading-none tracking-[-0.02em] text-sk-blue">+{result.pointsAwarded}</div>
          <div className="mt-1 font-mono text-[11px] tracking-[0.1em] text-sk-muted">CAREER POINTS</div>
        </motion.div>
      </motion.div>

      {/* Close the loop */}
      <div className="flex flex-wrap justify-end gap-3">
        <ButtonLink href="/app/arena/projects" variant="ghost">
          Lihat Project Berikutnya
        </ButtonLink>
        <ButtonLink href="/app/career-report">
          Lihat Career Report
        </ButtonLink>
      </div>
    </div>
  );
}
