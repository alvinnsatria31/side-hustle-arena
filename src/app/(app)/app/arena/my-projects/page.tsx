'use client';

import { Compass } from 'lucide-react';
import {
  EnrollmentHistory,
  ParticipantShell,
  RefreshButton,
  ResourceState,
} from '@/components/arena/ParticipantDashboard';
import { EnrollmentCard } from '@/components/arena/dashboard/EnrollmentCard';
import { EmptyState } from '@/components/arena/dashboard/EmptyState';
import { getParticipantOverview, useParticipantResource } from '@/lib/participant-client';

export default function MyProjectsPage() {
  const resource = useParticipantResource(getParticipantOverview);
  const data = resource.data;
  const active = data?.history.find((row) => row.id === data.currentEnrollmentId);

  return (
    <ParticipantShell
      title="Proyekku"
      subtitle="Lanjutkan project yang sedang berjalan dan lihat hasil sprint yang sudah kamu selesaikan."
      action={<RefreshButton refresh={resource.refresh} loading={resource.loading} />}
    >
      <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
      {data && !resource.loading && (
        <>
          <section aria-labelledby="current-project-title">
            <h2
              id="current-project-title"
              className="mb-4 text-[19px] font-extrabold tracking-[-0.03em] text-sk-navy"
            >
              Sprint saat ini
            </h2>
            {active ? (
              <EnrollmentCard enrollment={active} />
            ) : (
              <EmptyState
                icon={Compass}
                title="Belum memilih project untuk sprint ini"
                body="Brief minggu ini masih terbuka. Pilih satu yang paling dekat dengan arah kariermu."
                action={{ label: 'Jelajahi project', href: '/app/arena/projects' }}
              />
            )}
          </section>
          {/* `EnrollmentHistory` carries its own empty state. */}
          <EnrollmentHistory history={data.history.filter((row) => row.id !== active?.id)} />
        </>
      )}
    </ParticipantShell>
  );
}
