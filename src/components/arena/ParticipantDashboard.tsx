'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarClock, Gift, LayoutGrid, LoaderCircle, LogOut, RefreshCw, Trophy, UserRound } from 'lucide-react';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { useParticipant } from '@/features/arena/participant';
import { SignInButton } from '@/components/auth/SignInButton';
import { MilestoneRoadmap, RewardProgress } from '@/components/arena/MilestoneRoadmap';
import { ArenaApiError } from '@/lib/arena-client';
import { getParticipantMilestones, getParticipantOverview, useParticipantResource, type ParticipantEnrollment, type ParticipantOverview } from '@/lib/participant-client';
import type { ReactNode } from 'react';

export function participantDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

export function ParticipantNav() {
  const pathname = usePathname();
  return <nav aria-label="Navigasi peserta" className="mb-7 flex flex-wrap gap-x-5 gap-y-3 border-b border-sk-border pb-4 text-sm">
    {[
      { href: '/app', label: 'Dashboard', Icon: LayoutGrid },
      { href: '/app/arena', label: 'Arena', Icon: Trophy },
      { href: '/app/arena/leaderboard', label: 'Leaderboard', Icon: Trophy },
      { href: '/app/notifications', label: 'Inbox', Icon: Bell },
      { href: '/app/profile', label: 'Profile', Icon: UserRound },
    ].map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={`inline-flex items-center gap-2 py-1 font-semibold ${pathname === href ? 'text-sk-blue' : 'text-sk-muted hover:text-sk-blue'}`}><Icon size={15} aria-hidden />{label}</Link>)}
  </nav>;
}

export function ParticipantShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="min-w-0 [overflow-wrap:anywhere] [letter-spacing:0]">
    <ParticipantNav />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-extrabold text-sk-navy sm:text-3xl">{title}</h1>
      {action}
    </div>
    {children}
  </div>;
}

export function ResourceState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
  if (error) return <div role="alert" className="my-5 border-l-2 border-sk-error bg-sk-error-wash p-5">
    <p className="mb-3 text-sm text-sk-error">{error instanceof ArenaApiError && error.status === 401 ? 'Sesi kamu berakhir. Silakan masuk kembali.' : error.message}</p>
    {error instanceof ArenaApiError && error.status === 401 ? <SignInButton size="sm" fullWidth={false} label="Masuk kembali" /> : <Button onClick={retry} size="sm" variant="ghost" iconLeft={<RefreshCw size={14} aria-hidden />}>Coba lagi</Button>}
  </div>;
  if (loading) return <div role="status" className="flex min-h-32 items-center justify-center gap-3 text-sm text-sk-muted"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={20} aria-hidden />Memuat data...</div>;
  return null;
}

export function RefreshButton({ refresh, loading }: { refresh: () => void; loading: boolean }) {
  return <Button variant="ghost" size="sm" title="Perbarui data" aria-label="Perbarui data" disabled={loading} onClick={refresh} iconLeft={<RefreshCw size={15} aria-hidden />} />;
}

export function ParticipantStats({ data }: { data: ParticipantOverview }) {
  return <dl className="my-7 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-sk-border py-6 lg:grid-cols-4">
    {[
      { label: 'Poin tersedia', value: data.points.balance, color: 'text-sk-blue' },
      { label: 'Total poin diperoleh', value: data.points.lifetimeEarned, color: 'text-sk-navy' },
      { label: 'Project selesai', value: data.completedProjects, color: 'text-sk-success' },
      { label: 'Skill terbukti', value: data.provenSkills, color: 'text-sk-navy' },
    ].map(({ label, value, color }) => <div key={label}><dt className="text-xs text-sk-muted">{label}</dt><dd className={`mt-2 text-2xl font-extrabold ${color}`}>{value.toLocaleString('id-ID')}</dd></div>)}
  </dl>;
}

const stepLabels: Record<string, string> = { BRIEF: 'Brief', PLAN: 'Plan', WORK: 'Work', REVIEW: 'Review', SUBMIT: 'Submit' };

