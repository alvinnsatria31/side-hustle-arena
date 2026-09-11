'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import { useParticipant } from '@/features/arena/participant';
import { Button } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { AvatarChooser } from '@/components/arena/AvatarChooser';
import { PrivacyControls } from '@/components/arena/PrivacyControls';
import { RewardProgress } from '@/components/arena/MilestoneRoadmap';
import { getParticipantMilestones, getParticipantOverview, takeParticipantReward, useParticipantResource } from '@/lib/participant-client';
import { presentSkillEvidence } from '@/lib/skill-evidence-label';
import { EnrollmentHistory, ParticipantLogout, ParticipantShell, ParticipantStats, RefreshButton, ResourceState, participantDate } from './ParticipantDashboard';

export default function ParticipantProfile() {
  const user = useParticipant();
  const resource = useParticipantResource(getParticipantOverview);
  const rewards = useParticipantResource(getParticipantMilestones);
  const claiming = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const data = resource.data;
  const refresh = () => { void resource.refresh(); void rewards.refresh(); };

  async function claim(slug: string, retryOf: string | null) {
    if (claiming.current) return;
    claiming.current = true;
    setPending(slug);
    setError(null);
    setMessage('');
    try {
      const { taken } = await takeParticipantReward(slug, retryOf);
      setMessage(taken.delivery?.status === 'DELIVERED'
        ? 'Reward berhasil diklaim. Kode vouchermu sudah ada di Riwayat reward di bawah.'
        : taken.delivery?.status === 'MANUAL_REQUIRED'
          ? 'Reward berhasil diklaim. Kode voucher sedang disiapkan tim dan akan muncul di Riwayat reward.'
          : 'Reward berhasil diklaim.');
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Klaim belum berhasil.'));
    } finally {
      await Promise.all([resource.refresh(), rewards.refresh()]);
      claiming.current = false;
      setPending(null);
    }
  }

  return <ParticipantShell title="Profile" action={<RefreshButton refresh={refresh} loading={resource.loading || rewards.loading} />}>
    <div className="flex flex-wrap items-center gap-4 border-b border-sk-border pb-6">
      <AvatarChooser />
      <div className="min-w-0 flex-1"><h2 className="text-xl font-bold text-sk-navy">{user.displayName ?? 'Peserta'}</h2><p className="mt-1 break-all text-sm text-sk-muted">{user.email ?? 'Email belum tersedia'}</p></div>
      <ParticipantLogout />
    </div>
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
    {data && !resource.loading && <ParticipantStats data={data} />}
    <section id="rewards" className="mt-8 scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-sk-navy"><Gift size={20} aria-hidden />Reward</h2>
      {message && <p role="status" className="mb-4 text-sm text-sk-success">{message}</p>}
      {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error.message}</p>}
      <ResourceState loading={rewards.loading} error={rewards.error} retry={rewards.refresh} />
      {rewards.data && !rewards.loading && rewards.data.ladder.steps.length > 0 && <RewardProgress lifetimePoints={rewards.data.ladder.lifetimePoints} balance={data?.points.balance} steps={rewards.data.ladder.steps} className="mb-5" />}
      {rewards.data && !rewards.loading && <div className="divide-y divide-sk-border border-y border-sk-border">
        {rewards.data.ladder.steps.length === 0 && <p className="py-5 text-sm text-sk-muted">Belum ada reward tersedia.</p>}
        {rewards.data.ladder.steps.map((step) => <div key={step.slug} className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="min-w-0"><h3 className="font-semibold text-sk-navy">{step.title}</h3><p className="mt-1 text-sm text-sk-muted">{step.pointsRequired.toLocaleString('id-ID')} poin{step.outOfStock && step.state === 'locked' ? ' · stok periode ini habis' : ''}</p></div>
          {step.state === 'taken'
            ? <Badge variant="mint">Sudah diklaim</Badge>
            : step.state === 'out_of_stock'
              ? <Button size="sm" variant="ghost" disabled iconLeft={<Gift size={15} aria-hidden />}>Stok habis</Button>
              : <Button size="sm" variant={step.state === 'ready' ? 'primary' : 'ghost'} disabled={step.state !== 'ready' || !data || resource.loading || data.points.balance < step.pointsRequired || pending !== null} loading={pending === step.slug} onClick={() => void claim(step.slug, step.retryOf)} iconLeft={<Gift size={15} aria-hidden />}>{step.state === 'ready' ? (step.retryOf ? 'Klaim ulang' : 'Klaim reward') : `Kurang ${step.deficit.toLocaleString('id-ID')} poin`}</Button>}
        </div>)}
      </div>}
    </section>
    {data && !resource.loading && <>
      <section className="mt-8"><h2 className="mb-4 text-lg font-bold text-sk-navy">Riwayat reward</h2>
        {data.redemptions.length === 0 ? <p className="py-4 text-sm text-sk-muted">Belum ada reward diklaim.</p> : <ul className="divide-y divide-sk-border">{data.redemptions.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-3 py-4"><div className="min-w-0"><h3 className="font-semibold text-sk-navy">{item.title}</h3><p className="mt-1 text-xs text-sk-muted">{participantDate(item.redeemedAt)} WIB / {item.pointsSpent} poin</p>{item.fulfilledAt && <p className="mt-1 text-xs text-sk-success">Selesai {participantDate(item.fulfilledAt)} WIB</p>}{item.deliveryNote && <p className="mt-2 whitespace-pre-line break-words text-sm text-sk-body"><span className="font-semibold text-sk-navy">Catatan penyerahan:</span> {item.deliveryNote}</p>}</div><Badge className="self-start" variant={item.status === 'FULFILLED' ? 'mint' : item.status === 'FAILED' || item.status === 'ADMIN_REVERSED' ? 'slate' : 'amber'}>{({ PENDING: 'Menunggu', PROCESSING: 'Diproses', FULFILLED: 'Selesai', FAILED: 'Gagal', ADMIN_REVERSED: 'Dikembalikan' } as Record<string, string>)[item.status] ?? item.status}</Badge></li>)}</ul>}
      </section>
      <section className="mt-8"><h2 className="mb-4 text-lg font-bold text-sk-navy">Bukti skill</h2>
        {data.skillEvidence.length === 0 ? <p className="py-4 text-sm text-sk-muted">Belum ada bukti skill terfinalisasi.</p> : <ul className="grid gap-4 md:grid-cols-2">{data.skillEvidence.map((item) => { const view = presentSkillEvidence(item); return <li key={item.id} className="rounded-lg border border-sk-border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><h3 className="font-bold text-sk-navy">{item.name}</h3><div className="text-right"><span className={view.measured ? 'font-semibold text-sk-success' : 'text-sm font-semibold text-sk-body'}>{view.scoreText}</span><p className="text-xs text-sk-muted">{view.scoreLabel}</p></div></div>{view.badge && <Badge className="mt-2" variant="slate">{view.badge}</Badge>}{view.note && <p className="mt-2 text-xs leading-relaxed text-sk-muted">{view.note}</p>}{item.summary && <p className="mt-2 text-sm text-sk-body">{item.summary}</p>}<Link className="mt-3 block text-sm text-sk-blue hover:underline" href={`/app/arena/result/${encodeURIComponent(item.projectSlug)}`}>{item.projectTitle} / {item.weekCode}</Link></li>; })}</ul>}
      </section>
      <EnrollmentHistory history={data.history} />
    </>}
    <PrivacyControls />
  </ParticipantShell>;
}
