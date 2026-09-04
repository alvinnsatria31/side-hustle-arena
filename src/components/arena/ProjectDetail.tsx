'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, Link2, ListChecks, ReceiptText, Users } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Tabs } from '@/components/primitives/Tabs';
import { LoginModal } from '@/components/layout/LoginModal';
import { ResourceList } from '@/components/arena/KanbanPreview';
import { useDemo } from '@/features/demo/store';
import { ArenaApiError, getVisibleProject, selectProject } from '@/lib/arena-client';
import { useToast } from '@/features/ui/toast';
import type { ArenaProject } from '@/types/project';

const SAVED_KEY = 'sk-saved-projects';

/* ---------------- CTA actions (hero) ---------------- */

export function CtaActions({ slug }: { slug: string }) {
  const router = useRouter();
  const { state, hydrated } = useDemo();
  const { showToast } = useToast();
  const [loginOpen, setLoginOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const list = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]') as string[];
      setSaved(list.includes(slug));
    } catch {
      /* ignore */
    }
  }, [slug]);

  const toggleSave = () => {
    try {
      const list = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]') as string[];
      const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setSaved(next.includes(slug));
      showToast(next.includes(slug) ? 'Disimpan untuk nanti.' : 'Dihapus dari daftar simpanan.');
    } catch {
      /* ignore */
    }
  };

  const enrollment = state.enrollment;
  const enrolledHere = hydrated && enrollment?.projectSlug === slug;
  const [choosing, setChoosing] = useState(false);

  const choose = async () => {
    if (!hydrated || choosing) return;
    if (!state.user) {
      setLoginOpen(true);
      return;
    }
    if (enrolledHere && enrollment && enrollment.status !== 'completed') {
      if (enrollment.status === 'active') {
        router.push(`/app/arena/workspace/${slug}`);
        return;
      }
      if (enrollment.status === 'review_ready') {
        router.push(`/app/arena/result/${slug}`);
        return;
      }
      router.push(`/app/arena/submission/${slug}`);
      return;
    }
    // Phase 9b: live enroll dulu (session cookie → POST /api/arena/enrollments).
    // Kalau backend nolak (mis. belum login beneran / week tutup), tampilkan
    // pesan jujur — jangan pura-pura enroll via mock.
    setChoosing(true);
    try {
      const visible = await getVisibleProject(slug);
      await selectProject(visible.id);
      router.push(`/app/arena/workspace/${slug}`);
    } catch (err) {
      if (err instanceof ArenaApiError && err.status === 401) {
        setLoginOpen(true);
        return;
      }
      const message =
        err instanceof ArenaApiError
          ? err.code === 'ALREADY_ENROLLED_THIS_WEEK'
            ? 'Kamu sudah ambil project lain minggu ini (1 project/minggu).'
            : err.code === 'WEEK_NOT_OPEN' || err.code === 'WEEK_CLOSED'
              ? 'Pendaftaran project minggu ini sudah tutup (Jumat 23:59 WIB).'
              : err.code === 'FEATURE_CLOSED'
                ? 'Pendaftaran lagi ditutup sementara (kill-switch). Coba lagi nanti.'
                : `Gagal enroll: ${err.message}`
          : 'Gagal enroll. Cek koneksi lalu coba lagi.';
      showToast(message);
    } finally {
      setChoosing(false);
    }
  };

  const primaryLabel = enrolledHere
    ? enrollment?.status === 'active'
      ? 'Lanjutkan Project →'
      : enrollment?.status === 'review_ready'
        ? 'Lihat Feedback →'
        : enrollment?.status === 'completed'
          ? 'Ambil Lagi →'
          : 'Lihat Submission →'
    : 'Pilih Project Ini →';

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={choose}
          disabled={choosing}
          className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sk-md)] bg-white px-[26px] text-[14px] font-bold text-sk-blue shadow-md transition-transform duration-200 hover:-translate-y-px active:scale-[0.98] disabled:opacity-70"
        >
          {choosing ? 'Mendaftarkan…' : primaryLabel}
        </button>
        <Button variant="ghostOnDark" size="lg" onClick={toggleSave} iconLeft={saved ? <Check size={15} aria-hidden /> : undefined}>
          {saved ? 'Tersimpan' : 'Simpan untuk nanti'}
        </Button>
      </div>
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        continueTo={`/app/arena/workspace/${slug}`}
        onContinue={() => {
          // Setelah login, enroll beneran via API (bukan mock).
          setLoginOpen(false);
          void choose();
        }}
      />
    </>
  );
}

/* ---------------- Tabs (5 real content bodies) ---------------- */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted first:mt-0">
      {children}
    </h3>
  );
}

