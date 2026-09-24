'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Crown,
  ExternalLink,
  FileSearch,
  FolderOpen,
  Linkedin,
  MousePointerClick,
  Play,
  Share2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { RewardIcon } from '@/components/arena/MilestoneRoadmap';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { SprintHero } from '@/components/arena/dashboard/SprintHero';
import { DeadlineCard } from '@/components/arena/dashboard/DeadlineCard';
import { StatStrip } from '@/components/arena/dashboard/StatStrip';
import { EnrollmentCard } from '@/components/arena/dashboard/EnrollmentCard';
import { RewardLadder } from '@/components/arena/rewards/RewardLadder';
import { Podium, type PodiumEntry } from '@/components/arena/leaderboard/Podium';
import { participantDate } from '@/components/arena/ParticipantDashboard';
import { TOOLS_URL } from '@/components/layout/nav-links';
import { ParticipantProvider } from '@/features/arena/participant';
import type {
  MilestoneLadder,
  MilestoneStep,
  ParticipantEnrollment,
  ParticipantOverview,
} from '@/lib/participant-client';
import { formatPoints } from '@/lib/reward-progress';
import { cn } from '@/lib/cn';

/* ---------------------------------------------------------------------------
   Demo timeline

   Everything on this page is a simulation, but every number on it follows the
   real rules, so nothing here contradicts what a participant later sees:
   - a sprint opens Monday 08:00 WIB and closes Friday 23:59 WIB (the cadence
     `weeklyWindow` in the generator writes into `arena.weeks`);
   - points = the rounded final score + a rank bonus of +200 / +100 / +50
     (`src/server/finalization/ranking.ts`);
   - the reward ladder is the live catalog, unlocked by lifetime points.

   The server render and the first client render share `SSR_CLOCK`, so the page
   hydrates cleanly; the real clock takes over right after mount.
--------------------------------------------------------------------------- */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WIB = 7 * HOUR;
/** Wednesday 23 September 2026, 10:00 WIB. */
const SSR_CLOCK = Date.UTC(2026, 8, 23, 3, 0);

const DEMO_NAME = 'Alvin Pratama';
const DEMO_AVATAR = 'a014';
const DEMO_USER = {
  id: 'user-demo',
  displayName: DEMO_NAME,
  email: 'peserta@sekolahkarir.id',
  avatarUrl: null,
  avatarId: DEMO_AVATAR,
  isAdmin: false,
};

/** The sprint running at `now`: Monday 08:00 → Friday 23:59 WIB. Saturday and
 *  Sunday roll forward to the coming sprint so the demo countdown never reads
 *  "waktu habis". `weeksBack` walks back to earlier, finalized sprints. */
function demoSprint(now: number, weeksBack = 0) {
  const local = new Date(now + WIB);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  let mondayMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - sinceMonday) - WIB;
  if (now > mondayMidnight + 5 * DAY - 60_000) mondayMidnight += 7 * DAY;
  mondayMidnight -= weeksBack * 7 * DAY;
  return {
    opensAt: mondayMidnight + 8 * HOUR,
    deadlineAt: mondayMidnight + 5 * DAY - 60_000,
    week: isoWeek(mondayMidnight + WIB),
  };
}

/** ISO-8601 week number of a UTC date (Monday-based, week 1 holds the first Thursday). */
function isoWeek(utcMs: number) {
  const date = new Date(utcMs);
  const fromMonday = (date.getUTCDay() + 6) % 7;
  const thursday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - fromMonday + 3);
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return 1 + Math.floor((thursday - yearStart) / (7 * DAY));
}

function rankBonus(rank: number) {
  return rank === 1 ? 200 : rank === 2 ? 100 : rank === 3 ? 50 : 0;
}

const ACTIVE_PROJECT = {
  id: 'proj-checkout',
  slug: 'rapikan-alur-checkout-toko-umkm',
  title: 'Rapikan alur checkout toko UMKM',
  division: 'Desain Produk',
};

/** Three finished sprints, newest first. The newest is the one the leaderboard,
 *  the LinkedIn post and the CV draft all talk about. */
const PAST_SPRINTS = [
  {
    weeksBack: 1,
    project: { id: 'proj-data', slug: 'bersihkan-data-penjualan-enam-bulan', title: 'Bersihkan data penjualan enam bulan', division: 'Data' },
    score: 88,
    rank: 2,
  },
  {
    weeksBack: 2,
    project: { id: 'proj-copy', slug: 'tulis-lima-varian-iklan-satu-produk', title: 'Tulis 5 varian iklan satu produk', division: 'Copywriting' },
    score: 91,
    rank: 3,
  },
  {
    weeksBack: 3,
    project: { id: 'proj-konten', slug: 'susun-kalender-konten-empat-minggu', title: 'Susun kalender konten empat minggu', division: 'Pemasaran Digital' },
    score: 84,
    rank: 11,
  },
] as const;

const FEATURED = PAST_SPRINTS[0];
const FEATURED_POINTS = FEATURED.score + rankBonus(FEATURED.rank);
const FEATURED_SKILLS = ['Data Cleaning', 'Pandas', 'SQL', 'Validasi Data'];

/** The live reward catalog (`scripts/seed-rewards-catalog.mjs`), cheapest first. */
const REWARDS: ReadonlyArray<{ slug: string; title: string; cost: number; blurb: string }> = [
  { slug: 'notion-kit', title: 'Template Notion & Resume Starter Kit', cost: 300, blurb: 'Workspace Notion untuk melacak lamaran kerja dan portofolio, plus template resume yang ramah ATS.' },
  { slug: 'ebook', title: 'E-Book Banting Stir Karir & HR Interview Guide', cost: 600, blurb: 'Panduan pindah jalur karier dan contoh jawaban wawancara HR yang bisa langsung kamu latih.' },
  { slug: 'voucher-50', title: 'Voucher Diskon 50% Masterclass', cost: 1000, blurb: 'Potongan 50% untuk satu kelas Masterclass SekolahKarir pilihanmu.' },
  { slug: 'cv-review', title: '1-on-1 CV & Portfolio Review (20 Menit)', cost: 1500, blurb: 'Sesi 20 menit bersama reviewer untuk membedah CV dan portofoliomu.' },
  { slug: 'free-pass', title: '100% Free Pass All Masterclass', cost: 2200, blurb: 'Akses gratis ke seluruh kelas Masterclass SekolahKarir.' },
  { slug: 'cash-500k', title: 'CASH REWARD Rp500.000', cost: 2700, blurb: 'Hadiah uang tunai untuk konsistensi dan kualitas kerjamu.' },
];

function demoLadder(lifetime: number): MilestoneLadder {
  const steps: MilestoneStep[] = REWARDS.map((reward) => {
    const reached = lifetime >= reward.cost;
    return {
      slug: reward.slug,
      title: reward.title,
      pointsRequired: reward.cost,
      deficit: reached ? 0 : reward.cost - lifetime,
      state: reached ? 'ready' : 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    };
  });
  return {
    lifetimePoints: lifetime,
    takenCount: 0,
    readyCount: steps.filter((step) => step.state === 'ready').length,
    next: steps.find((step) => step.state === 'locked') ?? null,
    steps,
  };
}

