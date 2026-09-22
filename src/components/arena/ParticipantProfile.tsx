'use client';

import Link from 'next/link';
import { Gift } from 'lucide-react';
import { useParticipant } from '@/features/arena/participant';
import { Badge } from '@/components/primitives/Badge';
import { AvatarChooser } from '@/components/arena/AvatarChooser';
import { PrivacyControls } from '@/components/arena/PrivacyControls';
import { REWARDS_PATH } from '@/components/layout/nav-links';
import { getParticipantOverview, useParticipantResource } from '@/lib/participant-client';
import { presentSkillEvidence } from '@/lib/skill-evidence-label';
import { EnrollmentHistory, ParticipantLogout, ParticipantShell, ParticipantStats, RefreshButton, ResourceState } from './ParticipantDashboard';

export default function ParticipantProfile() {
  const user = useParticipant();
  const resource = useParticipantResource(getParticipantOverview);
  const data = resource.data;

  return <ParticipantShell title="Profil" action={<RefreshButton refresh={() => void resource.refresh()} loading={resource.loading} />}>
    <div className="flex flex-wrap items-center gap-4 border-b border-sk-border pb-6">
      <AvatarChooser />
      <div className="min-w-0 flex-1"><h2 className="text-xl font-bold text-sk-navy">{user.displayName ?? 'Peserta'}</h2><p className="mt-1 break-all text-sm text-sk-muted">{user.email ?? 'Email belum tersedia'}</p></div>
      <ParticipantLogout />
    </div>
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
    {data && !resource.loading && <ParticipantStats data={data} />}
    {/* Claims, the reward ladder and the claim history live on their own page
        now; this card keeps the old "#rewards" entry point one tap away. */}
    <section id="rewards" className="mt-8 scroll-mt-24">
      <Link
        href={REWARDS_PATH}
        className="card-rise group flex flex-wrap items-center gap-4 rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue"
      >
        <span aria-hidden className="grid h-12 w-12 place-items-center rounded-2xl bg-sk-violet-tint text-sk-violet"><Gift size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-sk-navy">Poin &amp; hadiah</span>
          <span className="mt-0.5 block text-[13px] text-sk-muted">Klaim hadiah tangga, tukar poin di katalog, dan lihat riwayat hadiahmu.</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-sk-blue">Buka</span>
      </Link>
    </section>
    {data && !resource.loading && <>
      <section className="mt-8"><h2 className="mb-4 text-lg font-bold text-sk-navy">Bukti kemampuan</h2>
        {data.skillEvidence.length === 0 ? <p className="py-4 text-sm text-sk-muted">Bukti kemampuanmu akan muncul setelah hasil proyek dinilai.</p> : <ul className="grid gap-4 md:grid-cols-2">{data.skillEvidence.map((item) => { const view = presentSkillEvidence(item); return <li key={item.id} className="rounded-lg border border-sk-border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><h3 className="font-bold text-sk-navy">{item.name}</h3><div className="text-right"><span className={view.measured ? 'font-semibold text-sk-success' : 'text-sm font-semibold text-sk-body'}>{view.scoreText}</span><p className="text-xs text-sk-muted">{view.scoreLabel}</p></div></div>{view.badge && <Badge className="mt-2" variant="slate">{view.badge}</Badge>}{view.note && <p className="mt-2 text-xs leading-relaxed text-sk-muted">{view.note}</p>}{item.summary && <p className="mt-2 text-sm text-sk-body">{item.summary}</p>}<Link className="mt-3 block text-sm text-sk-blue hover:underline" href={`/app/arena/result/${encodeURIComponent(item.projectSlug)}`}>{item.projectTitle} / {item.weekCode}</Link></li>; })}</ul>}
      </section>
      <EnrollmentHistory history={data.history} />
    </>}
    <PrivacyControls />
  </ParticipantShell>;
}
