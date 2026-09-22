'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Coins,
  Compass,
  Crown,
  FolderOpen,
  Info,
  Play,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { RewardIcon } from '@/components/arena/MilestoneRoadmap';
import { SprintHero } from '@/components/arena/dashboard/SprintHero';
import { DeadlineCard } from '@/components/arena/dashboard/DeadlineCard';
import { StatStrip } from '@/components/arena/dashboard/StatStrip';
import { EnrollmentCard } from '@/components/arena/dashboard/EnrollmentCard';
import { RewardLadder } from '@/components/arena/rewards/RewardLadder';
import { Podium, type PodiumEntry } from '@/components/arena/leaderboard/Podium';
import { participantDate } from '@/components/arena/ParticipantDashboard';
import { ParticipantProvider } from '@/features/arena/participant';
import type { MilestoneLadder, ParticipantOverview } from '@/lib/participant-client';
import { formatPoints } from '@/lib/reward-progress';
import { cn } from '@/lib/cn';

interface TourStep {
  id: string;
  badge: string;
  title: string;
  body: string;
}

const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    id: 'sprint',
    badge: '1. SPRINT MINGGUAN',
    title: 'Satu minggu, satu brief tantangan nyata.',
    body: 'Setiap pekan, kamu memilih 1 brief proyek industri. Di dashboard ini kamu memantau progress pengerjaan (Pahami → Rencana → Kerjakan → Review → Kirim) dan bisa langsung membuka workspace pengerjaan.',
  },
  {
    id: 'deadline',
    badge: '2. DISIPLIN DEADLINE',
    title: 'Batas submit: Jumat pukul 21:59 WIB.',
    body: 'Timer countdown bergerak real-time. Kamu dituntut disiplin menyelesaikan dan mengunggah hasil sebelum waktu habis, persis seperti tuntutan deadline di lingkungan kerja profesional.',
  },
  {
    id: 'tangga-hadiah',
    badge: '3. TANGGA HADIAH & POIN',
    title: 'Kumpulkan poin, buka hadiahnya bertingkat.',
    body: 'Setiap proyek yang dinilai menghasilkan skor (0–100) yang langsung dikonversi menjadi poin. Poin ini tidak akan hangus dan membuka anak tangga hadiah: dari Template Notion, E-Book Banting Stir Karir, Voucher Kelas, hingga CASH REWARD Rp500.000!',
  },
  {
    id: 'leaderboard',
    badge: '4. PAPAN PERINGKAT',
    title: 'Kompetisi sehat & transparan se-Indonesia.',
    body: 'Hasil kerjamu dinilai oleh sistem AI dan reviewer berbasis rubrik transparan. Tiga peringkat teratas setiap minggu berhak atas bonus poin ekstra (+200, +100, dan +50 poin).',
  },
  {
    id: 'history',
    badge: '5. PORTOFOLIO & REKAM JEJAK',
    title: 'Bukti kerja nyata yang siap dipamerkan ke HR.',
    body: 'Semua proyek yang telah selesai tercatat permanen di riwayat pertandingan dan Career Report kamu. Lengkap dengan skor, feedback rubrik, dan skill yang terbukti untuk melamar kerja.',
  },
];

const mockLadder: MilestoneLadder = {
  lifetimePoints: 0,
  takenCount: 0,
  readyCount: 0,
  next: {
    slug: 'notion-kit',
    title: 'Template Notion & Resume Starter Kit',
    pointsRequired: 300,
    deficit: 300,
    state: 'locked',
    takenAt: null,
    outOfStock: false,
    retryOf: null,
  },
  steps: [
    {
      slug: 'notion-kit',
      title: 'Template Notion & Resume Starter Kit',
      pointsRequired: 300,
      deficit: 300,
      state: 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    },
    {
      slug: 'ebook',
      title: 'E-Book Banting Stir Karir & HR Interview Guide',
      pointsRequired: 600,
      deficit: 600,
      state: 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    },
    {
      slug: 'voucher-50',
      title: 'Voucher Diskon 50% Masterclass',
      pointsRequired: 1000,
      deficit: 1000,
      state: 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    },
    {
      slug: 'cv-review',
      title: '1-on-1 CV & Portfolio Review (20 Menit)',
      pointsRequired: 1500,
      deficit: 1500,
      state: 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    },
    {
      slug: 'free-pass',
      title: '100% Free Pass All Masterclass',
      pointsRequired: 2200,
      deficit: 2200,
      state: 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    },
    {
      slug: 'cash-500k',
      title: 'CASH REWARD Rp500.000',
      pointsRequired: 2700,
      deficit: 2700,
      state: 'locked',
      takenAt: null,
      outOfStock: false,
      retryOf: null,
    },
  ],
};