function buildDemo(now: number) {
  const current = demoSprint(now);
  const iso = (ms: number) => new Date(ms).toISOString();
  const currentWeek: NonNullable<ParticipantOverview['currentWeek']> = {
    id: `week-${current.week}`,
    weekCode: `MINGGU ${current.week}`,
    title: `Sprint Pekan ${current.week}`,
    status: 'OPEN',
    submissionDeadlineAt: iso(current.deadlineAt),
    canSelect: true,
  };

  const active: ParticipantEnrollment = {
    id: 'enroll-active',
    status: 'ACTIVE',
    selectedAt: iso(current.opensAt + 2 * HOUR),
    project: ACTIVE_PROJECT,
    week: {
      id: currentWeek.id,
      weekCode: currentWeek.weekCode,
      title: currentWeek.title,
      status: currentWeek.status,
      submissionDeadlineAt: currentWeek.submissionDeadlineAt,
      finalizedAt: null,
    },
    workspace: { currentStep: 'WORK', updatedAt: iso(Math.min(now, current.deadlineAt) - 3 * HOUR) },
    submission: { status: 'DRAFT', latestVersionId: null },
    ranking: null,
    // While a week is still open its results are sealed — exactly what the API
    // reports (`sealed: !isPublishedWeekStatus(...)`). `false` here is what made
    // the hero read "Misi selesai · sprint ini sudah ditutup".
    sealed: true,
  };

  const past = PAST_SPRINTS.map((sprint): ParticipantEnrollment => {
    const sprintWindow = demoSprint(now, sprint.weeksBack);
    return {
      id: `enroll-${sprint.project.id}`,
      status: 'SUBMITTED',
      selectedAt: iso(sprintWindow.opensAt + 3 * HOUR),
      project: { ...sprint.project },
      week: {
        id: `week-${sprintWindow.week}`,
        weekCode: `MINGGU ${sprintWindow.week}`,
        title: `Sprint Pekan ${sprintWindow.week}`,
        status: 'FINALIZED',
        submissionDeadlineAt: iso(sprintWindow.deadlineAt),
        finalizedAt: iso(sprintWindow.deadlineAt + DAY),
      },
      workspace: { currentStep: 'SUBMIT', updatedAt: iso(sprintWindow.deadlineAt - 5 * HOUR) },
      submission: { status: 'SUBMITTED', latestVersionId: `ver-${sprint.project.id}` },
      ranking: { rank: sprint.rank, finalScore: sprint.score, pointsAwarded: sprint.score + rankBonus(sprint.rank) },
      sealed: false,
    };
  });

  const lifetime = past.reduce((sum, row) => sum + (row.ranking?.pointsAwarded ?? 0), 0);
  const overview: ParticipantOverview = {
    currentWeek,
    currentEnrollmentId: active.id,
    points: { balance: lifetime, lifetimeEarned: lifetime },
    completedProjects: past.length,
    provenSkills: 7,
    history: [active, ...past],
    skillEvidence: [],
    redemptions: [],
  };

  return {
    overview,
    active,
    past,
    ladder: demoLadder(lifetime),
    lifetime,
    currentWeekNo: current.week,
    featuredWeekNo: demoSprint(now, FEATURED.weeksBack).week,
    featuredMonth: new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(
      new Date(demoSprint(now, FEATURED.weeksBack).deadlineAt),
    ),
  };
}

const PODIUM: PodiumEntry[] = [
  { rank: 1, name: 'Sarah K.', avatarId: 'a023', division: 'Desain Produk', value: 94.5, unit: 'SKOR' },
  { rank: 2, name: `${DEMO_NAME} (Kamu)`, avatarId: DEMO_AVATAR, division: FEATURED.project.division, value: FEATURED.score, unit: 'SKOR' },
  { rank: 3, name: 'Dimas W.', avatarId: 'a051', division: 'Copywriting', value: 86.5, unit: 'SKOR' },
];

/* ---------------------------------------------------------------------------
   Tour
--------------------------------------------------------------------------- */

interface TourStep {
  /** Matches the `data-tour` attribute on the section it teaches. */
  id: string;
  badge: string;
  title: string;
  body: string;
}

const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    id: 'sprint',
    badge: 'Sprint mingguan',
    title: 'Satu minggu, satu brief tantangan nyata.',
    body: 'Setiap Senin pukul 08:00 WIB brief baru dibuka. Pilih satu, lalu kerjakan lewat lima tahap di workspace: Brief → Rencana → Kerjakan → Periksa → Kirim. Kartu ini selalu menunjukkan langkahmu berikutnya.',
  },
  {
    id: 'deadline',
    badge: 'Tenggat',
    title: 'Batas kirim: Jumat pukul 23:59 WIB.',
    body: 'Hitung mundurnya berjalan real-time, persis seperti tenggat di tempat kerja. Versi terakhir yang kamu kirim sebelum tenggat itulah yang dinilai.',
  },
  {
    id: 'tangga-hadiah',
    badge: 'Tangga hadiah',
    title: 'Skor jadi poin, poin membuka hadiah.',
    body: 'Skor akhir 0–100 menjadi poin, ditambah bonus kalau kamu masuk tiga besar. Poin tidak hangus dan membuka tangga hadiah, dari Template Notion (300 poin) sampai CASH REWARD Rp500.000 (2.700 poin). Tiap hadiah diklaim sekali.',
  },
  {
    id: 'leaderboard',
    badge: 'Peringkat',
    title: 'Peringkat mingguan yang transparan.',
    body: 'Setelah tenggat, semua kiriman dinilai per kriteria rubrik yang sudah terbuka sejak hari pertama. Tiga besar tiap minggu mendapat bonus poin: +200, +100, dan +50.',
  },
  {
    id: 'linkedin',
    badge: 'LinkedIn',
    title: 'Pamerkan hasilnya di LinkedIn.',
    body: 'Brief, hasil kerja, skor per kriteria, dan peringkatmu adalah bukti kerja nyata. Ceritakan di postingan LinkedIn atau tambahkan ke bagian Proyek di profilmu — contohnya ada di sini.',
  },
  {
    id: 'cv-scanner',
    badge: 'CV Scanner',
    title: 'Masukkan ke CV, lalu cek lewat CV Scanner.',
    body: 'Tulis proyek ini sebagai pengalaman di CV-mu, lalu uji skor ATS-nya di CV Scanner SekolahKarir Tools sebelum melamar kerja.',
  },
];

const LAST_STEP = TOUR_STEPS.length - 1;
const LINKEDIN_STEP = TOUR_STEPS.findIndex((step) => step.id === 'linkedin');

