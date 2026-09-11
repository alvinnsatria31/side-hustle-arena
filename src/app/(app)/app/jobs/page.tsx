'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, MapPin, RefreshCw, Target } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import type { JobsOverview } from '@/server/career/jobs-service';

const WORK_MODE_LABEL: Record<string, string> = {
  REMOTE: 'Remote', HYBRID: 'Hybrid', ONSITE: 'On-site', UNSPECIFIED: 'Tidak disebutkan',
};
const EMPLOYMENT_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Kontrak', INTERNSHIP: 'Magang',
  FREELANCE: 'Freelance', TEMPORARY: 'Sementara', UNSPECIFIED: 'Tidak disebutkan',
};
const HEALTH_LABEL: Record<string, string> = {
  HEALTHY: 'Sehat', DEGRADED: 'Data menua', FAILING: 'Gagal berulang',
  NEVER_SYNCED: 'Belum pernah sync', DISABLED: 'Dinonaktifkan',
};
const PAGE_SIZE = 30;

interface JobsQuery { q: string; employmentType: string; workMode: string; location: string }

function freshnessText(minutes: number | null): string {
  if (minutes === null) return 'belum pernah diperbarui';
  if (minutes < 1) return 'baru saja diperbarui';
  if (minutes < 60) return `diperbarui ${minutes} menit lalu`;
  if (minutes < 60 * 24) return `diperbarui ${Math.floor(minutes / 60)} jam lalu`;
  return `diperbarui ${Math.floor(minutes / (60 * 24))} hari lalu`;
}

function salaryText(salary: JobsOverview['jobs'][number]['salary']): string | null {
  if (!salary || (salary.min === null && salary.max === null)) return null;
  const format = (value: number) => new Intl.NumberFormat('id-ID').format(value);
  const range = salary.min !== null && salary.max !== null && salary.min !== salary.max
    ? `${format(salary.min)}–${format(salary.max)}`
    : format((salary.min ?? salary.max)!);
  return [salary.currency, range, salary.period ? `/ ${salary.period.toLowerCase()}` : null].filter(Boolean).join(' ');
}