const mockOverview: ParticipantOverview = {
  currentWeek: {
    id: 'week-38',
    weekCode: 'MINGGU 38',
    title: 'Sprint Pekan 38',
    status: 'OPEN',
    submissionDeadlineAt: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 14 * 3600 * 1000).toISOString(),
    canSelect: true,
  },
  currentEnrollmentId: 'enroll-active',
  points: { balance: 450, lifetimeEarned: 450 },
  completedProjects: 1,
  provenSkills: 4,
  history: [
    {
      id: 'enroll-active',
      status: 'ACTIVE',
      selectedAt: new Date().toISOString(),
      project: {
        id: 'proj-1',
        slug: 'rapikan-alur-checkout-toko-umkm',
        title: 'Rapikan alur checkout toko UMKM',
        division: 'Desain Produk',
      },
      week: {
        id: 'week-38',
        weekCode: 'MINGGU 38',
        title: 'Sprint Pekan 38',
        status: 'OPEN',
        submissionDeadlineAt: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 14 * 3600 * 1000).toISOString(),
        finalizedAt: null,
      },
      workspace: {
        currentStep: 'WORK',
        updatedAt: new Date().toISOString(),
      },
      submission: {
        status: 'DRAFT',
        latestVersionId: null,
      },
      ranking: null,
      sealed: false,
    },
    {
      id: 'enroll-past',
      status: 'SUBMITTED',
      selectedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      project: {
        id: 'proj-2',
        slug: 'bersihkan-data-penjualan-enam-bulan',
        title: 'Bersihkan data penjualan enam bulan',
        division: 'Data',
      },
      week: {
        id: 'week-37',
        weekCode: 'MINGGU 37',
        title: 'Sprint Pekan 37',
        status: 'FINALIZED',
        submissionDeadlineAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        finalizedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      },
      workspace: {
        currentStep: 'SUBMIT',
        updatedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      },
      submission: {
        status: 'SUBMITTED',
        latestVersionId: 'ver-past',
      },
      ranking: {
        rank: 2,
        finalScore: 88,
        pointsAwarded: 100,
      },
      sealed: false,
    },
  ],
  skillEvidence: [],
  redemptions: [],
};

const mockPodium: PodiumEntry[] = [
  { rank: 1, name: 'Sarah K.', avatarId: 'avatar-1', division: 'Desain Produk', value: 96.5, unit: 'SKOR' },
  { rank: 2, name: 'Alvin Pratama (Kamu)', avatarId: 'avatar-4', division: 'Data', value: 92.0, unit: 'SKOR' },
  { rank: 3, name: 'Dimas W.', avatarId: 'avatar-2', division: 'Copywriting', value: 89.5, unit: 'SKOR' },
];

