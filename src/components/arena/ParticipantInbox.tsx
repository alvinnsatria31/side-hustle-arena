'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { getParticipantInbox, readParticipantInbox, useParticipantResource } from '@/lib/participant-client';
import { ParticipantShell, RefreshButton, ResourceState, participantDate } from './ParticipantDashboard';

function safeActionUrl(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return null;
  return value;
}

export default function ParticipantInbox() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(20);
  const loader = useCallback(() => getParticipantInbox(unreadOnly, limit), [unreadOnly, limit]);
  const resource = useParticipantResource(loader);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<Error | null>(null);

  async function markRead(ids?: string[]) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await readParticipantInbox(ids);
      await resource.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Pesan belum berhasil ditandai.'));
    } finally { busy.current = false; setPending(false); }
  }

  return <ParticipantShell title="Inbox" action={<RefreshButton refresh={resource.refresh} loading={resource.loading} />}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-5"><span className="text-sm font-semibold text-sk-navy">{resource.data ? `${resource.data.unread} belum dibaca` : ''}</span><label className="flex items-center gap-2 text-sm text-sk-body"><input type="checkbox" className="h-4 w-4 accent-sk-blue" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setLimit(20); }} />Belum dibaca</label></div>
      <Button size="sm" variant="ghost" iconLeft={<CheckCheck size={16} aria-hidden />} disabled={pending || resource.loading || !resource.data?.unread} onClick={() => void markRead()}>Tandai semua dibaca</Button>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error.message}</p>}
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
    {resource.data && !resource.loading && <>
      {resource.data.items.length === 0 ? <div className="flex flex-col items-center gap-3 border-y border-sk-border py-12 text-sm text-sk-muted"><Bell size={24} aria-hidden /><p>{unreadOnly ? 'Tidak ada pesan belum dibaca.' : 'Belum ada pesan.'}</p></div> : <ul className="divide-y divide-sk-border border-y border-sk-border">{resource.data.items.map((item) => {
        const href = safeActionUrl(item.actionUrl);
        return <li key={item.id} className={`py-5 ${!item.readAt ? 'border-l-2 border-l-sk-blue pl-4' : 'pl-4.5'}`}>
          <article><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className={`text-base text-sk-navy ${!item.readAt ? 'font-bold' : 'font-semibold'}`}>{item.title}</h2><time dateTime={item.createdAt} className="mt-1 block text-xs text-sk-muted">{participantDate(item.createdAt)} WIB</time></div>{!item.readAt && <Button size="sm" variant="ghost" title="Tandai dibaca" aria-label={`Tandai dibaca: ${item.title}`} disabled={pending} onClick={() => void markRead([item.id])} iconLeft={<Check size={16} aria-hidden />} />}</div>
            {item.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sk-body">{item.body}</p>}
            {href && <Link href={href} className="mt-3 inline-block text-sm font-semibold text-sk-blue hover:underline">{item.type === 'RESULT_READY' ? 'Lihat Result' : item.type === 'REWARD_FULFILLED' || item.type === 'REWARD_REDEEMED' ? 'Lihat Reward' : 'Buka detail'}</Link>}
          </article>
        </li>;
      })}</ul>}
      {resource.data.items.length >= limit && limit < 100 && <Button className="mt-5" variant="ghost" onClick={() => setLimit((value) => Math.min(value + 20, 100))}>Muat lebih banyak</Button>}
      {resource.data.items.length === 100 && <p className="mt-4 text-xs text-sk-muted">100 pesan terbaru</p>}
    </>}
  </ParticipantShell>;
}