/** Search and filters run on the server, so every visible opening is reachable — not only the first page. */
async function fetchJobsPage(query: JobsQuery, offset: number, signal?: AbortSignal): Promise<JobsOverview> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE) });
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const response = await fetch(`/api/career/jobs?${params}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sesi berakhir. Masuk kembali untuk melihat skill kamu.' : 'Jobs belum bisa dimuat. Coba lagi sebentar.');
  const body = await response.json();
  return body.data as JobsOverview;
}

export default function JobsPage() {
  const [data, setData] = useState<JobsOverview | null>(null);
  const [jobs, setJobs] = useState<JobsOverview['jobs']>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const query = useMemo<JobsQuery>(
    () => ({ q: debouncedSearch, employmentType, workMode, location }),
    [debouncedSearch, employmentType, workMode, location],
  );
  // Which request the list on screen answers. Loading is derived from it, and a
  // response for filters the participant has already changed never lands.
  const requestKey = `${JSON.stringify(query)}#${retry}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const latestKey = useRef(requestKey);
  const loading = settledKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    latestKey.current = requestKey;
    fetchJobsPage(query, 0, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setData(next);
        setJobs(next.jobs);
        setError(null);
        setSettledKey(requestKey);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Jobs belum bisa dimuat.');
        setSettledKey(requestKey);
      });
    return () => controller.abort();
  }, [query, requestKey]);

  async function loadMore() {
    if (loadingMore) return;
    const key = requestKey;
    setLoadingMore(true);
    try {
      const next = await fetchJobsPage(query, jobs.length);
      if (latestKey.current !== key) return;
      setData(next);
      setJobs((previous) => {
        const seen = new Set(previous.map((job) => job.id));
        return [...previous, ...next.jobs.filter((job) => !seen.has(job.id))];
      });
    } catch (cause) {
      if (latestKey.current === key) setError(cause instanceof Error ? cause.message : 'Jobs belum bisa dimuat.');
    } finally {
      setLoadingMore(false);
    }
  }

  const resetFilters = () => { setSearch(''); setDebouncedSearch(''); setEmploymentType(''); setWorkMode(''); setLocation(''); };
  const top = data?.topMatch ?? null;
  const fieldClass = 'mt-1.5 w-full rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-3 py-2.5 text-[13px] text-sk-navy focus-visible:outline-2 focus-visible:outline-sk-blue';
  const stalest = data?.sources.reduce<number | null>((worst, source) =>
    source.freshnessMinutes === null ? worst : Math.max(worst ?? 0, source.freshnessMinutes), null) ?? null;

  return (
    <div>
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Jobs' }]} />
      <Entrance className="mt-5">
        <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-navy-2 to-sk-navy-4 p-8 text-white sm:p-10">
          <span aria-hidden className="pointer-events-none absolute -right-36 -top-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(90,224,160,0.25),transparent_65%)]" />
          <div className="relative z-[1]">
            <span className="eyebrow eyebrow-dark">Career exploration</span>
            <h1 className="mb-2.5 mt-3 max-w-[520px] text-[28px] font-extrabold tracking-[-0.02em] sm:text-[38px]">Temukan arah karier dari skill kamu.</h1>
            <p className="mb-5 max-w-[540px] text-[14px] leading-relaxed text-white/80">Lowongan di bawah berasal dari sumber yang terhubung, dicocokkan dengan bukti skill dari hasil Arena yang sudah final.</p>
            <p className="mb-6 rounded-lg border border-white/20 bg-white/10 p-3 text-[12px] leading-relaxed">
              {data?.sourceLabel ?? 'Memuat sumber lowongan…'}
              {data && data.source === 'live' ? ` · ${freshnessText(stalest)}` : ''}
            </p>
            <div className="mb-6 grid max-w-[650px] gap-2.5 sm:grid-cols-3">
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[10px] tracking-[0.1em] text-white/65">LOWONGAN AKTIF</div>
                <div className="mt-1.5 text-[26px] font-extrabold">{data ? data.totalOpen.toLocaleString('id-ID') : '—'}</div>
              </div>
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[10px] tracking-[0.1em] text-white/65">KECOCOKAN TERTINGGI</div>
                <div className="mt-2 text-[13.5px] font-bold leading-snug">{top?.title ?? 'Belum ada kecocokan'}</div>
              </div>
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[10px] tracking-[0.1em] text-white/65">CAKUPAN SKILL TERTINGGI</div>
                <div className="mt-1.5 text-[26px] font-extrabold text-[#5ae0a0]">{top ? `${top.matchScore}%` : '—'}</div>
              </div>
            </div>
            {data?.portalUrl ? <>
              <ButtonLink href={data.portalUrl} target="_blank" rel="noopener noreferrer" variant="white" iconRight={<ArrowUpRight size={15} aria-hidden />}>Buka portal eksternal</ButtonLink>
              <p className="mt-3 text-[11px] text-white/65">Portal terkonfigurasi; ketersediaan lowongan di sana belum diverifikasi. Membuka tab baru.</p>
            </> : null}
          </div>
        </div>
      </Entrance>

      {error && !data ? <Card className="mt-6 p-5">
        <p role="alert" className="mb-3 text-sm text-sk-error">{error}</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setRetry(value => value + 1)} iconLeft={<RefreshCw size={14} aria-hidden />}>Coba lagi</Button>
          <ButtonLink href="/login?returnTo=%2Fapp%2Fjobs" variant="ghost">Masuk kembali</ButtonLink>
        </div>
      </Card> : !data ? <p role="status" className="mt-6 text-sm text-sk-muted">Memuat lowongan dan bukti skill…</p> : <>
        {data.sources.length > 0 && <Card className="mt-6 p-4">
          <p className="mb-2 text-[12.5px] font-semibold text-sk-navy">Sumber lowongan</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.sources.map(source => <li key={source.slug} className="flex flex-wrap items-center gap-2 text-[12px] text-sk-muted">
              <Badge variant={source.health === 'HEALTHY' ? 'mint' : source.health === 'DISABLED' ? 'slate' : 'amber'}>{HEALTH_LABEL[source.health] ?? source.health}</Badge>
              <span className="font-semibold text-sk-navy">{source.name}</span>
              <span>· {source.openOpenings} lowongan aktif · {freshnessText(source.freshnessMinutes)}</span>
            </li>)}
          </ul>
        </Card>}

        <div className="mb-4 mt-9">
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">Lowongan yang cocok dengan bukti skill kamu</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-sk-muted">Skor = skill wajib yang punya bukti final ÷ skill wajib yang bisa dipetakan ke taksonomi × 100. Skor tidak ditampilkan kalau lowongan tidak menyebut skill, atau kamu belum punya bukti final. Ini cakupan skill, bukan peluang diterima.</p>
        </div>

        <Card className="mb-5 p-4">
          {data.skills.length ? <>
            <p className="mb-2 text-[12.5px] font-semibold text-sk-navy">{data.skills.length} skill dengan bukti hasil Arena final</p>
            <div className="flex flex-wrap gap-1.5">{data.skills.map(skill => <Badge key={skill} variant="slate">{skill}</Badge>)}</div>
            <p className="mt-2 text-[11.5px] text-sk-muted">Adanya bukti tidak menyatakan tingkat penguasaan. Klaim dari CV tidak dipakai di skor ini.</p>
          </> : <>
            <p className="text-[13px] text-sk-muted">Belum ada bukti skill final. Kamu tetap bisa menjelajahi lowongan; skor cakupan baru muncul setelah hasil Arena difinalisasi.</p>
            <ButtonLink href="/app/arena" variant="text" size="sm">Mulai project Arena</ButtonLink>
          </>}
        </Card>

        {data.totalOpen === 0 ? <Card className="p-6 text-center">
          <p className="text-sm text-sk-muted">{data.source === 'empty'
            ? 'Belum ada sumber lowongan yang terhubung, jadi belum ada lowongan untuk ditampilkan.'
            : 'Sumber sudah terhubung tetapi belum ada lowongan aktif dari sinkronisasi terakhir.'}</p>
        </Card> : <>
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <label className="text-[12px] font-semibold text-sk-muted">Cari peran atau skill
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Contoh: SQL, designer" className={fieldClass} />
            </label>
            <label className="text-[12px] font-semibold text-sk-muted">Tipe pekerjaan
              <select value={employmentType} onChange={event => setEmploymentType(event.target.value)} className={fieldClass}>
                <option value="">Semua tipe</option>
                {data.facets.employmentTypes.map(value => <option key={value} value={value}>{EMPLOYMENT_LABEL[value] ?? value}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-semibold text-sk-muted">Model kerja
              <select value={workMode} onChange={event => setWorkMode(event.target.value)} className={fieldClass}>
                <option value="">Semua model</option>
                {data.facets.workModes.map(value => <option key={value} value={value}>{WORK_MODE_LABEL[value] ?? value}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-semibold text-sk-muted">Lokasi
              <select value={location} onChange={event => setLocation(event.target.value)} className={fieldClass}>
                <option value="">Semua lokasi</option>
                {data.facets.locations.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <p role="status" className="mb-3 text-[12px] text-sk-muted">
            {loading
              ? 'Memperbarui hasil…'
              : `${jobs.length.toLocaleString('id-ID')} dari ${data.totalMatching.toLocaleString('id-ID')} lowongan yang sesuai ditampilkan · ${data.totalOpen.toLocaleString('id-ID')} lowongan aktif`}
          </p>
          {data.truncated && <p className="mb-3 text-[11.5px] text-sk-muted">Lowongan aktif sangat banyak; pencarian saat ini menjangkau lowongan terbaru saja. Persempit dengan filter untuk hasil yang lebih tepat.</p>}
          {error && <p role="alert" className="mb-3 text-sm text-sk-error">{error}</p>}
          {!loading && jobs.length === 0 ? <Card className="p-6 text-center">
            <p className="mb-3 text-sm text-sk-muted">Tidak ada lowongan yang sesuai filter ini.</p>
            <Button variant="ghost" onClick={resetFilters}>Reset filter</Button>
          </Card> : <StaggerGroup className="grid gap-4 md:grid-cols-2">
            {jobs.map(job => <StaggerItem key={job.id}>
              <Card className="flex h-full flex-col p-5 transition-all duration-200 hover:border-sk-blue/40 hover:shadow-sk-md">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15.5px] font-bold text-sk-navy">{job.title}</h3>
                    <p className="mt-0.5 text-[12px] text-sk-muted">{job.company}</p>
                    <p className="mt-1 text-[12px] text-sk-muted"><MapPin size={11} className="inline align-[-1px]" aria-hidden /> {job.location ?? 'Lokasi tidak disebutkan'}</p>
                  </div>
                  <span className="rounded-full bg-sk-blue-tint px-2.5 py-1 font-mono text-[11px] font-bold text-sk-blue">
                    {job.matchScore === null
                      ? job.unscoredReason === 'NO_SKILL_DATA' ? 'Skill tidak disebut' : 'Belum ada bukti'
                      : `${job.matchScore}% cakupan`}
                  </span>
                </div>
                {job.skills.length > 0 && <>
                  <p className="mb-2 text-[12px] text-sk-muted">{job.matchedSkills.length} dari {job.skills.length} skill terpetakan punya bukti final.</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {job.skills.map(skill => <span key={skill.skillId + skill.kind} className={`rounded-md px-2 py-1 text-[11px] ${job.matchedSkills.includes(skill.name) ? 'bg-sk-success-tint text-sk-success' : 'bg-sk-blue-wash text-sk-body'}`}>{job.matchedSkills.includes(skill.name) ? '✓ ' : ''}{skill.name}</span>)}
                  </div>
                </>}
                {job.unresolvedSkills.length > 0 && <p className="mb-2 text-[11.5px] leading-relaxed text-sk-muted">Belum terpetakan ke taksonomi kami: {job.unresolvedSkills.join(', ')}. Skill ini tidak dihitung dalam skor.</p>}
                {job.missingSkills.length > 0 && <p className="mb-3 text-[11.5px] leading-relaxed text-sk-muted">Belum ada bukti: {job.missingSkills.join(', ')}.</p>}
                {salaryText(job.salary) && <p className="mb-3 text-[12px] font-semibold text-sk-navy">{salaryText(job.salary)}</p>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-sk-border pt-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="slate">{EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType}</Badge>
                    <Badge variant="slate">{WORK_MODE_LABEL[job.workMode] ?? job.workMode}</Badge>
                  </div>
                  <ButtonLink href={job.applicationUrl} target="_blank" rel="noopener noreferrer nofollow" variant="text" size="sm" iconRight={<ArrowUpRight size={13} aria-hidden />}>Lamar di {job.sourceName}</ButtonLink>
                </div>
              </Card>
            </StaggerItem>)}
          </StaggerGroup>}
          {!loading && data.hasMore && <div className="mt-5 flex justify-center">
            <Button variant="ghost" loading={loadingMore} disabled={loadingMore} onClick={() => void loadMore()}>Muat lebih banyak</Button>
          </div>}
        </>}

        <div className="mt-8 flex items-start gap-3 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-sk-muted">
          <Target size={15} className="mt-0.5 shrink-0 text-sk-blue" aria-hidden />
          <span>Lamaran diproses di situs sumber, bukan di Arena. Gunakan skill yang belum punya bukti untuk memilih project latihan berikutnya.</span>
        </div>
      </>}
    </div>
  );
}
