'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BarChart3, Coins, Crown, Gift, Quote } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { RewardIcon } from '@/components/arena/MilestoneRoadmap';
import { CountUp } from '@/components/arena/dashboard/CountUp';
import { useSettledReducedMotion } from '@/components/motion/Reveal';
import { RefreshButton, ResourceState, participantDate } from '@/components/arena/ParticipantDashboard';
import {
  POINTS_CHANGED_EVENT,
  getParticipantMilestones,
  getParticipantOverview,
  getParticipantPoints,
  getRewardCatalog,
  takeParticipantReward,
  useParticipantResource,
  type MilestoneStep,
} from '@/lib/participant-client';
import { formatPoints } from '@/lib/reward-progress';
import { isStoreEnabled } from '@/lib/store-flags';
import { RewardCatalog } from './RewardCatalog';
import { RewardLadder } from './RewardLadder';
import { PointActivityList } from './PointActivityList';
import { cn } from '@/lib/cn';

const STATUS_LABEL: Record<string, string> = { PENDING: 'Menunggu', PROCESSING: 'Diproses', FULFILLED: 'Selesai', FAILED: 'Gagal', ADMIN_REVERSED: 'Dikembalikan' };

function Section({ id, title, subtitle, action, children, delay = 0 }: { id: string; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; delay?: number }) {
  const reduce = useSettledReducedMotion();
  return (
    <motion.section
      aria-labelledby={id}
      className="mt-10 scroll-mt-24"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay }}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={id} className="text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] text-sk-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const reduce = useSettledReducedMotion();
  const percent = total ? Math.round((value / total) * 100) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid h-16 w-16 shrink-0 place-items-center" role="img" aria-label={`${percent} persen hadiah sudah diklaim`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-sk-track)" strokeWidth="7" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#reward-ring)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - percent / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        />
        <defs>
          <linearGradient id="reward-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8a6bfc" />
            <stop offset="1" stopColor="#246bfd" />
          </linearGradient>
        </defs>
      </svg>
      <span aria-hidden className="relative font-mono text-[13px] font-bold text-sk-navy">{percent}%</span>
    </span>
  );
}

/** The spotlight beside the ladder: the one reward to go for (or take) next. */
function NextRewardCard({
  step,
  description,
  lifetime,
  balance,
  pending,
  onClaim,
}: {
  step: MilestoneStep | null;
  description: string | null;
  lifetime: number;
  balance: number;
  pending: string | null;
  onClaim: (slug: string, retryOf: string | null) => void;
}) {
  const reduce = useSettledReducedMotion();
  if (!step) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-[var(--radius-sk-2xl)] bg-white/85 p-6 text-center shadow-sk-xs">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-sk-success-tint text-sk-success"><Crown size={24} aria-hidden /></span>
        <p className="text-[15px] font-extrabold text-sk-navy">Semua hadiah tangga sudah kamu klaim.</p>
        <p className="text-[12.5px] text-sk-muted">Poin berikutnya bisa ditukar di katalog.</p>
      </div>
    );
  }
  const ready = step.state === 'ready';
  const percent = Math.min(100, Math.floor((lifetime / step.pointsRequired) * 100));
  const short = Math.max(0, step.pointsRequired - balance);
  return (
    <div className="grid gap-5 rounded-[var(--radius-sk-2xl)] bg-white/90 p-5 shadow-sk-md ring-1 ring-white md:grid-cols-[auto_minmax(0,1fr)_280px] md:items-center md:p-6">
      <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-[linear-gradient(145deg,#8a6bfc,#246bfd)] text-white shadow-[0_16px_30px_-14px_rgba(109,77,224,0.95)]">
        <span aria-hidden className="absolute inset-1 rounded-[20px] ring-1 ring-white/30" />
        <RewardIcon slug={step.slug} size={34} strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fff3cf] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9a6a07]">
          <Crown size={12} aria-hidden /> {ready ? 'Siap diklaim' : 'Reward berikutnya'}
        </span>
        <p className="mt-2 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-sk-navy">{step.title}</p>
        {description && <p className="mt-1 line-clamp-2 max-w-[60ch] text-[12.5px] leading-relaxed text-sk-muted">{description}</p>}
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-mono text-[15px] font-bold text-sk-warning-ink">
          <Coins size={16} aria-hidden /> {formatPoints(step.pointsRequired)} poin
        </p>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-sk-track">
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8a6bfc,#6d4de0)]"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px]">
          <span className="font-mono text-sk-muted">{formatPoints(Math.min(lifetime, step.pointsRequired))} / {formatPoints(step.pointsRequired)}</span>
          <span className="font-bold text-sk-violet-600">{ready ? 'Terbuka' : `${formatPoints(step.deficit)} poin lagi`}</span>
        </div>
        <div className="mt-4">
        {ready ? (
          <Button
            fullWidth
            className="rounded-full bg-[linear-gradient(90deg,#6d4de0,#8a6bfc)] shadow-[0_10px_22px_-10px_rgba(109,77,224,0.9)]"
            disabled={short > 0 || pending !== null}
            loading={pending === step.slug}
            onClick={() => onClaim(step.slug, step.retryOf)}
            iconRight={<ArrowRight size={15} aria-hidden />}
          >
            {short > 0 ? `Saldo kurang ${formatPoints(short)} poin` : 'Klaim sekarang'}
          </Button>
        ) : (
          <Link href="/app/arena/projects" className="group inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-sk-border bg-white text-[13px] font-bold text-sk-navy transition-colors hover:border-sk-blue/40 hover:text-sk-blue">
            Kumpulkan poin dari proyek <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-[3px]" />
          </Link>
        )}
        </div>
      </div>
    </div>
  );
}