export function EnrollmentCard({ enrollment }: { enrollment: ParticipantEnrollment }) {
  const slug = encodeURIComponent(enrollment.project.slug);
  const submitted = Boolean(enrollment.submission?.latestVersionId);
  const voided = enrollment.status === 'VOIDED' || enrollment.submission?.status === 'VOIDED';
  const status = voided ? 'Dibatalkan' : enrollment.ranking ? 'Result tersedia' : !enrollment.sealed ? 'Tidak masuk ranking' : submitted ? 'Menunggu finalisasi' : 'Belum submit';
  const step = enrollment.workspace?.currentStep ?? 'BRIEF';
  return <article className="rounded-lg border border-sk-border bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-sk-muted">{enrollment.week.weekCode} / {enrollment.project.division}</span>
      <Badge variant={enrollment.ranking ? 'mint' : submitted ? 'amber' : 'slate'}>{status}</Badge>
    </div>
    <h2 className="mt-3 text-xl font-bold text-sk-navy">{enrollment.project.title}</h2>
    <div className="mt-3 flex items-start gap-2 text-xs text-sk-muted"><CalendarClock size={15} className="shrink-0" aria-hidden /><span>Deadline {participantDate(enrollment.week.submissionDeadlineAt)} WIB</span></div>
    {enrollment.ranking ? <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-sk-success"><span>Rank #{enrollment.ranking.rank}</span><span>Skor {enrollment.ranking.finalScore}/100</span><span>+{enrollment.ranking.pointsAwarded} poin</span></div> : !submitted && !voided && enrollment.sealed ? <p className="mt-4 text-sm text-sk-body">Tahap tersimpan: <strong>{stepLabels[step] ?? step}</strong></p> : null}
    <div className="mt-5 flex flex-wrap gap-3">
      {!enrollment.sealed ? <ButtonLink size="sm" href={`/app/arena/result/${slug}`}>Lihat Result</ButtonLink> : submitted ? <ButtonLink size="sm" href={`/app/arena/submission/${slug}`}>Lihat Submission</ButtonLink> : !voided ? <ButtonLink size="sm" href={`/app/arena/workspace/${slug}`}>Buka Workspace</ButtonLink> : null}
      <ButtonLink size="sm" variant="ghost" href={`/app/arena/projects/${slug}`}>Lihat Brief</ButtonLink>
    </div>
  </article>;
}

export function EnrollmentHistory({ history }: { history: ParticipantOverview['history'] }) {
  return <section className="mt-8">
    <h2 className="mb-4 text-lg font-bold text-sk-navy">Riwayat project</h2>
    {history.length ? <div className="grid gap-4 md:grid-cols-2">{history.map((enrollment) => <EnrollmentCard key={enrollment.id} enrollment={enrollment} />)}</div> : <p className="py-5 text-sm text-sk-muted">Belum ada riwayat project.</p>}
  </section>;
}

export function ParticipantLogout() {
  return <form action="/auth/logout" method="post"><Button type="submit" variant="ghost" iconLeft={<LogOut size={15} aria-hidden />}>Keluar</Button></form>;
}

/** The reward ladder with the participant's own progress, on the Arena page. */
function ArenaRewardLadder({ balance }: { balance: number }) {
  const rewards = useParticipantResource(getParticipantMilestones);
  const ladder = rewards.data?.ladder;
  return <section aria-labelledby="arena-rewards-title" className="mb-8">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 id="arena-rewards-title" className="flex items-center gap-2 text-lg font-bold text-sk-navy"><Gift size={20} aria-hidden />Hadiah &amp; milestone</h2>
      <ButtonLink href="/app/profile#rewards" size="sm" variant="ghost">Tukar poin</ButtonLink>
    </div>
    {rewards.error
      ? <p className="text-sm text-sk-muted">Milestone belum bisa dimuat. Coba perbarui halaman.</p>
      : !ladder
        ? null
        : ladder.steps.length === 0
          ? <p className="text-sm text-sk-muted">Belum ada hadiah aktif.</p>
          : <>
            <RewardProgress lifetimePoints={ladder.lifetimePoints} balance={balance} steps={ladder.steps} className="mb-5" />
            <MilestoneRoadmap steps={ladder.steps} points={ladder.lifetimePoints} />
          </>}
  </section>;
}

export default function ParticipantDashboard({ arena = false }: { arena?: boolean }) {
  const user = useParticipant();
  const resource = useParticipantResource(getParticipantOverview);
  const data = resource.data;
  const active = data?.history.find((row) => row.id === data.currentEnrollmentId);
  return <ParticipantShell title={arena ? 'Side Hustle Arena' : `Halo, ${user.displayName ?? 'Peserta'}`} action={<RefreshButton refresh={resource.refresh} loading={resource.loading} />}>
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
    {data && !resource.loading && <>
      {data.currentWeek && <div className="mb-4 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-sk-body">{data.currentWeek.title}</span><Badge variant={data.currentWeek.canSelect ? 'mint' : 'slate'}>{data.currentWeek.status}</Badge></div>}
      {active ? <EnrollmentCard enrollment={active} /> : <section className="border-y border-sk-border py-7">
        <h2 className="mb-4 text-lg font-bold text-sk-navy">{data.currentWeek?.canSelect ? 'Belum ada project dipilih minggu ini' : data.currentWeek ? 'Pendaftaran project belum tersedia' : 'Belum ada minggu Arena tersedia'}</h2>
        <ButtonLink href="/app/arena/projects" iconLeft={<LayoutGrid size={15} aria-hidden />}>Lihat Project</ButtonLink>
      </section>}
      <ParticipantStats data={data} />
      {arena && <ArenaRewardLadder balance={data.points.balance} />}
      <div className="flex flex-wrap gap-3"><ButtonLink href="/app/arena/projects" variant="ghost">Semua Project</ButtonLink><ButtonLink href="/app/arena/leaderboard" variant="ghost" iconLeft={<Trophy size={15} aria-hidden />}>Leaderboard</ButtonLink><ButtonLink href="/app/profile#rewards" variant="ghost">Reward</ButtonLink></div>
      <EnrollmentHistory history={data.history.filter((row) => row.id !== active?.id)} />
    </>}
  </ParticipantShell>;
}
