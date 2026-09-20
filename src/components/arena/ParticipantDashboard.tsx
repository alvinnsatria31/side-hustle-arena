'use client';

import Link from 'next/link';
import { ArrowRight, Bookmark, CalendarClock, Gift, LoaderCircle, LogOut, RefreshCw, Trophy } from 'lucide-react';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { useParticipant } from '@/features/arena/participant';
import { SignInButton } from '@/components/auth/SignInButton';
import { LogoutForm } from '@/components/auth/LogoutForm';
import { ArenaApiError } from '@/lib/arena-client';
import { getParticipantOverview, useParticipantResource, type ParticipantEnrollment, type ParticipantOverview } from '@/lib/participant-client';
import type { ReactNode } from 'react';
import { WHATSAPP_SUPPORT_URL } from '@/components/layout/FloatingWhatsApp';
import { dashboardFocus } from '@/lib/dashboard-view';
import { ProjectMiniVisual, motifForDivision } from '@/components/landing/ProjectMiniVisual';
import type { PublicArenaHome } from '@/lib/arena-view';

export function participantDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

export function ParticipantShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="min-w-0 [overflow-wrap:anywhere] [letter-spacing:0]">
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
      { label: 'Proyek selesai', value: data.completedProjects, color: 'text-sk-success' },
      { label: 'Kemampuan yang terbukti', value: data.provenSkills, color: 'text-sk-navy' },
    ].map(({ label, value, color }) => <div key={label}><dt className="text-xs text-sk-muted">{label}</dt><dd className={`mt-2 text-2xl font-extrabold ${color}`}>{value.toLocaleString('id-ID')}</dd></div>)}
  </dl>;
}

const stepLabels: Record<string, string> = { BRIEF: 'Brief', PLAN: 'Rencana', WORK: 'Pengerjaan', REVIEW: 'Pemeriksaan', SUBMIT: 'Pengiriman' };
const weekStatusLabels: Record<string, string> = {
  SCHEDULED: 'Dijadwalkan', PREVIEW: 'Segera dibuka', OPEN: 'Sedang dibuka',
  CLOSED: 'Ditutup', FINALIZING: 'Menunggu hasil akhir', FINALIZED: 'Selesai',
};