function clearSpotlight() {
  document.body.classList.remove('tour-active', 'tour-dimmed');
  for (const el of document.querySelectorAll('[data-tour-target]')) {
    el.classList.remove('tour-spotlight');
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------------------------------------------------------------------------
   Pieces
--------------------------------------------------------------------------- */

function NextRewardCard({ step, blurb, lifetime }: { step: MilestoneStep | null; blurb: string; lifetime: number }) {
  if (!step) return null;
  const percent = Math.min(100, Math.floor((lifetime / step.pointsRequired) * 100));
  return (
    <div className="grid gap-4 rounded-2xl bg-white/90 p-4 shadow-sk-md ring-1 ring-white sm:rounded-[var(--radius-sk-2xl)] sm:p-5 md:grid-cols-[auto_minmax(0,1fr)_280px] md:items-center md:p-6">
      <div className="flex items-center gap-3 md:block">
        <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(145deg,#8a6bfc,#246bfd)] text-white shadow-[0_16px_30px_-14px_rgba(109,77,224,0.95)] sm:h-20 sm:w-20 sm:rounded-3xl">
          <span aria-hidden className="absolute inset-1 rounded-[14px] ring-1 ring-white/30 sm:rounded-[20px]" />
          <RewardIcon slug={step.slug} size={26} strokeWidth={1.9} aria-hidden className="sm:hidden" />
          <RewardIcon slug={step.slug} size={34} strokeWidth={1.9} aria-hidden className="hidden sm:block" />
        </span>
        <div className="min-w-0 md:hidden">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#fff3cf] px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#9a6a07]">
            <Crown size={11} aria-hidden /> Reward berikutnya
          </span>
          <p className="mt-1 text-sm font-extrabold leading-snug tracking-[-0.02em] text-sk-navy">{step.title}</p>
        </div>
      </div>
      <div className="hidden min-w-0 md:block">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fff3cf] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9a6a07]">
          <Crown size={12} aria-hidden /> Reward berikutnya
        </span>
        <p className="mt-2 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-sk-navy">{step.title}</p>
        <p className="mt-1 line-clamp-2 max-w-[60ch] text-[12.5px] leading-relaxed text-sk-muted">{blurb}</p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-mono text-sm font-bold text-sk-warning-ink sm:text-[15px]">
          <Coins size={15} aria-hidden /> {formatPoints(step.pointsRequired)} poin
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sk-track sm:mt-2.5 sm:h-2.5">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8a6bfc,#6d4de0)] transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] sm:text-[12px]">
          <span className="font-mono text-sk-muted">
            {formatPoints(Math.min(lifetime, step.pointsRequired))} / {formatPoints(step.pointsRequired)}
          </span>
          <span className="font-bold text-sk-violet-600">{formatPoints(step.deficit)} poin lagi</span>
        </div>
        <div className="mt-3 sm:mt-4">
          <Link
            href="/arena/projects"
            className="group inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-sk-border bg-white text-xs font-bold text-sk-navy transition-colors hover:border-sk-blue/40 hover:text-sk-blue sm:h-11 sm:text-[13px]"
          >
            Lihat proyek minggu ini
            <ArrowUpRight size={14} aria-hidden className="transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Same footprint as `DeadlineCard`, shown until the real clock is known. */
function DeadlineCardPlaceholder() {
  return (
    <div
      aria-hidden
      className="h-[226px] rounded-[var(--radius-sk-2xl)] border border-sk-border"
      style={{ background: 'var(--color-sk-deadline-tint)' }}
    />
  );
}

interface TourDockProps {
  index: number;
  minimized: boolean;
  onToggleMinimized: () => void;
  onClose: () => void;
  onGo: (index: number) => void;
  onShowExample: () => void;
  dockRef: React.RefObject<HTMLDivElement | null>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

/**
 * The tour callout, docked to the bottom of the screen.
 *
 * A wide, short bar on desktop (text left, controls right) so the section it
 * points at keeps most of the viewport; a bottom sheet on phones. It can be
 * folded down to one line when it still covers something the visitor wants
 * to read.
 */
function TourDock({ index, minimized, onToggleMinimized, onClose, onGo, onShowExample, dockRef, headingRef }: TourDockProps) {
  const step = TOUR_STEPS[index];
  const last = index === LAST_STEP;
  const progress = ((index + 1) / TOUR_STEPS.length) * 100;

  const controls = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {index > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGo(index - 1)}
          aria-label="Langkah sebelumnya"
          className="rounded-full bg-white px-2.5 sm:px-3.5"
          iconLeft={<ArrowLeft size={14} strokeWidth={2.4} aria-hidden />}
        >
          <span className="hidden sm:inline">Kembali</span>
        </Button>
      )}
      {index === LINKEDIN_STEP && !minimized && (
        <button
          type="button"
          onClick={onShowExample}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#0077B5]/30 bg-sky-50 px-3 text-[12px] font-bold text-[#005a8c] transition-colors hover:bg-sky-100"
        >
          <Linkedin size={13} aria-hidden />
          Lihat contoh
        </button>
      )}
      {last ? (
        <>
          <a
            href={`${TOOLS_URL}/cv-scanner`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-9 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 text-[12px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100 sm:inline-flex"
          >
            CV Scanner
            <ArrowUpRight size={13} aria-hidden />
          </a>
          <ButtonLink
            href="/app/arena"
            size="sm"
            className="rounded-full px-3.5 sm:px-4"
            iconRight={<ArrowRight size={14} strokeWidth={2.4} aria-hidden />}
          >
            Mulai Bertanding
          </ButtonLink>
        </>
      ) : (
        <Button
          size="sm"
          onClick={() => onGo(index + 1)}
          className="rounded-full px-4 sm:px-5"
          iconRight={<ArrowRight size={14} strokeWidth={2.4} aria-hidden />}
        >
          Lanjut
        </Button>
      )}
    </div>
  );

  return (
    <div
      ref={dockRef}
      className="fixed inset-x-0 bottom-0 z-50 px-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4 md:bottom-5 md:left-1/2 md:right-auto md:w-[min(900px,calc(100vw-2.5rem))] md:-translate-x-1/2 md:px-0 md:pb-0"
    >
      <motion.div
        role="dialog"
        aria-modal="false"
        aria-labelledby="mockup-tour-title"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-blue/25 bg-white shadow-[0_26px_70px_rgba(7,21,45,0.42)]"
      >
        <div className="h-1 bg-sk-track" aria-hidden>
          <motion.div
            className="h-full rounded-r-full bg-sk-blue"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        <div className="p-3.5 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sk-blue-tint px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-sk-blue-700">
              <span className="tabular-nums">
                {index + 1}/{TOUR_STEPS.length}
              </span>
              <span aria-hidden className="h-3 w-px bg-sk-blue/25" />
              {step.badge}
            </span>
            {minimized && (
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-sk-navy">{step.title}</p>
            )}
            {!minimized && <span className="flex-1" aria-hidden />}
            <button
              type="button"
              onClick={onToggleMinimized}
              aria-expanded={!minimized}
              aria-label={minimized ? 'Tampilkan penjelasan' : 'Kecilkan penjelasan'}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sk-muted transition-colors hover:bg-sk-bg hover:text-sk-navy"
            >
              {minimized ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup tur"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-sk-muted transition-colors hover:bg-sk-bg hover:text-sk-navy"
            >
              <X size={15} strokeWidth={2.4} aria-hidden />
              <span className="hidden sm:inline">Tutup tur</span>
            </button>
          </div>

          {minimized ? (
            <div className="mt-2 flex items-center justify-end">{controls}</div>
          ) : (
            <div className="mt-2 md:mt-2.5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8">
              <div className="min-w-0">
                <h2
                  id="mockup-tour-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-[16px] font-extrabold leading-snug tracking-[-0.025em] text-sk-navy focus-visible:outline-none sm:text-[19px]"
                >
                  {step.title}
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-sk-muted sm:mt-1.5 sm:text-[13.5px]">{step.body}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 md:mt-0 md:flex-col md:items-end md:justify-end">
                <div className="flex items-center" role="group" aria-label="Langkah tur">
                  {TOUR_STEPS.map((candidate, dot) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => onGo(dot)}
                      aria-label={`Ke langkah ${dot + 1}: ${candidate.badge}`}
                      aria-current={dot === index ? 'step' : undefined}
                      className="grid h-8 w-5 place-items-center rounded-full sm:w-6"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-200',
                          dot === index ? 'w-4 bg-sk-blue sm:w-5' : dot < index ? 'w-1.5 bg-sk-blue/45' : 'w-1.5 bg-sk-track',
                        )}
                      />
                    </button>
                  ))}
                </div>
                {controls}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */

export function ArenaDashboardMockup() {
  // `null` until mounted: the first render has to match the server's.
  const [clock, setClock] = useState<number | null>(null);
  const demo = useMemo(() => buildDemo(clock ?? SSR_CLOCK), [clock]);

  const [stepIndex, setStepIndex] = useState(0);
  const [tourActive, setTourActive] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [linkedinModalOpen, setLinkedinModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<{ id: number; text: string } | null>(null);

  const chromeRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const modalOpenerRef = useRef<HTMLElement | null>(null);
  const copiedTimer = useRef<number | null>(null);
  const hintTimer = useRef<number | null>(null);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    },
    [],
  );

  const showHint = useCallback((text: string) => {
    setHint({ id: Date.now(), text });
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), 3_200);
  }, []);

  const linkedinPost = [
    `🚀 Baru saja menuntaskan sprint Minggu ${demo.featuredWeekNo} di Side Hustle Arena by SekolahKarir!`,
    '',
    `📌 Proyek: ${FEATURED.project.title} (Divisi ${FEATURED.project.division})`,
    `📊 Hasil: skor ${FEATURED.score}/100 · peringkat #${FEATURED.rank} minggu itu`,
    `🛠️ Skill yang terbukti: ${FEATURED_SKILLS.join(', ')}`,
    '',
    'Briefnya kasus nyata, dinilai per kriteria rubrik yang terbuka sejak awal. Senang bisa punya bukti kerja, bukan cuma sertifikat kehadiran.',
    '',
    'https://arena.sekolahkarir.id',
    '',
    '#SekolahKarir #SideHustleArena #DataAnalyst #PortofolioProyek',
  ].join('\n');

  const copyPost = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(linkedinPost);
      ok = true;
    } catch {
      // Clipboard API blocked (insecure origin, permissions): fall back to a
      // hidden textarea, which every browser still copies from.
      const area = document.createElement('textarea');
      area.value = linkedinPost;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      area.remove();
    }
    if (!ok) {
      showHint('Browser menolak menyalin otomatis. Blok teks postingannya lalu salin manual, ya.');
      return;
    }
    setCopied(true);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2_000);
  };

  /** Scroll so `target` sits in the free band between the sticky header and
   *  the tour dock: centred when it fits, top-aligned when it is taller. */
  const scrollIntoBand = useCallback((target: HTMLElement) => {
    const chromeBottom = chromeRef.current?.getBoundingClientRect().bottom ?? 0;
    const dockTop = dockRef.current?.getBoundingClientRect().top ?? window.innerHeight;
    const top = chromeBottom + 18;
    const bottom = Math.min(dockTop, window.innerHeight) - 18;
    const band = Math.max(0, bottom - top);
    const rect = target.getBoundingClientRect();
    const offset = rect.height <= band ? top + (band - rect.height) / 2 : top;
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - offset),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  const goToStep = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(index, LAST_STEP)));
    setTourActive(true);
    setLinkedinModalOpen(false);
  }, []);

  const closeTour = useCallback(() => {
    setTourActive(false);
    setMinimized(false);
  }, []);

  // Spotlight the current section, then bring it into the free band. Runs a
  // frame late so the dock has its new height before it is measured.
  useEffect(() => {
    if (!tourActive) {
      clearSpotlight();
      return;
    }
    const step = TOUR_STEPS[stepIndex];
    document.body.classList.add('tour-active', 'tour-dimmed');
    for (const el of document.querySelectorAll('[data-tour-target]')) {
      el.classList.toggle('tour-spotlight', el.getAttribute('data-tour') === step.id);
    }
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
      if (target) scrollIntoBand(target);
      headingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tourActive, stepIndex, scrollIntoBand]);

  // Leaving the page mid-tour must not leave the body classes behind.
  useEffect(() => clearSpotlight, []);

  // ← / → move between steps, Esc closes the modal first and then the tour.
  useEffect(() => {
    if (!tourActive && !linkedinModalOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const origin = event.target as HTMLElement | null;
      if (origin && (origin.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(origin.tagName))) return;
      if (event.key === 'Escape') {
        if (linkedinModalOpen) setLinkedinModalOpen(false);
        else closeTour();
        return;
      }
      if (linkedinModalOpen || !tourActive) return;
      if (event.key === 'ArrowRight' && stepIndex < LAST_STEP) {
        event.preventDefault();
        goToStep(stepIndex + 1);
      } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
        event.preventDefault();
        goToStep(stepIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourActive, linkedinModalOpen, stepIndex, goToStep, closeTour]);

  // The LinkedIn preview is a real modal: page scroll locked, focus moved in,
  // and handed back to whatever opened it.
  useEffect(() => {
    if (!linkedinModalOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => modalCloseRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      root.style.overflow = previous;
      // Opened from the tour dock, the opener unmounted with it; the dock's
      // heading is the closest thing to "where you were".
      const opener = modalOpenerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      // Deliberately read at cleanup time: the heading wanted is the one the
      // dock just re-mounted with, not the one that existed when this ran.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      else headingRef.current?.focus({ preventScroll: true });
    };
  }, [linkedinModalOpen]);

  const openLinkedinModal = () => {
    modalOpenerRef.current = document.activeElement as HTMLElement | null;
    setLinkedinModalOpen(true);
  };

  const trapModalFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Buttons inside the simulated dashboard point at pages that only exist
  // behind a login (or at anchors of the real dashboard). Instead of dropping
  // the visitor on a login wall mid-tour, say what the button does for real.
  const interceptDemoLinks = (event: ReactMouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!href.startsWith('/app') && !href.startsWith('#')) return;
    event.preventDefault();
    // The first rendered line names the control ("Poin tersedia", "Lihat
    // hasil"); textContent would glue a tile's label, counter and caption.
    const firstLine = anchor.innerText.split('\n').map((line) => line.trim()).find(Boolean);
    const label = firstLine && firstLine.length <= 40 ? firstLine : undefined;
    showHint(
      label
        ? `Mode simulasi: “${label}” aktif di dashboard aslimu setelah kamu mulai bertanding.`
        : 'Mode simulasi: tombol ini aktif di dashboard aslimu setelah kamu mulai bertanding.',
    );
  };

  const readyReward = demo.ladder.steps.find((step) => step.state === 'ready') ?? null;
  const nextReward = demo.ladder.next;
  const nextBlurb = REWARDS.find((reward) => reward.slug === nextReward?.slug)?.blurb ?? '';
  const nextPercent = nextReward ? Math.min(100, Math.round((demo.lifetime / nextReward.pointsRequired) * 100)) : 100;

  return (
    <ParticipantProvider user={DEMO_USER}>
      <div className="min-h-screen bg-sk-bg pb-72 text-sk-navy sm:pb-80">
        {/* One sticky block for the simulation banner and the app header, so the
            tour can measure where the free viewport starts. */}
        <div ref={chromeRef} className="sticky top-0 z-40">
          <div className="flex items-center justify-between gap-2 border-b border-sk-blue/20 bg-gradient-to-r from-sk-navy via-sk-navy-2 to-sk-blue px-3 py-2 text-white shadow-md sm:px-6 sm:py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/"
                aria-label="Kembali ke beranda"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ArrowLeft size={14} strokeWidth={2.4} aria-hidden />
              </Link>
              <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-sk-blue px-2.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px]">
                <Sparkles size={11} aria-hidden />
                Simulasi 1:1
              </span>
              <p className="hidden truncate text-xs font-medium text-slate-200 md:block">
                Pratinjau <span className="font-bold text-white">Dashboard Peserta Arena</span> dengan data contoh — begini tampilannya saat kamu bertanding.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!tourActive && (
                <button
                  type="button"
                  onClick={() => goToStep(0)}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-white/10 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <Play size={10} fill="currentColor" aria-hidden />
                  Ulangi tur
                </button>
              )}
              <Link
                href="/app/arena"
                className="inline-flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-[11px] font-bold text-sk-blue shadow-xs transition-colors hover:bg-sk-blue-wash sm:px-3.5 sm:text-xs"
              >
                Mulai Bertanding
                <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden />
              </Link>
            </div>
          </div>

          {/* The participant header, drawn 1:1 but inert. */}
          <header className="border-b border-[#F0F2F5] bg-white/95 shadow-[0_1px_8px_rgba(15,23,42,0.03)] backdrop-blur-md">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:h-[72px] sm:px-6 lg:px-8">
              <div className="flex shrink-0 items-center gap-2">
                <Image
                  src="/logo-arena.png"
                  alt="Side Hustle Arena by SekolahKarir"
                  width={160}
                  height={33}
                  priority
                  className="h-6 w-auto object-contain sm:h-8"
                />
              </div>

              <div
                aria-hidden
                className="hidden items-center gap-0.5 rounded-full border border-[#E6EBF2] bg-[#EEF2F7] p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] lg:flex"
              >
                {['Ringkasan', 'Jelajahi proyek', 'Proyekku', 'Peringkat', 'Poin & hadiah'].map((tab, idx) => (
                  <span
                    key={tab}
                    className={cn(
                      'relative flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px]',
                      idx === 0 ? 'font-bold text-sk-navy' : 'font-semibold text-slate-500',
                    )}
                  >
                    {idx === 0 && (
                      <span className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]" />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </span>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="flex h-8 items-center gap-1 rounded-full border border-[#FDE6C8] bg-[#FFF9EE] px-2.5 text-xs font-bold text-sk-navy shadow-xs sm:h-9 sm:px-3 sm:text-[13px]">
                  <Coins size={13} className="text-amber-500" aria-hidden />
                  <span className="font-mono tabular-nums">{formatPoints(demo.overview.points.balance)}</span>
                  <span className="text-[10px] font-semibold text-amber-700 sm:text-[11px]">poin</span>
                </div>
                <div className="relative grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-sk-muted sm:h-9 sm:w-9">
                  <Bell size={15} aria-hidden />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sk-blue ring-2 ring-white" />
                </div>
                <div className="flex items-center gap-2 pl-0.5 sm:pl-1">
                  <AvatarBadge avatarId={DEMO_AVATAR} seed={DEMO_NAME} size="sm" className="ring-2 ring-white shadow-xs" />
                  <span className="hidden text-xs font-bold text-sk-navy xl:inline">{DEMO_NAME}</span>
                </div>
              </div>
            </div>
          </header>
        </div>

        {/* Dashboard body */}
        <main
          onClickCapture={interceptDemoLinks}
          className="mx-auto max-w-6xl px-3 pt-4 sm:px-6 sm:pt-6 md:pt-8 lg:px-8"
        >
          <h1 className="sr-only">Cara kerja Side Hustle Arena: simulasi dashboard peserta</h1>
          <div className="min-w-0">
            {/* Row 1: sprint hero + deadline */}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div data-tour="sprint" data-tour-target className="self-start rounded-[var(--radius-sk-3xl)]">
                <SprintHero
                  name={DEMO_NAME}
                  week={demo.overview.currentWeek}
                  active={demo.active}
                  focus={{
                    label: 'Lanjutkan proyek',
                    href: `/app/arena/workspace/${ACTIVE_PROJECT.slug}`,
                    progress: 60,
                    stage: 'Tahap 3 dari 5: kerjakan sesuai brief',
                    step: 'WORK',
                  }}
                />
              </div>

              <div className="flex flex-col gap-5">
                <div data-tour="deadline" data-tour-target className="rounded-[var(--radius-sk-2xl)]">
                  {clock === null ? (
                    <DeadlineCardPlaceholder />
                  ) : (
                    <DeadlineCard
                      deadlineAt={demo.overview.currentWeek!.submissionDeadlineAt}
                      href={`/app/arena/workspace/${ACTIVE_PROJECT.slug}`}
                      dateLabel={participantDate}
                      progress={60}
                    />
                  )}
                </div>

                <div className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-sk-violet-600">
                      Tangga hadiah
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const ladder = document.getElementById('tangga-hadiah');
                        if (ladder) scrollIntoBand(ladder);
                      }}
                      className="text-[12px] font-bold text-sk-blue hover:underline"
                    >
                      Detail
                    </button>
                  </div>
                  {readyReward && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#fff3cf] px-2.5 py-1 text-[11.5px] font-bold text-[#9a6a07]">
                      <Crown size={12} aria-hidden /> 1 hadiah siap diklaim
                    </p>
                  )}
                  {nextReward && (
                    <>
                      <p className="mt-2 text-[15px] font-bold text-sk-navy">
                        Target berikutnya: {formatPoints(nextReward.pointsRequired)} poin
                      </p>
                      <p className="mt-1 text-xs text-sk-muted">{nextReward.title}</p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sk-track">
                        <div className="h-full bg-gradient-to-r from-sk-violet to-sk-blue" style={{ width: `${nextPercent}%` }} />
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-sk-muted">
                        Kurang {formatPoints(nextReward.deficit)} poin lagi
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <StatStrip data={demo.overview} />
            </div>

            {/* Tangga hadiah */}
            <section
              id="tangga-hadiah"
              data-tour="tangga-hadiah"
              data-tour-target
              aria-labelledby="tangga-hadiah-title"
              className="relative mt-8 overflow-hidden rounded-[24px] border border-[#e3dcff] bg-[linear-gradient(135deg,#f6f2ff_0%,#eef4ff_52%,#fff8e8_100%)] p-4 shadow-sm sm:mt-10 sm:rounded-[28px] sm:p-7"
            >
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sk-violet/15 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-[#ffd65c]/25 blur-3xl" />

              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-sk-violet-600">
                    Tangga hadiah
                  </span>
                  <h2 id="tangga-hadiah-title" className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:mt-1.5 sm:text-[26px]">
                    Kumpulkan poin, buka hadiahnya
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-xs leading-relaxed text-sk-muted sm:text-[13px]">
                    Poin yang terkumpul membuka anak tangga berikutnya. Tiap hadiah diklaim satu kali memakai saldo poinmu.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 font-mono text-[11px] font-bold text-sk-navy shadow-sk-xs sm:gap-2 sm:px-3.5 sm:py-2 sm:text-[12px]">
                  <Coins size={14} aria-hidden className="text-sk-warning-ink" />
                  {formatPoints(demo.lifetime)} poin terkumpul
                </span>
              </div>

              <div className="relative mt-5 space-y-4 sm:mt-6 sm:space-y-5">
                <div className="min-w-0 rounded-[var(--radius-sk-2xl)] bg-white/55 px-2 py-4 ring-1 ring-white/80 sm:px-4 sm:py-5">
                  <RewardLadder
                    ladder={demo.ladder}
                    balance={demo.overview.points.balance}
                    pending={null}
                    onClaim={(slug) => {
                      const reward = REWARDS.find((item) => item.slug === slug);
                      showHint(
                        reward
                          ? `Mode simulasi: di dashboard aslimu, tombol ini menukar ${formatPoints(reward.cost)} poin dengan “${reward.title}”.`
                          : 'Mode simulasi: di dashboard aslimu, tombol ini menukar poin dengan hadiahnya.',
                      );
                    }}
                  />
                </div>
                <NextRewardCard step={nextReward} blurb={nextBlurb} lifetime={demo.lifetime} />
              </div>
            </section>

            {/* Row 2: leaderboard + catalogue */}
            <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-5 sm:mt-10 sm:gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <section
                data-tour="leaderboard"
                data-tour-target
                aria-labelledby="leaderboard-title"
                className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-4 shadow-xs sm:rounded-[var(--radius-sk-3xl)] sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sk-blue sm:text-[10.5px]">
                      <Trophy size={13} className="text-amber-500" aria-hidden />
                      Papan peringkat · Minggu {demo.featuredWeekNo}
                    </p>
                    <h2 id="leaderboard-title" className="mt-1 text-[18px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[20px]">
                      Hasil sprint minggu lalu
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-md bg-sk-success-tint px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-sk-success">
                    Final
                  </span>
                </div>

                <div className="mt-5 sm:mt-6">
                  <Podium entries={PODIUM} size="md" label={`Papan peringkat minggu ${demo.featuredWeekNo}`} />
                </div>

                <div className="mt-5 border-t border-sk-border pt-3.5 sm:mt-6 sm:pt-4">
                  <div className="flex items-center justify-between rounded-xl border border-sk-blue-tint-border bg-sk-blue-wash px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sk-blue text-xs font-bold text-white">
                        {FEATURED.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-sk-navy">{DEMO_NAME} (Kamu)</p>
                        <p className="truncate text-[10.5px] text-sk-muted sm:text-[11px]">
                          {FEATURED.project.division} · skor {FEATURED.score}/100
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 pl-2 text-right">
                      <p className="font-mono text-xs font-bold text-sk-blue sm:text-sm">+{FEATURED_POINTS} poin</p>
                      <p className="text-[10px] font-semibold text-emerald-600 sm:text-[10.5px]">
                        {FEATURED.score} skor + {rankBonus(FEATURED.rank)} bonus peringkat
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex flex-col justify-between rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-4 shadow-xs sm:rounded-[var(--radius-sk-3xl)] sm:p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sk-blue sm:text-[10.5px]">
                      Katalog minggu ini
                    </span>
                    <Link href="/arena/projects" className="text-xs font-bold text-sk-blue hover:underline">
                      Lihat semua
                    </Link>
                  </div>
                  <h3 className="mt-1 text-[18px] font-extrabold text-sk-navy sm:text-[20px]">Pilihan brief lainnya</h3>
                  <p className="mt-1 text-xs leading-relaxed text-sk-muted">
                    Tiap minggu beberapa divisi membuka brief simulasi kerja nyata. Kamu ambil satu.
                  </p>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-sk-border bg-sk-bg p-4">
                      <span className="text-[10px] font-bold uppercase text-sk-blue">Data</span>
                      <h4 className="mt-1 text-sm font-bold text-sk-navy">Analisis retensi pelanggan kedai kopi</h4>
                      <p className="mt-1 text-xs text-sk-muted">Cari pola pelanggan yang berhenti datang dari 8 bulan data transaksi.</p>
                    </div>
                    <div className="rounded-2xl border border-sk-border bg-sk-bg p-4">
                      <span className="text-[10px] font-bold uppercase text-sk-violet-600">Copywriting</span>
                      <h4 className="mt-1 text-sm font-bold text-sk-navy">Tulis ulang halaman produk marketplace</h4>
                      <p className="mt-1 text-xs text-sk-muted">Ubah deskripsi produk yang datar jadi halaman yang menjawab keberatan pembeli.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-gradient-to-br from-sk-navy to-sk-navy-3 p-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-sk-blue-400">Tips sukses Arena</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    Baca rubrik penilaian sebelum mulai. Skor tertinggi biasanya datang dari kiriman yang menjawab tiap kriteria dengan bukti kerja yang terstruktur.
                  </p>
                </div>
              </section>
            </div>

            {/* History */}
            <section className="mt-10 rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-5 shadow-xs sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-sk-blue">Rekam jejak</span>
                  <h2 className="mt-1.5 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
                    Riwayat sprint &amp; portofolio
                  </h2>
                  <p className="mt-1 text-xs text-sk-muted">
                    Proyek yang selesai dinilai menghasilkan skor, poin, dan skill terbukti yang tercatat di Career Report.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-700">
                  <Check size={13} strokeWidth={3} aria-hidden /> {demo.past.length} proyek dinilai
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {demo.past.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                ))}
                <div className="flex flex-col items-center justify-center rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-border bg-sk-bg p-8 text-center">
                  <FolderOpen size={32} className="text-sk-faint" aria-hidden />
                  <p className="mt-3 text-sm font-bold text-sk-navy">Tantangan minggu depan</p>
                  <p className="mt-1 max-w-[280px] text-xs text-sk-muted">
                    Setiap Senin pukul 08:00 WIB brief baru dibuka untuk menambah koleksi portofoliomu.
                  </p>
                </div>
              </div>
            </section>

            {/* LinkedIn */}
            <section
              data-tour="linkedin"
              data-tour-target
              aria-labelledby="linkedin-mockup-title"
              className="mt-10 rounded-[var(--radius-sk-3xl)] border-2 border-[#0077b5]/30 bg-gradient-to-b from-sky-50 via-white to-white p-4 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-4 border-b border-sky-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#0077B5] text-white shadow-md shadow-[#0077b5]/25">
                    <Linkedin size={24} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0077B5]/10 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase text-[#005a8c]">
                      <Sparkles size={11} aria-hidden /> Contoh postingan &amp; profil
                    </span>
                    <h2 id="linkedin-mockup-title" className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
                      Pamerkan hasil proyekmu di LinkedIn
                    </h2>
                    <p className="mt-1 max-w-[640px] text-xs text-sk-muted">
                      Setelah minggu difinalisasi, halaman hasil menampilkan skor per kriteria, peringkat, dan umpan balik penilai. Itu bukti kerja nyata yang bisa kamu ceritakan di postingan LinkedIn atau di bagian Proyek pada profilmu.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  <button
                    type="button"
                    onClick={copyPost}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#0077B5] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#006097] active:scale-[0.98] sm:h-10 sm:px-4"
                  >
                    {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    <span aria-live="polite">{copied ? 'Draf postingan tersalin!' : 'Salin draf postingan'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openLinkedinModal}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-sk-navy shadow-xs transition hover:bg-slate-50 active:scale-[0.98] sm:h-10 sm:px-3.5"
                  >
                    <Share2 size={14} aria-hidden />
                    Lihat versi layar penuh
                  </button>
                </div>
              </div>

              <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                {/* Feed post */}
                <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <AvatarBadge avatarId={DEMO_AVATAR} seed={DEMO_NAME} size="md" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 sm:text-sm">{DEMO_NAME}</p>
                        <p className="line-clamp-1 text-[11px] text-slate-500">Aspiring Data Analyst · Peserta Side Hustle Arena</p>
                        <p className="text-[10px] text-slate-400">1 jam lalu · 🌐 Publik</p>
                      </div>
                    </div>
                    <span aria-hidden className="text-sm font-bold text-slate-400">•••</span>
                  </div>

                  <div className="mt-3.5 space-y-2 text-xs leading-relaxed text-slate-800">
                    <p>
                      🚀 Baru saja menuntaskan sprint Minggu {demo.featuredWeekNo} di <strong>Side Hustle Arena</strong> by SekolahKarir!
                    </p>
                    <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700">
                      <p>📌 <strong>Proyek:</strong> {FEATURED.project.title}</p>
                      <p>📊 <strong>Hasil:</strong> skor {FEATURED.score}/100 · peringkat #{FEATURED.rank} minggu itu</p>
                      <p>🛠️ <strong>Skill yang terbukti:</strong> {FEATURED_SKILLS.join(', ')}</p>
                    </div>
                    <p className="text-slate-600">
                      Briefnya kasus nyata, dinilai per kriteria rubrik yang terbuka sejak awal. Senang bisa punya bukti kerja, bukan cuma sertifikat kehadiran.
                    </p>
                    <p className="break-all font-mono text-[11px] font-semibold text-[#0077B5] underline underline-offset-2">
                      https://arena.sekolahkarir.id
                    </p>
                    <p className="text-[11px] text-slate-400">#SekolahKarir #SideHustleArena #DataAnalyst #PortofolioProyek</p>
                  </div>

                  {/* Attachment: a capture of the real result page */}
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-4 text-white shadow-inner">
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-sky-300">
                      <span>Side Hustle Arena · Hasil penilaian</span>
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-bold">Minggu {demo.featuredWeekNo}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-extrabold tracking-tight text-white sm:text-base">{FEATURED.project.title}</h3>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Skor', value: `${FEATURED.score}` },
                        { label: 'Peringkat', value: `#${FEATURED.rank}` },
                        { label: 'Poin', value: `+${FEATURED_POINTS}` },
                      ].map((cell) => (
                        <div key={cell.label} className="rounded-lg bg-white/5 px-2 py-2 ring-1 ring-white/10">
                          <p className="font-mono text-[9.5px] uppercase tracking-wider text-slate-400">{cell.label}</p>
                          <p className="mt-0.5 font-mono text-[15px] font-bold text-white">{cell.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 border-t border-slate-700/60 pt-2 text-[10.5px] text-slate-400">
                      Tangkapan layar halaman hasil — dinilai per kriteria rubrik.
                    </p>
                  </div>

                  <div className="mt-3.5 flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span aria-hidden className="text-xs">👍❤️💡</span> 48 reaksi
                    </span>
                    <span>12 komentar · 6 repost</span>
                  </div>
                  <div aria-hidden className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px] font-semibold text-slate-600">
                    <span className="rounded-lg py-1.5">👍 Suka</span>
                    <span className="rounded-lg py-1.5">💬 Komen</span>
                    <span className="rounded-lg py-1.5">🔄 Repost</span>
                    <span className="rounded-lg py-1.5">↗️ Kirim</span>
                  </div>
                </article>

                {/* Profile: Projects section */}
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Tampilan profil LinkedIn</span>
                    <h3 className="mt-1 text-sm font-extrabold text-sk-navy">Bagian: Proyek</h3>
                    <div className="mt-3.5 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                      <Image
                        src="/logo-arena.png"
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1 ring-1 ring-slate-200"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-snug text-slate-900">{FEATURED.project.title}</p>
                        <p className="text-[11px] text-slate-600">Side Hustle Arena by SekolahKarir · {demo.featuredMonth}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          Membersihkan 12 ribu baris data penjualan jadi satu tabel siap analisis. Skor {FEATURED.score}/100, peringkat #{FEATURED.rank}.
                        </p>
                        <p className="mt-1.5 text-[10.5px] font-semibold text-slate-600">Skill: {FEATURED_SKILLS.slice(0, 3).join(' · ')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-900">
                    <p className="flex items-center gap-1.5 font-bold text-sky-950">
                      <Sparkles size={14} className="text-[#0077B5]" aria-hidden /> Kenapa ini menarik buat HR?
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-sky-800">
                      Recruiter mencari bukti pengerjaan nyata. Proyek Arena punya brief, hasil kerja, dan penilaian per kriteria yang bisa kamu jelaskan satu per satu saat wawancara.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* CV Scanner */}
            <section
              data-tour="cv-scanner"
              data-tour-target
              aria-labelledby="cv-scanner-mockup-title"
              className="mt-10 rounded-[var(--radius-sk-3xl)] border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50 via-white to-white p-4 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-4 border-b border-emerald-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
                    <FileSearch size={24} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase text-emerald-800">
                        <CheckCircle2 size={11} aria-hidden /> Langkah berikutnya
                      </span>
                      <span className="font-mono text-xs font-semibold text-emerald-700">tools.sekolahkarir.id</span>
                    </div>
                    <h2 id="cv-scanner-mockup-title" className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]">
                      Masukkan proyekmu ke CV, lalu cek di CV Scanner
                    </h2>
                    <p className="mt-1 max-w-[640px] text-xs text-sk-muted">
                      Tulis proyek Arena sebagai pengalaman di CV-mu, lalu uji format dan skor ATS-nya di CV Scanner SekolahKarir Tools sebelum melamar kerja.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  <a
                    href={`${TOOLS_URL}/cv-scanner`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] sm:h-10 sm:px-4"
                  >
                    <FileSearch size={15} aria-hidden />
                    Buka CV Scanner
                    <ExternalLink size={13} className="opacity-80" aria-hidden />
                  </a>
                  <a
                    href={`${TOOLS_URL}/store`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-sk-navy shadow-xs transition hover:bg-slate-50 active:scale-[0.98] sm:h-10 sm:px-3.5"
                  >
                    Toko template CV
                    <ExternalLink size={12} className="text-slate-400" aria-hidden />
                  </a>
                </div>
              </div>

              <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-800">Contoh hasil analisis ATS</span>

                  <div className="flex items-center gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                      <div className="text-center">
                        <span className="text-xl font-black">94</span>
                        <span className="block text-[9px] opacity-80">/100</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800">
                        ✓ Ramah ATS: sangat baik
                      </span>
                      <p className="mt-1 text-xs text-slate-600">Kata kunci dan bukti proyek memenuhi standar sistem screening HR.</p>
                    </div>
                  </div>

                  <ul className="space-y-2 border-t border-emerald-200/60 pt-2 text-xs">
                    {[
                      ['Format bersih', 'tanpa tabel bertumpuk atau format yang membingungkan parser.'],
                      ['Hasil terukur', `skor ${FEATURED.score}/100, 12 ribu baris data, peringkat #${FEATURED.rank}.`],
                      ['Kata kunci cocok', 'Python, Pandas, SQL, Data Cleaning.'],
                    ].map(([label, text]) => (
                      <li key={label} className="flex items-start gap-2 text-slate-700">
                        <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                        <span>
                          <strong>{label}:</strong> {text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Draf bagian pengalaman di CV</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">Siap ditempel</span>
                  </div>

                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-800">
                    <p className="font-bold text-slate-900">Proyek Data Analyst — Side Hustle Arena ({demo.featuredMonth})</p>
                    <ul className="list-disc space-y-1 pl-4 text-slate-700">
                      <li>Membersihkan dan memvalidasi 12 ribu baris data penjualan enam bulan dengan Python (Pandas) dan SQL.</li>
                      <li>Menangani nilai kosong, duplikasi, dan tipe data yang tidak konsisten hingga siap dianalisis.</li>
                      <li>Meraih skor {FEATURED.score}/100 dan peringkat #{FEATURED.rank} dari seluruh peserta minggu itu.</li>
                    </ul>
                  </div>

                  <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
                    💡 Tempel draf ini ke CV-mu, lalu cek skornya di{' '}
                    <a
                      href={`${TOOLS_URL}/cv-scanner`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-700 hover:underline"
                    >
                      tools.sekolahkarir.id/cv-scanner
                    </a>
                    .
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* Dims the page behind the spotlit section. The section itself rises
            above it (z-30, see `.tour-spotlight` in globals.css). */}
        <AnimatePresence>
          {tourActive && (
            <motion.div
              key="tour-scrim"
              aria-hidden
              className="fixed inset-0 z-20 bg-[rgba(7,21,45,0.5)] md:backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* "This is a simulation" hint for buttons that only work for real. */}
        <AnimatePresence>
          {hint && (
            <motion.div
              key={hint.id}
              role="status"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-3 top-[112px] z-[60] mx-auto flex max-w-md items-start gap-2.5 rounded-2xl border border-sk-blue/25 bg-white px-4 py-3 text-[12.5px] leading-snug text-sk-navy shadow-[0_18px_40px_rgba(7,21,45,0.25)] sm:top-[132px]"
            >
              <MousePointerClick size={16} className="mt-0.5 shrink-0 text-sk-blue" aria-hidden />
              <span className="min-w-0 flex-1">{hint.text}</span>
              <button
                type="button"
                onClick={() => setHint(null)}
                aria-label="Tutup pesan"
                className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sk-muted hover:bg-sk-bg hover:text-sk-navy"
              >
                <X size={13} aria-hidden />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LinkedIn preview modal */}
        <AnimatePresence>
          {linkedinModalOpen && (
            <motion.div
              key="linkedin-modal"
              className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm sm:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => {
                if (event.target === event.currentTarget) setLinkedinModalOpen(false);
              }}
            >
              <motion.div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="linkedin-modal-title"
                onKeyDown={trapModalFocus}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="relative my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-sk-2xl)] border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0077B5] text-white">
                      <Linkedin size={18} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 id="linkedin-modal-title" className="text-sm font-extrabold text-sk-navy">
                        Contoh postingan LinkedIn
                      </h3>
                      <p className="text-[11px] text-sk-muted">Begini hasil proyek Arena bisa kamu ceritakan ke recruiter</p>
                    </div>
                  </div>
                  <button
                    ref={modalCloseRef}
                    type="button"
                    onClick={() => setLinkedinModalOpen(false)}
                    aria-label="Tutup contoh postingan"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2.5">
                    <AvatarBadge avatarId={DEMO_AVATAR} seed={DEMO_NAME} size="md" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{DEMO_NAME}</p>
                      <p className="text-[10.5px] text-slate-500">Aspiring Data Analyst · Peserta Side Hustle Arena</p>
                      <p className="text-[10px] text-slate-400">1 menit · 🌐 Publik</p>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-line rounded-lg border border-slate-100 bg-white p-3.5 text-xs leading-relaxed text-slate-800 shadow-xs">
                    {linkedinPost}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={copyPost}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" aria-hidden /> : <Copy size={14} aria-hidden />}
                      <span aria-live="polite">{copied ? 'Teks tersalin!' : 'Salin teks postingan'}</span>
                    </button>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/60 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                      <CheckCircle2 size={13} className="text-sky-600" aria-hidden />
                      Siap dibagikan
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3 text-[11.5px] leading-relaxed text-sky-900">
                  <strong>💡 Tips:</strong> lampirkan tangkapan layar halaman hasilmu (skor per kriteria dan umpan balik penilai), lalu tambahkan proyeknya ke bagian <em>Proyek</em> di profil LinkedIn-mu.
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setLinkedinModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Tutup
                  </button>
                  <Button
                    size="sm"
                    onClick={() => goToStep(LAST_STEP)}
                    iconRight={<ArrowRight size={14} strokeWidth={2.4} aria-hidden />}
                  >
                    Lanjut ke langkah CV Scanner
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {tourActive && !linkedinModalOpen && (
          <TourDock
            index={stepIndex}
            minimized={minimized}
            onToggleMinimized={() => setMinimized((value) => !value)}
            onClose={closeTour}
            onGo={goToStep}
            onShowExample={openLinkedinModal}
            dockRef={dockRef}
            headingRef={headingRef}
          />
        )}
      </div>
    </ParticipantProvider>
  );
}