function NextRewardCard({
  step,
  description,
  lifetime,
}: {
  step: typeof mockLadder.next;
  description: string;
  lifetime: number;
}) {
  if (!step) return null;
  const percent = Math.min(100, Math.floor((lifetime / step.pointsRequired) * 100));
  return (
    <div className="grid gap-5 rounded-[var(--radius-sk-2xl)] bg-white/90 p-5 shadow-sk-md ring-1 ring-white md:grid-cols-[auto_minmax(0,1fr)_280px] md:items-center md:p-6">
      <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-[linear-gradient(145deg,#8a6bfc,#246bfd)] text-white shadow-[0_16px_30px_-14px_rgba(109,77,224,0.95)]">
        <span aria-hidden className="absolute inset-1 rounded-[20px] ring-1 ring-white/30" />
        <RewardIcon slug={step.slug} size={34} strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fff3cf] px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9a6a07]">
          <Crown size={12} aria-hidden /> Reward berikutnya
        </span>
        <p className="mt-2 text-[18px] font-extrabold leading-snug tracking-[-0.02em] text-sk-navy">{step.title}</p>
        <p className="mt-1 line-clamp-2 max-w-[60ch] text-[12.5px] leading-relaxed text-sk-muted">{description}</p>
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-mono text-[15px] font-bold text-sk-warning-ink">
          <Coins size={16} aria-hidden /> {formatPoints(step.pointsRequired)} poin
        </p>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-sk-track">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#8a6bfc,#6d4de0)] transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[12px]">
          <span className="font-mono text-sk-muted">
            {formatPoints(Math.min(lifetime, step.pointsRequired))} / {formatPoints(step.pointsRequired)}
          </span>
          <span className="font-bold text-sk-violet-600">{formatPoints(step.deficit)} poin lagi</span>
        </div>
        <div className="mt-4">
          <Link
            href="/arena/projects"
            className="group inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-sk-border bg-white text-[13px] font-bold text-sk-navy transition-colors hover:border-sk-blue/40 hover:text-sk-blue"
          >
            Kumpulkan poin dari proyek
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ArenaDashboardMockup() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tourActive, setTourActive] = useState(true);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const activeStep = TOUR_STEPS[currentStepIndex];

  const clearSpotlight = useCallback(() => {
    document.body.classList.remove('tour-active');
    for (const el of document.querySelectorAll('[data-tour-target]')) {
      el.classList.remove('tour-spotlight');
    }
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, TOUR_STEPS.length - 1));
      setCurrentStepIndex(clamped);
      setTourActive(true);

      const step = TOUR_STEPS[clamped];
      document.body.classList.add('tour-active');
      for (const el of document.querySelectorAll('[data-tour-target]')) {
        el.classList.toggle('tour-spotlight', el.getAttribute('data-tour') === step.id);
      }
      const target = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      headingRef.current?.focus({ preventScroll: true });
    },
    [],
  );

  useEffect(() => {
    goToStep(0);
    return clearSpotlight;
  }, [goToStep, clearSpotlight]);

  useEffect(() => {
    if (!tourActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTourActive(false);
        clearSpotlight();
      } else if (e.key === 'ArrowRight' && currentStepIndex < TOUR_STEPS.length - 1) {
        goToStep(currentStepIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        goToStep(currentStepIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourActive, currentStepIndex, goToStep, clearSpotlight]);

  const activeEnrollment = mockOverview.history[0];
  const pastEnrollment = mockOverview.history[1];
  const deadlineDate = mockOverview.currentWeek?.submissionDeadlineAt ?? new Date().toISOString();

  return (
    <ParticipantProvider
      user={{
        id: 'user-demo',
        displayName: 'Alvin Pratama',
        email: 'peserta@sekolahkarir.id',
        avatarUrl: null,
        avatarId: 'avatar-4',
        isAdmin: false,
      }}
    >
      <div className="min-h-screen bg-sk-bg text-sk-navy pb-32">
        {/* Banner Simulasi 1:1 */}
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-sk-blue/20 bg-gradient-to-r from-sk-navy via-sk-navy-2 to-sk-blue px-4 py-2.5 text-white shadow-md sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 items-center gap-1.5 rounded-full bg-sk-blue px-2.5 text-[11px] font-bold tracking-wide uppercase">
              <Sparkles size={12} aria-hidden />
              Simulasi 1:1
            </span>
            <p className="text-[12.5px] font-medium text-slate-200">
              Ini adalah pratinjau tampilan nyata <span className="font-bold text-white">Dashboard Peserta Arena</span> saat kamu bertanding.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!tourActive && (
              <button
                type="button"
                onClick={() => goToStep(0)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
              >
                <Play size={12} fill="currentColor" />
                Mulai Tur Lagi
              </button>
            )}
            <Link
              href="/arena/projects"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-bold text-sk-blue shadow-xs hover:bg-sk-blue-wash transition-colors"
            >
              Mulai Bertanding
              <ArrowUpRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </div>

        {/* 1:1 CardChase Header Navigation */}
        <header className="sticky top-[45px] z-40 border-b border-[#F0F2F5] bg-white/95 backdrop-blur-md shadow-[0_1px_8px_rgba(15,23,42,0.03)]">
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <div className="flex shrink-0 items-center gap-2">
              <Image
                src="/logo-arena.png"
                alt="Side Hustle Arena by SekolahKarir"
                width={160}
                height={33}
                priority
                className="h-8 w-auto object-contain"
              />
            </div>

            {/* Menu Navigasi Capsule CardChase */}
            <div className="hidden md:flex items-center gap-0.5 rounded-full border border-[#E6EBF2] bg-[#EEF2F7] p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
              {['Ringkasan', 'Jelajahi proyek', 'Proyekku', 'Peringkat', 'Poin & hadiah'].map((tab, idx) => (
                <span
                  key={tab}
                  className={cn(
                    'relative flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
                    idx === 0 ? 'font-bold text-sk-navy' : 'font-semibold text-slate-500 hover:text-sk-navy',
                  )}
                >
                  {idx === 0 && (
                    <span className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]" />
                  )}
                  <span className="relative z-10">{tab}</span>
                </span>
              ))}
            </div>

            {/* Sisi Kanan: Poin Pill, Bell, Avatar */}
            <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              <div className="flex h-9 items-center gap-1.5 rounded-full border border-[#FDE6C8] bg-[#FFF9EE] px-3 text-[13px] font-bold text-sk-navy shadow-xs">
                <Coins size={14} className="text-amber-500" />
                <span className="font-mono tabular-nums">450</span>
                <span className="text-[11px] font-semibold text-amber-700">poin</span>
              </div>
              <div className="relative grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-sk-muted">
                <Bell size={16} />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-sk-blue ring-2 ring-white" />
              </div>
              <div className="flex items-center gap-2 pl-1">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-tr from-sk-blue to-sk-blue-400 font-bold text-white text-xs ring-2 ring-white shadow-xs">
                  AP
                </div>
                <span className="hidden sm:inline text-xs font-bold text-sk-navy">Alvin Pratama</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard 1:1 Body Container */}
        <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 md:pt-8 lg:px-8">
          <div className="min-w-0">
            {/* Row 1: Sprint Hero & Deadline Widget */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* TARGET 1: SPRINT HERO */}
              <div data-tour="sprint" data-tour-target className="rounded-[var(--radius-sk-3xl)]">
                <SprintHero
                  name="Alvin Pratama"
                  week={mockOverview.currentWeek}
                  active={activeEnrollment}
                  focus={{
                    label: 'Lanjutkan pengerjaan brief di workspace',
                    href: '#workspace',
                    progress: 60,
                    stage: 'Tahap 3 dari 5: Kerjakan proyek sesuai brief',
                    step: 'WORK',
                  }}
                />
              </div>

              {/* TARGET 2: DEADLINE CARD */}
              <div className="flex flex-col gap-5">
                <div data-tour="deadline" data-tour-target className="rounded-[var(--radius-sk-2xl)]">
                  <DeadlineCard
                    deadlineAt={deadlineDate}
                    href="#deadline"
                    dateLabel={participantDate}
                    progress={60}
                  />
                </div>

                <div className="rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-sk-violet-600">
                      Tangga Hadiah
                    </span>
                    <span className="text-[12px] font-bold text-sk-blue hover:underline">Detail</span>
                  </div>
                  <p className="mt-2 text-[15px] font-bold text-sk-navy">Target Berikutnya: 600 Poin</p>
                  <p className="mt-1 text-xs text-sk-muted">E-Book Banting Stir Karir & HR Interview Guide</p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sk-track">
                    <div className="h-full bg-gradient-to-r from-sk-violet to-sk-blue" style={{ width: '75%' }} />
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-sk-muted">Kurang 150 poin lagi</p>
                </div>
              </div>
            </div>

            {/* Stat Strip */}
            <div className="mt-8">
              <StatStrip data={mockOverview} />
            </div>

            {/* TARGET 3: TANGGA HADIAH (1:1 DENGAN SCREENSHOT USER) */}
            <section
              data-tour="tangga-hadiah"
              data-tour-target
              aria-labelledby="tangga-hadiah-title"
              className="relative mt-10 overflow-hidden rounded-[28px] border border-[#e3dcff] bg-[linear-gradient(135deg,#f6f2ff_0%,#eef4ff_52%,#fff8e8_100%)] p-5 sm:p-7 shadow-sm"
            >
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-sk-violet/15 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-[#ffd65c]/25 blur-3xl" />
              
              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-sk-violet-600">
                    Tangga hadiah
                  </span>
                  <h2 id="tangga-hadiah-title" className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[26px]">
                    Kumpulkan poin, buka hadiahnya
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-sk-muted">
                    Poin yang terkumpul membuka anak tangga berikutnya. Tiap hadiah diklaim satu kali memakai saldo poinmu.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3.5 py-2 font-mono text-[12px] font-bold text-sk-navy shadow-sk-xs">
                  <Coins size={14} aria-hidden className="text-sk-warning-ink" />
                  0 poin terkumpul
                </span>
              </div>

              <div className="relative mt-6 space-y-5">
                <div className="min-w-0 rounded-[var(--radius-sk-2xl)] bg-white/55 px-2 py-5 ring-1 ring-white/80 sm:px-4">
                  <RewardLadder ladder={mockLadder} balance={0} pending={null} onClaim={() => {}} />
                </div>
                <NextRewardCard
                  step={mockLadder.next}
                  description="Template workspace Notion lengkap untuk pelacakan lamaran kerja, portofolio proyek, dan template resume ATS-friendly."
                  lifetime={mockLadder.lifetimePoints}
                />
              </div>
            </section>

            {/* Row 2: Leaderboard & Proyek Lain */}
            <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              {/* TARGET 4: LEADERBOARD PREVIEW */}
              <section
                data-tour="leaderboard"
                data-tour-target
                aria-labelledby="leaderboard-title"
                className="rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-sk-blue">
                      <Trophy size={13} className="text-amber-500" />
                      Papan peringkat · MINGGU 38
                    </p>
                    <h2 id="leaderboard-title" className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy">
                      Peringkat minggu ini
                    </h2>
                  </div>
                  <span className="rounded-md bg-sk-success-tint px-2 py-0.5 font-mono text-[10px] font-bold text-sk-success uppercase">
                    Aktif
                  </span>
                </div>

                <div className="mt-6">
                  <Podium entries={mockPodium} size="md" label="Papan peringkat minggu 38" />
                </div>

                <div className="mt-6 border-t border-sk-border pt-4">
                  <div className="flex items-center justify-between rounded-xl bg-sk-blue-wash px-4 py-3 border border-sk-blue-tint-border">
                    <div className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-sk-blue text-xs font-bold text-white">
                        2
                      </span>
                      <div>
                        <p className="text-xs font-bold text-sk-navy">Alvin Pratama (Kamu)</p>
                        <p className="text-[11px] text-sk-muted">Desain Produk · Submisi Terverifikasi</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-sk-blue">92.0 Poin</p>
                      <p className="text-[10.5px] font-semibold text-emerald-600">+100 Bonus Poin</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Info Divisi & Arena Lain */}
              <section className="flex flex-col justify-between rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6 shadow-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-sk-blue">
                      Katalog Aktif
                    </span>
                    <span className="text-xs font-bold text-sk-blue">Lihat Semua</span>
                  </div>
                  <h3 className="mt-1 text-[20px] font-extrabold text-sk-navy">Pilihan Arena Lainnya</h3>
                  <p className="mt-1 text-xs text-sk-muted leading-relaxed">
                    Setiap minggu ada 6 divisi yang membuka brief simulasi kerja nyata.
                  </p>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-sk-border p-4 bg-sk-bg">
                      <span className="text-[10px] font-bold uppercase text-sk-blue">Data Analyst</span>
                      <h4 className="mt-1 font-bold text-sk-navy text-sm">Bersihkan data penjualan enam bulan</h4>
                      <p className="mt-1 text-xs text-sk-muted">Rapikan 12 ribu baris data kotor jadi satu tabel siap analisis.</p>
                    </div>
                    <div className="rounded-2xl border border-sk-border p-4 bg-sk-bg">
                      <span className="text-[10px] font-bold uppercase text-sk-violet-600">Copywriting</span>
                      <h4 className="mt-1 font-bold text-sk-navy text-sm">Tulis 5 varian iklan satu produk</h4>
                      <p className="mt-1 text-xs text-sk-muted">Tulis 5 angle berbeda untuk produk skincare lengkap dengan hipotesis.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-gradient-to-br from-sk-navy to-sk-navy-3 p-5 text-white">
                  <p className="text-xs font-bold text-sk-blue-400 uppercase tracking-wider">Tips Sukses Arena</p>
                  <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                    Pelajari rubrik penilaian sebelum mengunggah. Skor tertinggi diperoleh dengan menyertakan bukti kerja terstruktur.
                  </p>
                </div>
              </section>
            </div>

            {/* TARGET 5: RIWAYAT & REKAM JEJAK PORTOFOLIO */}
            <section
              data-tour="history"
              data-tour-target
              id="riwayat-section"
              className="mt-10 rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-6 sm:p-8 shadow-xs"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-sk-blue">
                    Rekam jejak
                  </span>
                  <h2 className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] text-sk-navy">
                    Riwayat Pertandingan & Portofolio Selesai
                  </h2>
                  <p className="mt-1 text-xs text-sk-muted">
                    Proyek yang selesai otomatis menghasilkan skor, poin, dan sertifikasi skill yang masuk ke Career Report.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-emerald-700 border border-emerald-200">
                  ✓ 1 Proyek Terverifikasi
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <EnrollmentCard enrollment={pastEnrollment} />
                <div className="flex flex-col items-center justify-center rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-border bg-sk-bg p-8 text-center">
                  <FolderOpen size={32} className="text-sk-faint" />
                  <p className="mt-3 font-bold text-sk-navy text-sm">Ambil Tantangan Minggu Depan</p>
                  <p className="mt-1 text-xs text-sk-muted max-w-[280px]">
                    Setiap hari Senin jam 09:00 WIB, brief proyek baru hadir untuk menambah koleksi portofoliomu.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* SPOTLIGHT TUTORIAL FLOATING CALLOUT CARD */}
        {tourActive && (
          <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[min(580px,calc(100vw-2rem))] sm:translate-x-[-50%] sm:px-0 sm:pb-0">
            <motion.div
              role="dialog"
              aria-modal="false"
              aria-labelledby="mockup-tour-title"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="rounded-[var(--radius-sk-2xl)] border-2 border-sk-blue bg-white p-5 shadow-[0_26px_70px_rgba(7,21,45,0.4)] sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sk-blue-tint px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-sk-blue-700 uppercase tracking-wide">
                  <Info size={12} strokeWidth={2.5} />
                  {activeStep.badge} · {currentStepIndex + 1}/{TOUR_STEPS.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTourActive(false);
                    clearSpotlight();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sk-muted hover:text-sk-navy transition-colors"
                >
                  <X size={14} strokeWidth={2.4} />
                  Tutup Tur
                </button>
              </div>

              <h2
                id="mockup-tour-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-3 text-[19px] font-extrabold tracking-[-0.025em] text-sk-navy focus-visible:outline-none sm:text-[21px]"
              >
                {activeStep.title}
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-sk-muted">{activeStep.body}</p>

              <div className="mt-5 flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                {currentStepIndex > 0 ? (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => goToStep(currentStepIndex - 1)}
                    iconLeft={<ArrowLeft size={15} strokeWidth={2.4} />}
                  >
                    Kembali
                  </Button>
                ) : (
                  <div />
                )}

                {/* Dots step indicator */}
                <div className="flex items-center gap-1.5" role="group" aria-label="Langkah tur">
                  {TOUR_STEPS.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToStep(idx)}
                      aria-label={`Langkah ${idx + 1}`}
                      className="grid min-h-8 min-w-8 place-items-center focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'h-2 rounded-full transition-all duration-200',
                          idx === currentStepIndex ? 'w-6 bg-sk-blue' : 'w-2 bg-slate-200 hover:bg-slate-300',
                        )}
                      />
                    </button>
                  ))}
                </div>

                {currentStepIndex === TOUR_STEPS.length - 1 ? (
                  <ButtonLink
                    href="/arena/projects"
                    size="md"
                    iconRight={<ArrowRight size={15} strokeWidth={2.4} />}
                  >
                    Mulai Bertanding
                  </ButtonLink>
                ) : (
                  <Button
                    size="md"
                    onClick={() => goToStep(currentStepIndex + 1)}
                    iconRight={<ArrowRight size={15} strokeWidth={2.4} />}
                  >
                    Lanjut
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </ParticipantProvider>
  );
}