export function EnrollmentCard({ enrollment }: { enrollment: ParticipantEnrollment }) {
  const slug = encodeURIComponent(enrollment.project.slug);
  const submitted = Boolean(enrollment.submission?.latestVersionId);
  const voided = enrollment.status === 'VOIDED' || enrollment.submission?.status === 'VOIDED';
  const status = voided ? 'Dibatalkan' : enrollment.ranking ? 'Hasil tersedia' : !enrollment.sealed ? 'Tidak masuk peringkat' : submitted ? 'Menunggu hasil akhir' : 'Belum dikirim';
  const step = enrollment.workspace?.currentStep ?? 'BRIEF';
  return <article className="rounded-lg border border-sk-border bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-sk-muted">{enrollment.week.weekCode} / {enrollment.project.division}</span>
      <Badge variant={enrollment.ranking ? 'mint' : submitted ? 'amber' : 'slate'}>{status}</Badge>
    </div>
    <h2 className="mt-3 text-xl font-bold text-sk-navy">{enrollment.project.title}</h2>
    <div className="mt-3 flex items-start gap-2 text-xs text-sk-muted"><CalendarClock size={15} className="shrink-0" aria-hidden /><span>Batas pengumpulan {participantDate(enrollment.week.submissionDeadlineAt)} WIB</span></div>
    {enrollment.ranking ? <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-sk-success"><span>Peringkat #{enrollment.ranking.rank}</span><span>Skor {enrollment.ranking.finalScore}/100</span><span>+{enrollment.ranking.pointsAwarded} poin</span></div> : !submitted && !voided && enrollment.sealed ? <p className="mt-4 text-sm text-sk-body">Tahap tersimpan: <strong>{stepLabels[step] ?? step}</strong></p> : null}
    <div className="mt-5 flex flex-wrap gap-3">
      {!enrollment.sealed ? <ButtonLink size="sm" href={`/app/arena/result/${slug}`}>Lihat hasil</ButtonLink> : submitted ? <ButtonLink size="sm" href={`/app/arena/submission/${slug}`}>Lihat kiriman</ButtonLink> : !voided ? <ButtonLink size="sm" href={`/app/arena/workspace/${slug}`}>Lanjutkan proyek</ButtonLink> : null}
      <ButtonLink size="sm" variant="ghost" href={`/app/arena/projects/${slug}`}>Lihat brief</ButtonLink>
    </div>
  </article>;
}

export function EnrollmentHistory({ history }: { history: ParticipantOverview['history'] }) {
  return <section className="mt-8">
    <h2 className="mb-4 text-lg font-bold text-sk-navy">Riwayat proyek</h2>
    {history.length ? <div className="grid gap-4 md:grid-cols-2">{history.map((enrollment) => <EnrollmentCard key={enrollment.id} enrollment={enrollment} />)}</div> : <p className="py-5 text-sm text-sk-muted">Kamu belum mengerjakan proyek.</p>}
  </section>;
}

export function ParticipantLogout() {
  return <LogoutForm><Button type="submit" variant="ghost" iconLeft={<LogOut size={15} aria-hidden />}>Keluar</Button></LogoutForm>;
}

export default function ParticipantDashboard({ projects = [] }: { projects?: PublicArenaHome['projects'] }) {
  const user = useParticipant();
  const resource = useParticipantResource(getParticipantOverview);
  const data = resource.data;
  const active = data?.history.find((row) => row.id === data.currentEnrollmentId);
  const focus = active ? dashboardFocus(active) : null;
  const available = projects.filter((project) => project.slug !== active?.project.slug).slice(0, 2);
  return <ParticipantShell title={`Halo, ${user.displayName ?? 'Peserta'}.`} action={<RefreshButton refresh={resource.refresh} loading={resource.loading} />}>
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
    {data && !resource.loading && <>
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-3">
        <p className="text-[14px] text-sk-muted">Ayo tuntaskan langkah berikutnya di Arena.</p>
        {data.currentWeek && <Badge variant={data.currentWeek.canSelect ? 'mint' : 'slate'}>{data.currentWeek.title} · {weekStatusLabels[data.currentWeek.status] ?? data.currentWeek.status}</Badge>}
      </div>

      <section aria-label="Langkah berikutnya" className="relative overflow-hidden rounded-[var(--radius-sk-2xl)] bg-[#102544] p-6 text-white shadow-sk-lg sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(72,142,255,0.35),transparent_68%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#93baff]">{active ? 'Project aktifmu' : 'Langkah berikutnya'}</p>
            <h2 className="mt-3 text-[24px] font-extrabold tracking-[-0.035em] sm:text-[30px]">
              {active?.project.title ?? (data.currentWeek?.canSelect ? 'Pilih project untuk sprint ini.' : 'Siapkan langkahmu untuk sprint berikutnya.')}
            </h2>
            <p className="mt-2 max-w-[54ch] text-[13.5px] leading-relaxed text-[#c2d5ef]">
              {active ? `${focus?.stage}. Batas pengumpulan ${participantDate(active.week.submissionDeadlineAt)} WIB.` : data.currentWeek?.canSelect ? 'Baca brief yang tersedia, pilih yang sesuai arah kariermu, lalu mulai bekerja.' : 'Project baru akan muncul di sini saat sprint berikutnya dibuka.'}
            </p>
            <div className="mt-6">
              <ButtonLink href={focus?.href ?? '/app/arena/projects'} size="sm" className="rounded-full bg-white text-sk-blue hover:bg-sk-blue-tint" iconRight={<ArrowRight size={15} aria-hidden />}>
                {focus?.label ?? 'Jelajahi proyek'}
              </ButtonLink>
            </div>
          </div>
          {focus && <div className="grid h-24 w-24 flex-none place-items-center rounded-full p-2" style={{ background: `conic-gradient(#ffffff ${focus.progress}%, #4b78b5 ${focus.progress}% 100%)` }} aria-label={`Progres ${focus.progress} persen`}>
            <div className="grid h-full w-full place-items-center rounded-full bg-[#102544] font-mono text-[20px] font-bold">{focus.progress}%</div>
          </div>}
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          ['Poin tersedia', data.points.balance],
          ['Project selesai', data.completedProjects],
          ['Skill terbukti', data.provenSkills],
        ].map(([label, value]) => <div key={label} className="rounded-[var(--radius-sk-xl)] border border-sk-border bg-white p-5 shadow-sm"><dt className="text-[12px] font-medium text-sk-muted">{label}</dt><dd className="mt-2 font-mono text-[26px] font-bold tracking-[-0.04em] text-sk-navy">{(value as number).toLocaleString('id-ID')}</dd></div>)}
      </dl>

      <section className="mt-10" aria-labelledby="dashboard-projects-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow">Minggu ini</p><h2 id="dashboard-projects-title" className="mt-2 text-[22px] font-extrabold tracking-[-0.03em] text-sk-navy">Jelajahi project lain</h2></div>
          <Link href="/app/arena/projects" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline">Lihat semua <ArrowRight size={15} aria-hidden /></Link>
        </div>
        {available.length > 0 ? <div className="grid gap-4 md:grid-cols-2">{available.map((project) => <Link key={project.slug} href={`/app/arena/projects/${encodeURIComponent(project.slug)}`} className="group overflow-hidden rounded-[var(--radius-sk-xl)] border border-sk-border bg-white transition-all hover:-translate-y-1 hover:border-sk-blue-tint-border hover:shadow-sk-md focus-visible:outline-2 focus-visible:outline-sk-blue">
          <div className="h-32 overflow-hidden border-b border-sk-border"><ProjectMiniVisual motif={motifForDivision(project.categorySlug, project.category)} /></div>
          <div className="p-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sk-blue-700">{project.category}</p><h3 className="mt-2 text-[16px] font-bold text-sk-navy">{project.title}</h3><p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-sk-muted">{project.deliverable}</p><span className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-sk-blue">Lihat brief <ArrowRight size={13} aria-hidden /></span></div>
        </Link>)}</div> : <div className="rounded-[var(--radius-sk-xl)] border border-dashed border-sk-border bg-white p-6 text-[13px] text-sk-muted">Belum ada project lain yang dibuka minggu ini.</div>}
      </section>

      <section id="proyekku" className="mt-10 scroll-mt-24" aria-labelledby="dashboard-history-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><h2 id="dashboard-history-title" className="text-[22px] font-extrabold tracking-[-0.03em] text-sk-navy">Proyekku</h2><Link href="/app/arena/my-projects" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline">Lihat riwayat <ArrowRight size={15} aria-hidden /></Link></div>
        {data.history.filter((row) => row.id !== active?.id).length > 0 ? <div className="grid gap-4 md:grid-cols-2">{data.history.filter((row) => row.id !== active?.id).slice(0, 2).map((row) => <EnrollmentCard key={row.id} enrollment={row} />)}</div> : <div className="rounded-[var(--radius-sk-xl)] border border-dashed border-sk-border bg-white p-6 text-[13px] text-sk-muted">Project yang kamu kerjakan akan tercatat di sini.</div>}
      </section>

      <div className="mt-10 flex flex-wrap gap-3"><ButtonLink href="/app/arena/leaderboard" variant="ghost" size="sm" iconLeft={<Trophy size={15} aria-hidden />}>Peringkat</ButtonLink><ButtonLink href="/app/profile#rewards" variant="ghost" size="sm" iconLeft={<Gift size={15} aria-hidden />}>Poin & hadiah</ButtonLink><ButtonLink href="/app/arena/projects?view=saved" variant="ghost" size="sm" iconLeft={<Bookmark size={15} aria-hidden />}>Tersimpan</ButtonLink></div>
      <p className="mt-8 text-[12px] text-sk-muted">Butuh bantuan? <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-sk-blue hover:underline">Hubungi WhatsApp CS</a>.</p>
    </>}
  </ParticipantShell>;
}
