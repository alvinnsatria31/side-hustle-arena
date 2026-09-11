'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { getParticipantInbox, readParticipantInbox, type ParticipantInbox as InboxPayload } from '@/lib/participant-client';
import { ParticipantShell, RefreshButton, ResourceState, participantDate } from './ParticipantDashboard';

const PAGE_SIZE = 20;
type InboxItem = InboxPayload['items'][number];

function safeActionUrl(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\ - ]/.test(value)) return null;
  return value;
}

export default function ParticipantInbox() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const busy = useRef(false);
  // Which first-page request the list answers. Loading is derived from it, and a
  // page that answers after the filter changed never lands in the new list.
  // Older history is fetched by cursor on demand, never by reloading.
  const requestKey = `${unreadOnly}#${refreshCount}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const latestKey = useRef(requestKey);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    latestKey.current = requestKey;
    getParticipantInbox(unreadOnly, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setUnread(page.unread);
        setNextCursor(page.nextCursor);
        setLoadError(null);
        setSettledKey(requestKey);
      })
      .catch((cause) => {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause : new Error('Data belum dapat dimuat.'));
        setSettledKey(requestKey);
      });
    return () => { cancelled = true; };
  }, [unreadOnly, requestKey]);

  const refresh = () => {
    setError(null);
    setRefreshCount((count) => count + 1);
  };

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const key = requestKey;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await getParticipantInbox(unreadOnly, PAGE_SIZE, nextCursor);
      if (latestKey.current !== key) return;
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setUnread(page.unread);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (latestKey.current === key) setError(cause instanceof Error ? cause : new Error('Pesan lama belum dapat dimuat.'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(ids?: string[]) {
    if (busy.current) return;
    busy.current = true;
    const key = requestKey;
    setPending(true);
    setError(null);
    try {
      const { read } = await readParticipantInbox(ids);
      if (latestKey.current !== key) return;
      // Applied in place, so the older pages already opened stay open.
      const now = new Date().toISOString();
      const target = ids ? new Set(ids) : null;
      setItems((previous) => unreadOnly
        ? previous.filter((item) => (target ? !target.has(item.id) : false))
        : previous.map((item) => (!item.readAt && (!target || target.has(item.id)) ? { ...item, readAt: now } : item)));
      if (unreadOnly && !target) setNextCursor(null);
      setUnread((count) => (count === null ? count : Math.max(0, count - read.marked)));
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Pesan belum berhasil ditandai.'));
    } finally { busy.current = false; setPending(false); }
  }

  return <ParticipantShell title="Inbox" action={<RefreshButton refresh={refresh} loading={loading} />}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-5"><span className="text-sm font-semibold text-sk-navy">{unread !== null ? `${unread} belum dibaca` : ''}</span><label className="flex items-center gap-2 text-sm text-sk-body"><input type="checkbox" className="h-4 w-4 accent-sk-blue" checked={unreadOnly} onChange={(event) => { setError(null); setUnreadOnly(event.target.checked); }} />Belum dibaca</label></div>
      <Button size="sm" variant="ghost" iconLeft={<CheckCheck size={16} aria-hidden />} disabled={pending || loading || !unread} onClick={() => void markRead()}>Tandai semua dibaca</Button>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error.message}</p>}
    <ResourceState loading={loading} error={loading ? null : loadError} retry={refresh} />
    {!loading && !loadError && <>
      {items.length === 0 ? <div className="flex flex-col items-center gap-3 border-y border-sk-border py-12 text-sm text-sk-muted"><Bell size={24} aria-hidden /><p>{unreadOnly ? 'Tidak ada pesan belum dibaca.' : 'Belum ada pesan.'}</p></div> : <ul className="divide-y divide-sk-border border-y border-sk-border">{items.map((item) => {
        const href = safeActionUrl(item.actionUrl);
        return <li key={item.id} className={`py-5 ${!item.readAt ? 'border-l-2 border-l-sk-blue pl-4' : 'pl-4.5'}`}>
          <article><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className={`text-base text-sk-navy ${!item.readAt ? 'font-bold' : 'font-semibold'}`}>{item.title}</h2><time dateTime={item.createdAt} className="mt-1 block text-xs text-sk-muted">{participantDate(item.createdAt)} WIB</time></div>{!item.readAt && <Button size="sm" variant="ghost" title="Tandai dibaca" aria-label={`Tandai dibaca: ${item.title}`} disabled={pending} onClick={() => void markRead([item.id])} iconLeft={<Check size={16} aria-hidden />} />}</div>
            {item.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-sk-body">{item.body}</p>}
            {href && <Link href={href} className="mt-3 inline-block text-sm font-semibold text-sk-blue hover:underline">{item.type === 'RESULT_READY' ? 'Lihat Result' : item.type === 'REWARD_FULFILLED' || item.type === 'REWARD_REDEEMED' ? 'Lihat Reward' : 'Buka detail'}</Link>}
          </article>
        </li>;
      })}</ul>}
      {nextCursor && <Button className="mt-5" variant="ghost" loading={loadingMore} disabled={loadingMore} onClick={() => void loadMore()}>Muat lebih banyak</Button>}
      {!nextCursor && items.length > PAGE_SIZE && <p className="mt-4 text-xs text-sk-muted">Semua pesan sudah ditampilkan.</p>}
    </>}
  </ParticipantShell>;
}
