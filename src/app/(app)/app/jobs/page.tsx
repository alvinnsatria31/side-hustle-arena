'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, MapPin, Target } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { filterJobs, type JobsOverview } from '@/server/career/jobs-matching';

export default function JobsPage() {
  const [data, setData] = useState<JobsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError(null);
      try {
        const response = await fetch('/api/career/jobs', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 401 ? 'Sesi berakhir. Masuk kembali untuk melihat skill kamu.' : 'Jobs belum bisa dimuat. Coba lagi sebentar.');
        const body = await response.json();
        if (!controller.signal.aborted) setData(body.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Jobs belum bisa dimuat.');
      }
    }
    void load();
    return () => controller.abort();
  }, [retry]);

  const jobs = data ? filterJobs(data.jobs, { search, type, location }) : [];
  const top = data?.jobs.find(job => (job.matchScore ?? 0) > 0);
  const fieldClass = 'mt-1.5 w-full rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-3 py-2.5 text-[13px] text-sk-navy focus-visible:outline-2 focus-visible:outline-sk-blue';

  return (
    <div>
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Jobs' }]} />
      <Entrance className="mt-5">
        <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-navy-2 to-sk-navy-4 p-8 text-white sm:p-10">
          <span aria-hidden className="pointer-events-none absolute -right-36 -top-40 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(90,224,160,0.25),transparent_65%)]" />
          <div className="relative z-[1]">
            <span className="eyebrow eyebrow-dark">Career exploration</span>
            <h1 className="mb-2.5 mt-3 max-w-[520px] text-[28px] font-extrabold tracking-[-0.02em] sm:text-[38px]">Temukan arah karier dari skill kamu.</h1>
            <p className="mb-5 max-w-[540px] text-[14px] leading-relaxed text-white/80">Jelajahi contoh peran dengan bukti skill dari hasil Arena yang sudah final. Kecocokan skill membantu kamu melihat apa yang sudah ada dan apa yang perlu dilatih.</p>
            <p className="mb-6 rounded-lg border border-white/20 bg-white/10 p-3 text-[12px] leading-relaxed">{data?.sourceLabel ?? 'Hardcoded / contoh lowongan — belum terhubung feed lowongan nyata'}. Seluruh perusahaan di katalog ini fiktif; lamaran belum tersedia.</p>
            <div className="mb-6 grid max-w-[650px] gap-2.5 sm:grid-cols-3">
              <div className="rounded-[var(--radius-sk-lg)] border border-white/15 bg-white/10 p-4">
                <div className="font-mono text-[10px] tracking-[0.1em] text-white/65">CONTOH DENGAN SKILL COCOK</div>
                <div className="mt-1.5 text-[26px] font-extrabold">{data?.matchCount ?? '—'}</div>
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
            </> : <p className="text-[12px] text-white/65">Portal lowongan eksternal belum terhubung.</p>}
          </div>
        </div>
      </Entrance>

      {error ? <Card className="mt-6 p-5">
        <p role="alert" className="mb-3 text-sm text-sk-error">{error}</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setRetry(value => value + 1)}>Coba lagi</Button>
          <ButtonLink href="/login?returnTo=%2Fapp%2Fjobs" variant="ghost">Masuk kembali</ButtonLink>
        </div>
      </Card> : !data ? <p role="status" className="mt-6 text-sm text-sk-muted">Memuat bukti skill dan contoh peran…</p> : <>
        <div className="mb-4 mt-9">
          <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[24px]">Jelajahi contoh peran</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-sk-muted">Skor = skill yang cocok ÷ skill yang diminta × 100, dibulatkan. Nama skill dicocokkan persis tanpa membedakan huruf besar/kecil. Ini cakupan skill, bukan peluang diterima atau penilaian kesiapan kerja.</p>
        </div>
        <Card className="mb-5 p-4">
          {data.skills.length ? <>
            <p className="mb-2 text-[12.5px] font-semibold text-sk-navy">{data.skills.length} skill dengan bukti hasil Arena final</p>
            <div className="flex flex-wrap gap-1.5">{data.skills.map(skill => <Badge key={skill} variant="slate">{skill}</Badge>)}</div>
            <p className="mt-2 text-[11.5px] text-sk-muted">Adanya bukti tidak menyatakan tingkat penguasaan. Nilai review dan CV tidak dipakai dalam skor cakupan ini.</p>
          </> : <>
            <p className="text-[13px] text-sk-muted">Belum ada bukti skill final. Kamu tetap bisa menjelajahi contoh peran; skor baru muncul setelah hasil Arena difinalisasi.</p>
            <ButtonLink href="/app/arena" variant="text" size="sm">Mulai project Arena</ButtonLink>
          </>}
        </Card>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <label className="text-[12px] font-semibold text-sk-muted">Cari peran atau skill
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Contoh: SQL, designer" className={fieldClass} />
          </label>
          <label className="text-[12px] font-semibold text-sk-muted">Tipe pekerjaan
            <select value={type} onChange={event => setType(event.target.value)} className={fieldClass}>
              <option value="">Semua tipe</option>
              {[...new Set(data.jobs.map(job => job.type))].sort().map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-semibold text-sk-muted">Lokasi
            <select value={location} onChange={event => setLocation(event.target.value)} className={fieldClass}>
              <option value="">Semua lokasi</option>
              {[...new Set(data.jobs.map(job => job.location))].sort().map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <p role="status" className="mb-3 text-[12px] text-sk-muted">{jobs.length} dari {data.jobs.length} contoh peran ditampilkan</p>
        {jobs.length === 0 ? <Card className="p-6 text-center">
          <p className="mb-3 text-sm text-sk-muted">Tidak ada contoh peran yang sesuai filter ini.</p>
          <Button variant="ghost" onClick={() => { setSearch(''); setType(''); setLocation(''); }}>Reset filter</Button>
        </Card> : <StaggerGroup className="grid gap-4 md:grid-cols-2">
          {jobs.map(job => <StaggerItem key={job.id}>
            <Card className="flex h-full flex-col p-5 transition-all duration-200 hover:border-sk-blue/40 hover:shadow-sk-md">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-bold text-sk-navy">{job.title}</h3>
                  <p className="mt-0.5 text-[12px] text-sk-muted">{job.company}</p>
                  <p className="mt-1 text-[12px] text-sk-muted"><MapPin size={11} className="inline align-[-1px]" aria-hidden /> {job.location}</p>
                </div>
                <span className="rounded-full bg-sk-blue-tint px-2.5 py-1 font-mono text-[11px] font-bold text-sk-blue">{job.matchScore === null ? 'Belum ada bukti' : `${job.matchScore}% cakupan`}</span>
              </div>
              <p className="mb-2 text-[12px] text-sk-muted">{job.matchedSkills.length} dari {job.skills.length} skill memiliki bukti final.</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {job.skills.map(skill => <span key={skill} className={`rounded-md px-2 py-1 text-[11px] ${job.matchedSkills.includes(skill) ? 'bg-sk-success-tint text-sk-success' : 'bg-sk-blue-wash text-sk-body'}`}>{job.matchedSkills.includes(skill) ? '✓ ' : ''}{skill}</span>)}
              </div>
              {job.missingSkills.length > 0 && <p className="mb-4 text-[11.5px] leading-relaxed text-sk-muted">Belum ada bukti: {job.missingSkills.join(', ')}.</p>}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-sk-border pt-3.5">
                <Badge variant="slate">{job.type}</Badge>
                <span className="text-[11px] text-sk-muted">Contoh · tidak menerima lamaran</span>
              </div>
            </Card>
          </StaggerItem>)}
        </StaggerGroup>}
        <div className="mt-8 flex items-start gap-3 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-sk-muted">
          <Target size={15} className="mt-0.5 shrink-0 text-sk-blue" aria-hidden />
          <span>Gunakan skill yang belum memiliki bukti untuk memilih project latihan berikutnya. Katalog ini merupakan simulasi eksplorasi karier, bukan daftar lowongan aktif.</span>
        </div>
      </>}
    </div>
  );
}
