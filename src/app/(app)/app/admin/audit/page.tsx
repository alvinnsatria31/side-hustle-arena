'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { getAdminAudit, type AdminAuditEntry } from '@/lib/admin-client';
import { jakartaDate } from '@/lib/jakarta-time';

const ACTOR_VARIANT: Record<string, 'blue' | 'mint' | 'amber' | 'slate'> = {
  ADMIN: 'blue', AUTOMATION: 'mint', USER: 'slate', SYSTEM: 'amber',
};

/**
 * The audit trail, read back.
 *
 * Everything the console does lands in `audit.logs`; this is where an operator
 * checks that claim, and investigates. Filtering and paging are keyset-based
 * on the server, so this page holds a growing list and asks for the next slice
 * rather than recomputing offsets.
 */
export default function AdminAuditPage() {
  const [q, setQ] = useState('');
  const [actorType, setActorType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async (append: boolean) => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAudit({
        q: q || undefined,
        actorType: actorType || undefined,
        entityType: entityType || undefined,
        before: append ? nextBefore ?? undefined : undefined,
        limit: 50,
      });
      if (request !== generation.current) return;
      setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
      setNextBefore(data.nextBefore);
      if (data.entityTypes) setEntityTypes(data.entityTypes);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : 'Audit log gagal dimuat.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [q, actorType, entityType, nextBefore]);

  // Reload from the top whenever a filter changes; `load` is intentionally
  // excluded so a fresh nextBefore does not retrigger this.
  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, actorType, entityType]);

  return (
    <AdminShell
      title="Audit Log"
      description="Jejak setiap tindakan admin dan otomasi. Hanya-baca — audit.logs bersifat append-only."
      action={<AdminRefreshButton refresh={() => load(false)} loading={loading} />}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari aksi, subjek, atau entity id…"
          className="h-10 max-w-xs"
        />
        <select
          value={actorType}
          onChange={(e) => setActorType(e.target.value)}
          className="h-10 rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-3 text-[13px] text-sk-navy"
          aria-label="Filter tipe aktor"
        >
          <option value="">Semua aktor</option>
          {['ADMIN', 'AUTOMATION', 'USER', 'SYSTEM'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-10 rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-3 text-[13px] text-sk-navy"
          aria-label="Filter tipe entity"
        >
          <option value="">Semua entity</option>
          {entityTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {error}
        </div>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-sk-bg text-xs text-sk-muted">
            <tr>
              <th className="p-4">Waktu</th>
              <th className="p-4">Aktor</th>
              <th className="p-4">Aksi</th>
              <th className="p-4">Entity</th>
              <th className="p-4 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sk-border">
            {entries.map((entry) => (
              <Fragment key={entry.id}>
                <tr>
                  <td className="whitespace-nowrap p-4 text-xs text-sk-muted">{jakartaDate(entry.createdAt)}</td>
                  <td className="p-4">
                    <Badge variant={ACTOR_VARIANT[entry.actorType] ?? 'slate'}>{entry.actorType}</Badge>
                    {entry.actorSubject && <span className="mt-1 block max-w-[180px] truncate font-mono text-[10.5px] text-sk-muted" title={entry.actorSubject}>{entry.actorSubject}</span>}
                  </td>
                  <td className="p-4 font-mono text-[12px] font-semibold text-sk-navy">{entry.action}</td>
                  <td className="p-4 text-xs text-sk-body">
                    {entry.entityType}
                    {entry.entityId && <span className="mt-0.5 block max-w-[180px] truncate font-mono text-[10.5px] text-sk-muted" title={entry.entityId}>{entry.entityId}</span>}
                  </td>
                  <td className="p-4 text-right">
                    {entry.metadata != null && (
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                        {expanded === entry.id ? 'Tutup' : 'Lihat'}
                      </Button>
                    )}
                  </td>
                </tr>
                {expanded === entry.id && entry.metadata != null && (
                  <tr>
                    <td colSpan={5} className="bg-sk-bg p-4">
                      <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-sk-body">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {entries.length === 0 && !loading && (
              <tr><td colSpan={5} className="p-8 text-center text-sm text-sk-muted">Tidak ada entri untuk filter ini.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {nextBefore && (
        <div className="mt-5 text-center">
          <Button variant="ghost" loading={loading} onClick={() => load(true)}>Muat lebih banyak</Button>
        </div>
      )}
    </AdminShell>
  );
}
