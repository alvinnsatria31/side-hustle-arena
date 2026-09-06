'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, FileCheck2, Target } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance, Reveal } from '@/components/motion/Reveal';
import { EmptyState } from '@/components/states/EmptyState';
import { RefreshButton, ResourceState, participantDate } from '@/components/arena/ParticipantDashboard';
import { participantRequest, useParticipantResource } from '@/lib/participant-client';
import type { CareerReport } from '@/server/career/report';

const loadReport = () => participantRequest<CareerReport>('/api/career/report');

export default function CareerReportPage() {
  const resource = useParticipantResource(loadReport);
  const report = resource.data;
  const change = report?.scoreChange;
  return <div className="min-w-0 [overflow-wrap:anywhere]">
    <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Career Report' }]} />
    <Entrance className="mb-7 mt-5 flex items-start justify-between gap-4">
      <div><span className="eyebrow">Career Report</span>
        <h1 className="mb-3 mt-3 text-[30px] font-extrabold tracking-[-0.025em] text-sk-navy sm:text-[38px]">Perkembangan skill kamu.</h1>
        <p className="max-w-xl text-sm leading-relaxed text-sk-muted">Jejak belajarmu dari project yang sudah direview dan difinalisasi. Setiap angka punya bukti yang bisa kamu buka kembali.</p>
      </div><RefreshButton refresh={resource.refresh} loading={resource.loading} />
    </Entrance>
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.refresh} />
    {report && !resource.loading && <>
      <dl className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Project selesai', value: report.projectsCompleted, note: 'Hasil terfinalisasi' },
          { label: 'Skill terbukti', value: report.skills.length, note: 'Dengan bukti review' },
          { label: 'Skor rata-rata', value: report.averageScore === null ? '—' : `${report.averageScore}/100`, note: 'Seluruh project selesai' },
          { label: 'Poin tersedia', value: report.points.balance.toLocaleString('id-ID'), note: `${report.points.lifetimeEarned.toLocaleString('id-ID')} poin diperoleh` },
        ].map(stat => <Card key={stat.label} className="p-5"><dt className="text-xs text-sk-muted">{stat.label}</dt><dd className="mt-3 text-2xl font-extrabold text-sk-navy">{stat.value}</dd><p className="mt-2 text-xs text-sk-muted">{stat.note}</p></Card>)}
      </dl>
      {report.projectsCompleted === 0 ? <Card className="p-6 sm:p-10"><EmptyState title="Belum ada project selesai." description="Pilih project dan kumpulkan hasil kerjamu. Setelah hasil mingguannya difinalisasi, riwayat dan bukti skill akan muncul di sini." primaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }} /></Card> : <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Reveal><Card className="p-6 sm:p-7"><h2 className="text-lg font-bold text-sk-navy">Peta skill dari bukti kerja</h2><p className="mb-5 mt-2 text-xs leading-relaxed text-sk-muted">Rata-rata skor bukti review per skill. Ini bukan persentase kesiapan kerja atau jaminan lolos rekrutmen.</p>
            {report.skills.length === 0 && <p className="text-sm text-sk-muted">Hasil sudah tersedia, tetapi belum ada bukti skill tercatat pada review.</p>}
            <ul className="space-y-5">{report.skills.map(skill => <li key={skill.id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-semibold text-sk-navy">{skill.name}</span><span className="font-mono text-sk-blue">{skill.score}/100</span></div><div role="meter" aria-label={`Skor ${skill.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={skill.score} className="h-2 overflow-hidden rounded-full bg-sk-track"><div className="h-full rounded-full bg-sk-blue" style={{ width: `${skill.score}%` }} /></div><p className="mt-1.5 text-xs text-sk-muted">{skill.evidenceCount} bukti review</p></li>)}</ul>
          </Card></Reveal>
          <Reveal><Card className="p-6 sm:p-7"><h2 className="mb-3 text-lg font-bold text-sk-navy">Riwayat project</h2><ol className="divide-y divide-sk-border">{report.history.map(item => <li key={item.id} className="flex gap-4 py-5"><span className="w-12 shrink-0 font-mono text-2xl font-bold text-sk-blue">{item.score}</span><div className="min-w-0 flex-1"><Link className="font-bold text-sk-navy hover:text-sk-blue hover:underline" href={`/app/arena/result/${encodeURIComponent(item.projectSlug)}`}>{item.title}</Link><p className="mt-1 text-xs text-sk-muted">{item.category} · {item.weekCode} · Peringkat #{item.rank}</p>{item.skills.length > 0 && <p className="mt-2 text-xs text-sk-body">{item.skills.join(' · ')}</p>}{item.completedAt && <p className="mt-2 text-xs text-sk-muted">Finalisasi {participantDate(item.completedAt)} WIB</p>}</div><span className="shrink-0 text-xs font-bold text-sk-success">+{item.pointsAwarded}</span></li>)}</ol></Card></Reveal>
        </div>
        <aside className="space-y-5">
          <Card className="border-sk-blue-tint-border bg-sk-blue-wash p-6"><span className="eyebrow">Perubahan skor</span>{change != null ? <><div className="mt-4 flex items-center gap-2 text-3xl font-extrabold text-sk-navy">{change < 0 ? <ArrowDownRight aria-hidden /> : <ArrowUpRight aria-hidden />}{change > 0 ? '+' : ''}{change}</div><p className="mt-3 text-sm leading-relaxed text-sk-muted">Rata-rata berubah dari {report.previousAverage} menjadi {report.averageScore} setelah hasil project terbaru masuk.</p></> : <p className="mt-3 text-sm text-sk-muted">Perubahan skor muncul setelah sedikitnya dua project selesai.</p>}</Card>
          <Card className="p-6"><Target size={22} aria-hidden className="text-sk-blue" /><h2 className="mt-3 text-lg font-bold text-sk-navy">Latihan berikutnya</h2><p className="my-3 text-sm leading-relaxed text-sk-muted">{report.skills.length > 1 ? `Perkuat ${report.skills[report.skills.length - 1].name}, skill dengan skor bukti terendah saat ini, atau coba bidang baru.` : 'Tambah pengalaman lewat project mingguan yang sesuai minatmu.'}</p><ButtonLink href="/app/arena/projects" size="sm">Jelajahi project</ButtonLink></Card>
          <Card className="p-6"><FileCheck2 size={22} aria-hidden className="text-sk-blue" /><h2 className="mt-3 text-lg font-bold text-sk-navy">Bawa buktimu ke peluang baru</h2><p className="my-3 text-sm leading-relaxed text-sk-muted">Bandingkan skill yang sudah terbukti dengan kebutuhan peran. Sumber lowongan dan cara pencocokan ditampilkan di halaman Jobs.</p><ButtonLink href="/app/jobs" size="sm" variant="ghost">Lihat pencocokan skill</ButtonLink></Card>
        </aside>
      </div>}
      <p className="mt-6 border-t border-sk-border pt-4 text-xs leading-relaxed text-sk-muted">Sumber: hasil final Arena dan ledger poin akunmu. Hasil yang masih disegel serta project yang dibatalkan tidak dihitung.</p>
    </>}
  </div>;
}