/**
 * Poin & hadiah — the wallet, the milestone ladder and the points shop on one
 * page (it used to be a section of the profile).
 *
 * Laid out from the owner's approved design: four figures up top, then the
 * reward ladder kept on top and lit up, then the catalogue of other things
 * points can buy, then what moved the balance lately and every claim made.
 */
export default function ParticipantRewards() {
  const reduce = useSettledReducedMotion();
  const overview = useParticipantResource(getParticipantOverview);
  const rewards = useParticipantResource(getParticipantMilestones);
  const points = useParticipantResource(useCallback(() => getParticipantPoints(8), []));
  const catalog = useParticipantResource(getRewardCatalog);
  const claiming = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');

  const refresh = () => {
    void overview.refresh();
    void rewards.refresh();
    void points.refresh();
  };

  async function claim(slug: string, retryOf: string | null) {
    if (claiming.current) return;
    claiming.current = true;
    setPending(slug);
    setError(null);
    setMessage('');
    try {
      const { taken } = await takeParticipantReward(slug, retryOf);
      const delivery = taken.delivery;
      setMessage(delivery?.status === 'DELIVERED'
        ? 'url' in delivery
          ? 'Hadiah berhasil diklaim. Tautannya sudah dikirim ke emailmu dan bisa dilihat di riwayat hadiah.'
          : 'Hadiah berhasil diklaim. Kode vouchermu bisa dilihat di riwayat hadiah.'
        : delivery?.status === 'MANUAL_REQUIRED'
          ? 'Hadiah berhasil diklaim. Tim kami sedang menyiapkannya. Pantau statusnya di riwayat hadiah.'
          : 'Hadiah berhasil diklaim.');
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Hadiah belum berhasil diklaim. Coba lagi.'));
    } finally {
      await Promise.all([overview.refresh(), rewards.refresh(), points.refresh()]);
      window.dispatchEvent(new Event(POINTS_CHANGED_EVENT));
      claiming.current = false;
      setPending(null);
    }
  }

  const ladder = rewards.data?.ladder ?? null;
  const summary = points.data;
  const balance = summary?.balance ?? 0;
  const steps = ladder ? [...ladder.steps].sort((a, b) => a.pointsRequired - b.pointsRequired) : [];
  const spotlight = steps.find((step) => step.state === 'ready') ?? ladder?.next ?? null;
  const spotlightDescription = spotlight ? (catalog.data?.find((item) => item.slug === spotlight.slug)?.description ?? null) : null;
  const redemptions = overview.data?.redemptions ?? [];

  const stats = [
    {
      label: 'Poin tersedia',
      value: summary ? <CountUp value={summary.balance} from={0} /> : '—',
      caption: summary ? `${formatPoints(summary.lifetimeEarned)} poin total diperoleh` : ' ',
      icon: Coins,
      tile: 'bg-[#fff3cf] text-sk-warning-ink',
    },
    {
      label: 'Total poin diperoleh',
      value: summary ? <CountUp value={summary.lifetimeEarned} from={0} /> : '—',
      caption: summary ? `dari ${summary.earningEntries} aktivitas` : ' ',
      icon: BarChart3,
      tile: 'bg-sk-success-tint text-sk-success',
    },
    {
      label: 'Reward berikutnya',
      value: ladder?.next ? <span className="line-clamp-2 font-sans text-[15px] font-extrabold leading-snug tracking-[-0.01em]">{ladder.next.title}</span> : ladder ? 'Semua terbuka' : '—',
      caption: ladder?.next ? `Butuh ${formatPoints(ladder.next.deficit)} poin lagi` : ' ',
      icon: Gift,
      tile: 'bg-sk-violet-tint text-sk-violet',
    },
  ];

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <motion.div
        className="flex flex-wrap items-start justify-between gap-5"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="min-w-0">
          <h1 className="flex items-center gap-3 text-[26px] font-extrabold tracking-[-0.035em] text-sk-navy sm:text-[32px]">
            Poin &amp; hadiah
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-2xl bg-[linear-gradient(145deg,#f1ecff,#ffe9f3)] text-sk-violet">
              <Gift size={20} strokeWidth={2.2} />
            </span>
          </h1>
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-sk-muted">
            Kumpulkan poin dari setiap proyek, buka hadiah di tangga, dan tukarkan sisanya di katalog.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden max-w-[260px] items-start gap-2 border-l-2 border-sk-violet/30 pl-3 text-[12.5px] italic leading-relaxed text-sk-muted lg:flex">
            <Quote size={14} aria-hidden className="mt-0.5 shrink-0 text-sk-violet" />
            Setiap poin adalah langkah lebih dekat ke versi terbaikmu.
          </p>
          <RefreshButton refresh={refresh} loading={overview.loading || rewards.loading || points.loading} />
        </div>
      </motion.div>

      <ResourceState loading={false} error={points.error ?? rewards.error} retry={refresh} />

      <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.li
            key={stat.label}
            className="card-rise flex items-start gap-3.5 rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-4"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.08 + index * 0.07 }}
          >
            <span aria-hidden className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', stat.tile)}>
              <stat.icon size={19} strokeWidth={2.3} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-semibold text-sk-muted">{stat.label}</span>
              <span className="mt-0.5 block font-mono text-[24px] font-bold leading-tight tracking-[-0.03em] text-sk-navy">{stat.value}</span>
              <span className="mt-0.5 block text-[11.5px] text-sk-faint">{stat.caption}</span>
            </span>
          </motion.li>
        ))}
        <motion.li
          className="card-rise flex items-center gap-3.5 rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-4"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.29 }}
        >
          <ProgressRing value={ladder?.takenCount ?? 0} total={steps.length} />
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-sk-muted">Progres penukaran</span>
            <span className="mt-0.5 block text-[15px] font-extrabold text-sk-navy">
              {ladder ? `${ladder.takenCount} dari ${steps.length} reward` : '—'}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-sk-faint">Terus kumpulkan poin!</span>
          </span>
        </motion.li>
      </ul>

      <motion.section
        aria-labelledby="tangga-hadiah-title"
        className="relative mt-8 overflow-hidden rounded-[28px] border border-[#e3dcff] bg-[linear-gradient(135deg,#f6f2ff_0%,#eef4ff_52%,#fff8e8_100%)] p-5 sm:p-7"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sk-violet/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-[#ffd65c]/25 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-sk-violet-600">Tangga hadiah</span>
            <h2 id="tangga-hadiah-title" className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[26px]">
              Kumpulkan poin, buka hadiahnya
            </h2>
            <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-sk-muted">
              Poin yang terkumpul membuka anak tangga berikutnya. Tiap hadiah diklaim satu kali memakai saldo poinmu.
            </p>
          </div>
          {ladder && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-2 font-mono text-[12px] font-bold text-sk-navy shadow-sk-xs">
              <Coins size={14} aria-hidden className="text-sk-warning-ink" />
              {formatPoints(ladder.lifetimePoints)} poin terkumpul
            </span>
          )}
        </div>

        {message && <p role="status" className="relative mt-4 rounded-[var(--radius-sk-lg)] bg-sk-success-tint px-4 py-3 text-[13px] font-semibold text-sk-success">{message}</p>}
        {error && <p role="alert" className="relative mt-4 rounded-[var(--radius-sk-lg)] bg-sk-error-wash px-4 py-3 text-[13px] font-semibold text-sk-error">{error.message}</p>}

        {!ladder ? (
          <div className="relative mt-6 h-[220px] rounded-[var(--radius-sk-2xl)] bg-white/60" aria-busy="true" />
        ) : steps.length === 0 ? (
          <p className="relative mt-6 text-[13px] text-sk-muted">Belum ada hadiah yang tersedia.</p>
        ) : (
          <div className="relative mt-6 space-y-5">
            <div className="min-w-0 rounded-[var(--radius-sk-2xl)] bg-white/55 px-2 py-5 ring-1 ring-white/80 sm:px-4">
              <RewardLadder ladder={ladder} balance={balance} pending={pending} onClaim={(slug, retryOf) => void claim(slug, retryOf)} />
            </div>
            <NextRewardCard
              step={spotlight}
              description={spotlightDescription}
              lifetime={ladder.lifetimePoints}
              balance={balance}
              pending={pending}
              onClaim={(slug, retryOf) => void claim(slug, retryOf)}
            />
          </div>
        )}
      </motion.section>

      <Section
        id="katalog-hadiah-title"
        title="Katalog hadiah"
        subtitle="Tukarkan poinmu dengan produk digital dan hadiah lain."
        action={isStoreEnabled() ? (
          <Link href="/app/store" className="inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline">
            Produk saya <ArrowRight size={15} aria-hidden />
          </Link>
        ) : undefined}
      >
        <RewardCatalog balance={balance} />
      </Section>

      <Section id="aktivitas-poin-title" title="Aktivitas poin terbaru" subtitle="Perolehan dan penukaran poin terakhirmu.">
        {summary ? <PointActivityList items={summary.recent} /> : <div className="skeleton h-24 rounded-[var(--radius-sk-2xl)]" />}
      </Section>

      <Section id="riwayat-hadiah" title="Riwayat hadiah" subtitle="Semua hadiah yang pernah kamu klaim, lengkap dengan catatan penyerahannya.">
        {redemptions.length === 0 ? (
          <p className="rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-border bg-white px-5 py-6 text-center text-[13px] text-sk-muted">
            Kamu belum mengklaim hadiah.
          </p>
        ) : (
          <ul className="divide-y divide-sk-border overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white">
            {redemptions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sk-navy">{item.title}</h3>
                  <p className="mt-1 text-xs text-sk-muted">{participantDate(item.redeemedAt)} WIB / {formatPoints(item.pointsSpent)} poin</p>
                  {item.fulfilledAt && <p className="mt-1 text-xs text-sk-success">Selesai {participantDate(item.fulfilledAt)} WIB</p>}
                  {item.deliveryNote && (
                    <p className="mt-2 whitespace-pre-line break-words text-sm text-sk-body">
                      <span className="font-semibold text-sk-navy">Catatan penyerahan:</span> {item.deliveryNote}
                    </p>
                  )}
                </div>
                <Badge variant={item.status === 'FULFILLED' ? 'mint' : item.status === 'FAILED' || item.status === 'ADMIN_REVERSED' ? 'slate' : 'amber'}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
