'use client';

import { useCallback, useState } from 'react';
import { ArenaApiError, getLeaderboard } from '@/lib/arena-client';
import { getParticipantOverview, useParticipantResource } from '@/lib/participant-client';
import { AvatarBadge } from './AvatarBadge';
import { ParticipantShell, RefreshButton, ResourceState, participantDate } from './ParticipantDashboard';

export default function ParticipantLeaderboard() {
  const [week, setWeek] = useState('');
  const overview = useParticipantResource(getParticipantOverview);
  const loader = useCallback(() => getLeaderboard(week || undefined), [week]);
  const leaderboard = useParticipantResource(loader);
  const weeks = Array.from(new Map((overview.data?.history ?? []).map((row) => [row.week.weekCode, row.week])).values());
  const unpublished = leaderboard.error instanceof ArenaApiError && ['WEEK_NOT_FOUND', 'WEEK_NOT_FINALIZED'].includes(leaderboard.error.code);
  const refresh = () => { void overview.refresh(); void leaderboard.refresh(); };

  return <ParticipantShell title="Leaderboard" action={<RefreshButton refresh={refresh} loading={leaderboard.loading || overview.loading} />}>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <label className="flex max-w-full flex-wrap items-center gap-3 text-sm font-semibold text-sk-navy">Minggu
        <select aria-label="Minggu leaderboard" value={week} onChange={(event) => setWeek(event.target.value)} className="h-11 w-64 max-w-full rounded-md border border-sk-border bg-white px-3 text-sm font-normal">
          <option value="">Terbaru yang sudah final</option>
          {weeks.map((item) => <option key={item.id} value={item.weekCode}>{item.weekCode}{item.status !== 'FINALIZED' ? ' (belum final)' : ''}</option>)}
        </select>
      </label>
    </div>
    <ResourceState loading={false} error={overview.error} retry={overview.refresh} />
    <ResourceState loading={leaderboard.loading} error={unpublished ? null : leaderboard.error} retry={leaderboard.refresh} />
    {unpublished && !leaderboard.loading && <p role="status" className="border-y border-sk-border py-8 text-sm text-sk-muted">{week ? 'Leaderboard minggu ini belum dipublikasikan.' : 'Belum ada leaderboard yang dipublikasikan.'}</p>}
    {leaderboard.data && !leaderboard.loading && <section>
      <div className="mb-4"><h2 className="text-lg font-bold text-sk-navy">{leaderboard.data.weekCode}</h2>{leaderboard.data.finalizedAt && <p className="mt-1 text-xs text-sk-muted">Final {participantDate(String(leaderboard.data.finalizedAt))} WIB</p>}</div>
      {leaderboard.data.rows.length === 0 ? <p className="py-8 text-sm text-sk-muted">Belum ada peserta dalam ranking minggu ini.</p> : <div className="overflow-x-auto border-y border-sk-border">
        <table className="w-full min-w-[540px] text-left text-sm">
          <caption className="sr-only">Ranking {leaderboard.data.weekCode}</caption>
          <thead className="bg-sk-bg text-xs text-sk-muted"><tr><th scope="col" className="p-4">Rank</th><th scope="col" className="p-4">Peserta / Project</th><th scope="col" className="p-4 text-right">Skor</th><th scope="col" className="p-4 text-right">Poin</th></tr></thead>
          <tbody className="divide-y divide-sk-border">{leaderboard.data.rows.map((row) => <tr key={row.rank} className={row.rank <= 3 ? 'bg-sk-success-tint/30' : ''}><td className="p-4 font-bold text-sk-navy">#{row.rank}</td><td className="max-w-md p-4"><div className="flex items-center gap-2.5"><AvatarBadge avatarId={row.avatarId} size="sm" /><span className="font-bold text-sk-navy">{row.displayName}</span></div><div className="mt-1 text-sk-body">{row.projectTitle}</div><div className="mt-1 text-xs text-sk-muted">{row.divisionName}</div></td><td className="p-4 text-right font-semibold tabular-nums">{row.finalScore}</td><td className="p-4 text-right font-semibold tabular-nums text-sk-success">+{row.pointsAwarded}</td></tr>)}</tbody>
        </table>
      </div>}
    </section>}
  </ParticipantShell>;
}
