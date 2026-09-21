'use client';

import Link from 'next/link';
import { ArrowRight, Compass, FolderOpen, LoaderCircle, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { useParticipant } from '@/features/arena/participant';
import { SignInButton } from '@/components/auth/SignInButton';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { ArenaApiError } from '@/lib/arena-client';
import {
  getParticipantOverview,
  useParticipantResource,
  type ParticipantOverview,
} from '@/lib/participant-client';
import type { ReactNode } from 'react';
import { dashboardFocus, enrollmentStatus } from '@/lib/dashboard-view';
import { EnrollmentCard } from '@/components/arena/dashboard/EnrollmentCard';
import { DashboardSkeleton } from '@/components/arena/dashboard/DashboardSkeleton';
import { EmptyState } from '@/components/arena/dashboard/EmptyState';
import { ProjectPeekCard } from '@/components/arena/dashboard/ProjectPeekCard';
import { QuickActions } from '@/components/arena/dashboard/QuickActions';
import { SprintHero } from '@/components/arena/dashboard/SprintHero';
import { DeadlineCard } from '@/components/arena/dashboard/DeadlineCard';
import { RewardPreviewCard } from '@/components/arena/dashboard/RewardPreviewCard';
import { StatStrip } from '@/components/arena/dashboard/StatStrip';
import { LeaderboardPreview } from '@/components/arena/dashboard/LeaderboardPreview';
import { Reveal } from '@/components/motion/Reveal';
import type { PublicArenaHome } from '@/lib/arena-view';
import { cn } from '@/lib/cn';

export { EnrollmentCard };

export function participantDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

export function ParticipantShell({
  title,
  children,
  action,
  subtitle,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0 [overflow-wrap:anywhere] [letter-spacing:0]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-[-0.035em] text-sk-navy sm:text-[32px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-sk-muted">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: Error | null;
  retry: () => void;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="my-5 flex flex-wrap items-center gap-4 rounded-[var(--radius-sk-xl)] border border-sk-error-border bg-sk-error-wash p-5"
      >
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-sk-error">
          {error instanceof ArenaApiError && error.status === 401
            ? 'Sesi kamu berakhir. Silakan masuk kembali.'
            : error.message}
        </p>
        {error instanceof ArenaApiError && error.status === 401 ? (
          <SignInButton size="sm" fullWidth={false} label="Masuk kembali" />
        ) : (
          <Button
            onClick={retry}
            size="sm"
            variant="ghost"
            iconLeft={<RefreshCw size={14} aria-hidden />}
          >
            Coba lagi
          </Button>
        )}
      </div>
    );
  if (loading)
    return (
      <div
        role="status"
        className="flex min-h-32 items-center justify-center gap-3 text-sm text-sk-muted"
      >
        <LoaderCircle className="animate-spin motion-reduce:animate-none" size={20} aria-hidden />
        Memuat data...
      </div>
    );
  return null;
}

export function RefreshButton({ refresh, loading }: { refresh: () => void; loading: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title="Perbarui data"
      aria-label="Perbarui data"
      disabled={loading}
      onClick={refresh}
      className="h-11 w-11 px-0"
      iconLeft={<RefreshCw size={16} aria-hidden className={cn(loading && 'anim-spin')} />}
    />
  );
}

export function ParticipantStats({ data }: { data: ParticipantOverview }) {
  return (
    <dl className="my-7 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-sk-border py-6 lg:grid-cols-4">
      {[
        {
          label: 'Poin tersedia',
          value: data.points.balance,
          color: 'text-sk-blue',
        },
        {
          label: 'Total poin diperoleh',
          value: data.points.lifetimeEarned,
          color: 'text-sk-navy',
        },
        {
          label: 'Proyek selesai',
          value: data.completedProjects,
          color: 'text-sk-success',
        },
        {
          label: 'Kemampuan yang terbukti',
          value: data.provenSkills,
          color: 'text-sk-navy',
        },
      ].map(({ label, value, color }) => (
        <div key={label}>
          <dt className="text-xs text-sk-muted">{label}</dt>
          <dd className={`mt-2 font-mono text-[26px] font-bold tracking-[-0.04em] ${color}`}>
            {value.toLocaleString('id-ID')}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EnrollmentHistory({ history }: { history: ParticipantOverview['history'] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-[19px] font-extrabold tracking-[-0.03em] text-sk-navy">
        Riwayat proyek
      </h2>
      {history.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {history.map((enrollment) => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="Belum ada riwayat"
          body="Proyek yang kamu selesaikan akan tercatat di sini lengkap dengan skor dan poinnya."
          action={{ label: 'Jelajahi proyek', href: '/app/arena/projects' }}
        />
      )}
    </section>
  );
}

export function ParticipantLogout() {
  return (
    <LogoutForm>
      <Button type="submit" variant="ghost" iconLeft={<LogOut size={15} aria-hidden />}>
        Keluar
      </Button>
    </LogoutForm>
  );
}

/** Section header: a title on the left, the "see everything" link on the right. */
function SectionHead({
  id,
  eyebrow,
  title,
  link,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  link: { label: string; href: string };
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2
          id={id}
          className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-sk-navy sm:text-[22px]"
        >
          {title}
        </h2>
      </div>
      <Link
        href={link.href}
        className="inline-flex h-11 items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
      >
        {link.label}
        <ArrowRight size={15} aria-hidden />
      </Link>
    </div>
  );
}

/**
 * The participant dashboard.
 *
 * It answers three questions in that order: what do I do next and by when
 * (the hero), how am I doing (the tiles), and what else is open (the two
 * project sections). Everything below the hero is secondary by construction —
 * one dark panel, then flat white cards — so the next action never competes
 * with a stat for attention.
 *
 * Stale data stays on screen through a refresh. The previous version gated the
 * whole body on `!loading`, and since the hook refetches on every window focus,
 * tabbing back to the Arena collapsed the page to a spinner and then re-expanded
 * it — a full-height layout shift for data that almost always came back
 * identical.
 */
export default function ParticipantDashboard({
  projects = [],
}: {
  projects?: PublicArenaHome['projects'];
}) {
  const user = useParticipant();
  const resource = useParticipantResource(getParticipantOverview);
  const data = resource.data;
  const active = data?.history.find((row) => row.id === data.currentEnrollmentId) ?? null;
  const focus = active ? dashboardFocus(active) : null;
  const available = projects.filter((project) => project.slug !== active?.project.slug).slice(0, 2);
  const past = (data?.history ?? []).filter((row) => row.id !== active?.id).slice(0, 2);
  // A countdown only means something while there is still work to hand in:
  // an enrollment in progress, or an open week with nothing picked yet.
  const counting = active ? enrollmentStatus(active).tone === 'active' : Boolean(data?.currentWeek?.canSelect);
  const deadline = counting ? (active?.week.submissionDeadlineAt ?? data?.currentWeek?.submissionDeadlineAt ?? null) : null;
  const deadlineHref = focus?.href ?? '/app/arena/projects';

  return (
    <div className="min-w-0 [overflow-wrap:anywhere] [letter-spacing:0]">
      <ResourceState loading={false} error={resource.error} retry={resource.refresh} />
      {!data ? (
        resource.error ? null : (
          <DashboardSkeleton />
        )
      ) : (
        <div
          aria-busy={resource.loading}
          className={cn('transition-opacity duration-200', resource.loading && 'opacity-60')}
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SprintHero name={user.displayName ?? 'Peserta'} week={data.currentWeek} active={active} focus={focus} />
            <div className="flex flex-col gap-5">
              {deadline && (
                <DeadlineCard
                  deadlineAt={deadline}
                  href={deadlineHref}
                  dateLabel={participantDate}
                  progress={active ? focus?.progress ?? null : null}
                />
              )}
              <RewardPreviewCard />
            </div>
          </div>

          <div className="mt-10">
            <StatStrip data={data} />
          </div>

          <Reveal className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <LeaderboardPreview history={data.history} />

            <section aria-labelledby="dashboard-projects-title">
              <SectionHead
                id="dashboard-projects-title"
                eyebrow="Minggu ini"
                title="Arena lain"
                link={{ label: 'Lihat semua', href: '/app/arena/projects' }}
              />
              {available.length ? (
                <div className="flex flex-col gap-3">
                  {available.map((project) => (
                    <ProjectPeekCard key={project.slug} project={project} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Compass}
                  title="Belum ada proyek lain minggu ini"
                  body="Sprint berikutnya membuka brief baru. Sementara itu, cek katalog lengkapnya."
                  action={{ label: 'Buka katalog', href: '/app/arena/projects' }}
                />
              )}
            </section>
          </Reveal>

          <section
            id="proyekku"
            className="mt-10 scroll-mt-24"
            aria-labelledby="dashboard-history-title"
          >
            <SectionHead
              id="dashboard-history-title"
              eyebrow="Rekam jejak"
              title="Riwayat pertandingan"
              link={{ label: 'Lihat riwayat', href: '/app/arena/my-projects' }}
            />
            {past.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {past.map((row) => (
                  <EnrollmentCard key={row.id} enrollment={row} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="Proyek pertamamu belum selesai"
                body="Begitu satu sprint kelar, skor, poin dan skill yang terbukti muncul di sini."
                action={{
                  label: 'Mulai satu proyek',
                  href: '/app/arena/projects',
                }}
              />
            )}
          </section>

          <QuickActions />
        </div>
      )}
    </div>
  );
}
