'use client';

import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, MapPin, Target } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { CountUp } from '@/components/motion/CountUp';
import { Entrance, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { useDemo } from '@/features/demo/store';
import { JOBS_PORTAL_URL, MOCK_JOB_MATCHES } from '@/data/mock/jobs';

export default function JobsPage() {
  const reduce = useReducedMotion();
  const { snapshot } = useDemo();
  const top = MOCK_JOB_MATCHES[0];

  return (
    <div>
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Jobs' }]} />

      {/* Bridge hero (design 15b) */}
      <Entrance className="mt-5">
        <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-navy-2 to-sk-navy-4 p-8 text-white sm:p-10">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-36 -top-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(90,224,160,0.25),transparent_65%)]"
          />
          <div className="relative z-[1]">
            <span className="eyebrow eyebrow-dark">Career-Ready</span>
            <h1 className="mb-2.5 mt-3 max-w-[520px] text-[28px] font-extrabold tracking-[-0.02em] sm:text-[38px]">
              Kamu siap mencari peluang.
            </h1>
            <p className="mb-7 max-w-[460px] text-[14px] leading-relaxed text-white/80">
              Berdasarkan CV, project, dan skill kamu, kami menemukan lowongan yang match dengan profilmu. Jobs terhubung
              langsung dengan portal Sekolah Karir.
            </p>

            <div className="mb-7 grid max-w-[560px] grid-cols-3 gap-2.5">
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[9.5px] tracking-[0.15em] text-white/65">MATCHES</div>
                <div className="mt-1.5 text-[26px] font-extrabold tracking-[-0.02em]">
                  <CountUp to={24} />
                </div>
              </div>
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[9.5px] tracking-[0.15em] text-white/65">TOP FIT</div>
                <div className="mt-2 text-[13.5px] font-bold leading-snug">
                  {top.title} · {top.location}
                </div>
              </div>
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[9.5px] tracking-[0.15em] text-white/65">MATCH SCORE</div>
                <div className="mt-1.5 text-[26px] font-extrabold tracking-[-0.02em] text-[#5ae0a0]">
                  <CountUp to={top.matchScore} suffix="%" />
                </div>
              </div>
            </div>

            <ButtonLink href={JOBS_PORTAL_URL} target="_blank" rel="noopener noreferrer" variant="white">
              Lihat Lowongan yang Cocok →
            </ButtonLink>
            <p className="mt-3 font-mono text-[10.5px] tracking-[0.08em] text-white/55">
              Membuka jobs.sekolahkarir.id di tab baru
            </p>
          </div>
        </div>
      </Entrance>

      {/* Recommended opportunities preview */}
      <div className="mb-4 mt-9 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">Rekomendasi untukmu</h2>
          <p className="mt-1 text-[13px] text-sk-muted">
            Dipersonalisasi dari CV score kamu {snapshot.cvScore ?? '—'} dan skill yang sudah terbukti.
          </p>
        </div>
        <Badge variant="slate">PREVIEW · PORTAL PENUH DI JOBS.SEKOLAHKARIR.ID</Badge>
      </div>

      <StaggerGroup className="grid gap-4 md:grid-cols-2">
        {MOCK_JOB_MATCHES.map((job) => (
          <StaggerItem key={job.id}>
            <Card className="flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-sk-blue/40 hover:shadow-sk-md">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[15.5px] font-bold text-sk-navy">{job.title}</h3>
                  <p className="mt-0.5 text-[12.5px] text-sk-muted">
                    {job.company} · <MapPin size={11} className="inline align-[-1px]" aria-hidden /> {job.location}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${
                    job.matchScore >= 80 ? 'bg-sk-success-tint text-sk-success' : 'bg-sk-blue-tint text-sk-blue'
                  }`}
                >
                  {job.matchScore}% match
                </span>
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <span key={s} className="rounded-md bg-sk-blue-wash px-2 py-1 font-mono text-[10.5px] text-sk-body">
                    {s}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-dashed border-sk-border pt-3.5">
                <Badge variant="slate">{job.type}</Badge>
                <a
                  href={JOBS_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-sk-blue transition-colors hover:text-sk-blue-700"
                >
                  Detail lowongan <ArrowUpRight size={13} aria-hidden />
                </a>
              </div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mt-8 flex items-start gap-3 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-sk-muted"
      >
        <Target size={15} className="mt-0.5 shrink-0 text-sk-blue" aria-hidden />
        <span>
          Ini halaman jembatan demo — seluruh daftar lowongan, filter, dan lamaran ada di portal Jobs produksi. Frontend ini
          tidak mengubah atau meng-hosting portal tersebut.
        </span>
      </motion.div>
    </div>
  );
}