export function DetailTabs({ project }: { project: ArenaProject }) {
  const [activeTab, setActiveTab] = useState('overview');

  const infoRows: Array<{ k: string; v: string; accent?: boolean }> = [
    { k: 'Category', v: project.category },
    { k: 'Difficulty', v: project.difficulty },
    { k: 'Estimated Time', v: project.estimatedTime },
    { k: 'Deadline', v: project.deadlineLabel },
    ...(project.points != null ? [{ k: 'Points', v: `+${project.points}`, accent: true }] : []),
  ];

  const side = (
    <div className="hidden lg:block">
      <Card className="sticky top-24 p-6">
        <h4 className="mb-3.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Project Info</h4>
        <dl className="text-[13px]">
          {infoRows.map((row, i) => (
            <div key={row.k} className={`flex justify-between border-b border-dashed border-sk-border py-2.5 ${i === infoRows.length - 1 ? 'border-0' : ''}`}>
              <dt className="text-sk-muted">{row.k}</dt>
              <dd className={`font-bold ${row.accent ? 'text-sk-blue' : 'text-sk-navy'}`}>{row.v}</dd>
            </div>
          ))}
        </dl>

        <h4 className="mb-3 mt-6 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Rubric</h4>
        <ul className="flex flex-col gap-1.5">
          {project.rubric.map((r) => (
            <li key={r.id} className="text-[12.5px] text-sk-body">
              · {r.label} · {r.weight}
            </li>
          ))}
        </ul>

        <h4 className="mb-2.5 mt-6 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Resources</h4>
        <ResourceList resources={project.resources} />
      </Card>
    </div>
  );

  const overview = (
    <div>
      <SectionHeading>Case Background</SectionHeading>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.caseBackground}</p>

      <SectionHeading>Your Role</SectionHeading>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.role}</p>

      <SectionHeading>Objective</SectionHeading>
      <ul className="list-disc pl-[18px] text-[14px] leading-[1.7] text-sk-text">
        {project.objective.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>

      <SectionHeading>Deliverables</SectionHeading>
      <ul className="list-disc pl-[18px] text-[14px] leading-[1.7] text-sk-text">
        {project.deliverables.map((d) => (
          <li key={d.id}>{d.title}</li>
        ))}
      </ul>

      <SectionHeading>Skills You&apos;ll Prove</SectionHeading>
      <div className="flex flex-wrap gap-1.5">
        {project.skills.map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
    </div>
  );

  const brief = (
    <div>
      <SectionHeading>Mission</SectionHeading>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.mission}</p>

      <SectionHeading>Konteks Bisnis</SectionHeading>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.caseBackground}</p>

      <SectionHeading>Peran Kamu</SectionHeading>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.role}</p>

      <SectionHeading>Yang Dinilai Reviewer</SectionHeading>
      <p className="text-[14px] leading-[1.65] text-sk-text">
        Reviewer menilai pakai rubrik di tab Rubric — bukan kesukaan pribadi. Baca dulu sebelum mulai bekerja agar setiap
        keputusan kamu selaras dengan kriteria penilaian.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash p-4 text-[13px] leading-relaxed text-sk-body">
        <ListChecks size={17} className="mt-0.5 shrink-0 text-sk-blue" aria-hidden />
        Tips: tulis plan kerjamu di step berikutnya (Plan Your Work) sebelum eksekusi — submission dengan plan jelas
        biasanya lebih terstruktur.
      </div>
    </div>
  );

  const deliverables = (
    <div className="flex flex-col gap-3.5">
      {project.deliverables.map((d, i) => (
        <Card key={d.id} className="p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sk-blue-tint font-mono text-[12px] font-bold text-sk-blue">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h4 className="text-[15px] font-bold text-sk-navy">{d.title}</h4>
              {d.description && <p className="mt-1 text-[13px] leading-relaxed text-sk-muted">{d.description}</p>}
              <p className="mt-2 text-[12.5px] leading-relaxed text-sk-body">
                <span className="font-semibold text-sk-navy">Kriteria lolos: </span>
                {d.title.toLowerCase().includes('link')
                  ? 'Link bisa dibuka reviewer tanpa minta akses, isi terlihat utuh.'
                  : 'Lengkap, rapi, dan langsung menjawab objective project ini.'}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const resources = (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13.5px] leading-relaxed text-sk-muted">
        Semua yang kamu butuhkan untuk mulai. Kamu boleh menambah sumber lain — sebutkan di submission kalau dipakai.
      </p>
      {project.resources.map((r) => (
        <Card key={r.id} className="flex items-center gap-4 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sk-blue-tint text-sk-blue">
            {r.kind === 'link' ? <Link2 size={17} aria-hidden /> : <FileText size={17} aria-hidden />}
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-[13px] font-semibold text-sk-navy">{r.title}</div>
            <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-sk-muted">
              {r.kind === 'dataset' ? 'Dataset' : r.kind === 'template' ? 'Template' : r.kind === 'link' ? 'Link' : 'Dokumen'}
            </div>
          </div>
          <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-[12px] font-semibold text-sk-blue sm:flex">
            <ReceiptText size={13} aria-hidden /> Tersedia di workspace
          </span>
        </Card>
      ))}
      <div className="flex items-center gap-3 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border bg-white p-4 text-[12.5px] text-sk-body">
        <Users size={16} className="shrink-0 text-sk-muted" aria-hidden />
        Diskusi & tanya jawab project berlangsung di komunitas Arena setiap Rabu malam.
      </div>
    </div>
  );

  const rubric = (
    <div className="flex flex-col gap-3.5">
      <p className="text-[13.5px] leading-relaxed text-sk-muted">
        Total 100 poin. Skor 86+ masuk kandidat Weekly Spotlight.
      </p>
      {project.rubric.map((r) => (
        <Card key={r.id} className="p-5">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h4 className="text-[15px] font-bold text-sk-navy">{r.label}</h4>
            <Badge variant="blue">{r.weight} pts</Badge>
          </div>
          <p className="text-[13px] leading-relaxed text-sk-muted">{r.description}</p>
        </Card>
      ))}
    </div>
  );

  const tabItems = [
    { id: 'overview', label: 'Overview', content: overview },
    { id: 'brief', label: 'Brief', content: brief },
    { id: 'deliverables', label: 'Deliverables', content: deliverables },
    { id: 'resources', label: 'Resources', content: resources },
    { id: 'rubric', label: 'Rubric', content: rubric },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0">
        <Tabs items={tabItems} activeId={activeTab} onChange={setActiveTab} scrollable />
      </div>
      {side}
    </div>
  );
}
