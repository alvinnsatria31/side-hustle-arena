'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { EnrollmentCard, EnrollmentHistory, ParticipantShell, RefreshButton, ResourceState } from '@/components/arena/ParticipantDashboard';
import { getParticipantOverview, useParticipantResource } from '@/lib/participant-client';

export default function MyProjectsPage() {
  const resource = useParticipantResource(getParticipantOverview);
  const data = resource.data;
  const active = data?.history.find((row) => row.id === data.currentEnrollmentId);

  return (
    <ParticipantShell title="Proyekku" action={<RefreshButton refresh={resource.refresh} loading={resource.loading} />}>
      <p className="-mt-3 mb-8 max-w-2xl text-[14px] leading-relaxed text-sk-muted">Lanjutkan project yang sedang berjalan dan lihat hasil sprint yang sudah kamu selesaikan.</p>
      <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
      {data && !resource.loading && <>
        <section aria-labelledby="current-project-title">
          <h2 id="current-project-title" className="mb-4 text-[19px] font-extrabold text-sk-navy">Sprint saat ini</h2>
          {active ? <EnrollmentCard enrollment={active} /> : <div className="rounded-[var(--radius-sk-xl)] border border-dashed border-sk-border bg-white p-6">
            <p className="text-[13px] text-sk-muted">Kamu belum memilih project untuk sprint saat ini.</p>
            <Link href="/app/arena/projects" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold text-sk-blue hover:underline">Jelajahi project <ArrowRight size={14} aria-hidden /></Link>
          </div>}
        </section>
        <EnrollmentHistory history={data.history.filter((row) => row.id !== active?.id)} />
      </>}
    </ParticipantShell>
  );
}
