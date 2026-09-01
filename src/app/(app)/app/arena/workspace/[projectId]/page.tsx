'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, Check, CircleAlert, FileText, Link2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { ChecklistRow } from '@/components/primitives/ChecklistRow';
import { WorkspaceStepper } from '@/components/primitives/WorkspaceStepper';
import { ErrorState } from '@/components/states/ErrorState';
import { ResourceList } from '@/components/arena/KanbanPreview';
import { StatusBadge, WORKSPACE_STEP_LABELS } from '@/components/primitives/StatusBadge';
import { useDemo } from '@/features/demo/store';
import { useToast } from '@/features/ui/toast';
import { getProject } from '@/data/mock/projects';
import type { WorkspaceStep } from '@/types/project';

const STEPS: WorkspaceStep[] = ['brief', 'plan', 'work', 'review', 'submit'];

const REVIEW_ITEMS = [
  { id: 'deliverables', label: 'Deliverables lengkap', mandatory: true },
  { id: 'accessible', label: 'Output dapat diakses', mandatory: true },
  { id: 'requirements', label: 'Requirement terpenuhi', mandatory: true },
  { id: 'naming', label: 'Naming / formatting rapi', mandatory: false },
  { id: 'insight', label: 'Insight mudah dipahami', mandatory: true },
  { id: 'final-check', label: 'Final quality check selesai', mandatory: false },
];

const SUBMIT_CHECKLIST = [
  { id: 'link-ok', label: 'Link dapat diakses' },
  { id: 'deliverables-ok', label: 'Deliverables lengkap' },
  { id: 'permission-ok', label: 'Permission sudah benar' },
];

const DEFAULT_TASKS = [
  'Understand dataset / brief',
  'Identify key metrics',
  'Create main deliverable structure',
  'Validate insights & quality',
  'Finalize presentation',
];

const ALLOWED_URL_HOSTS = ['drive.google.com', 'docs.google.com', 'notion.so', 'notion.site', 'github.com', 'figma.com', 'canva.com'];

function validateUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'URL wajib diisi — reviewer butuh akses ke hasil kerjamu.';
  let parsed: URL;
  try {
    parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return 'Format URL tidak valid. Contoh: https://drive.google.com/file/…';
  }
  if (parsed.protocol !== 'https:') return 'URL harus menggunakan HTTPS agar reviewer bisa membukanya.';
  const host = parsed.hostname.replace(/^www\./, '');
  const genericOk = /\.(com|io|dev|app|id|net|org|co)$/.test(host) && host.includes('.');
  if (!ALLOWED_URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) && !genericOk) {
    return 'Gunakan Google Drive, Docs, Notion, GitHub, Figma, Canva, atau link HTTPS publik lain.';
  }
  return null;
}

export default function WorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { state, dispatch, hydrated } = useDemo();
  const { showToast } = useToast();

  const project = getProject(params.projectId);
  const enrollment = state.enrollment;
  const belongsHere = Boolean(enrollment && enrollment.projectSlug === params.projectId);

  const [phase, setPhase] = useState<'idle' | 'submitting' | 'error'>('idle');

  // Plan step local drafts (persisted on save).
  const [approach, setApproach] = useState('');
  const [tools, setTools] = useState('');
  const [tasks, setTasks] = useState<{ id: string; label: string; done: boolean }[]>([]);
  const [newTask, setNewTask] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [explanation, setExplanation] = useState('');
  const [finalChecks, setFinalChecks] = useState<Record<string, boolean>>({});
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || !belongsHere || !enrollment) return;
    setApproach(enrollment.plan.approach);
    setTools(enrollment.plan.tools);
    setTasks(
      enrollment.plan.tasks.length > 0
        ? enrollment.plan.tasks
        : DEFAULT_TASKS.map((label, i) => ({ id: `t-${i + 1}`, label, done: false })),
    );
    setNotes(enrollment.notes);
    setUrl(enrollment.submission?.url ?? '');
    setExplanation(enrollment.submission?.explanation ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, belongsHere]);

  const step = belongsHere && enrollment ? enrollment.workspaceStep : 'brief';
  const stepIndex = STEPS.indexOf(step);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const doneMandatory = useMemo(
    () => REVIEW_ITEMS.filter((i) => i.mandatory && (enrollment?.checklist?.[i.id] ?? false)).length,
    [enrollment?.checklist],
  );
  const allMandatory = doneMandatory === REVIEW_ITEMS.filter((i) => i.mandatory).length;
  const allFinalChecked = SUBMIT_CHECKLIST.every((c) => finalChecks[c.id]);

  const submitProject = () => {
    const error = validateUrl(url);
    setUrlError(error);
    if (error || !project) return;
    setPhase('submitting');
    window.setTimeout(() => {
      dispatch({
        type: 'WS_SUBMIT',
        submission: {
          url: url.startsWith('http') ? url : `https://${url.trim()}`,
          explanation,
          notes,
          submittedAt: new Date().toISOString(),
        },
      });
      router.push(`/app/arena/submission/${project.slug}`);
    }, 1_400);
  };

  /* ---------- Guard: missing / invalid demo project state ---------- */
  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
        <span className="h-8 w-8 rounded-full border-[3px] border-sk-blue-tint border-t-sk-blue anim-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <ErrorState
        title="Project tidak ditemukan."
        description="Project yang kamu cari tidak tersedia atau sudah berakhir. Lihat project minggu ini untuk mulai."
        primaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  if (!belongsHere || !enrollment) {
    return (
      <ErrorState
        title="Kamu belum mengambil project ini."
        description="Pilih project ini dulu di halaman detail, lalu workspace-nya akan terbuka di sini."
        primaryAction={{
          label: 'Pilih Project Ini',
          onClick: () => {
            dispatch({ type: 'ENROLL', projectSlug: project.slug });
            router.refresh();
          },
        }}
        secondaryAction={{ label: 'Lihat Project Lain', href: '/app/arena/projects' }}
      />
    );
  }

  /* ---------- Step bodies ---------- */

  const briefBody = (
    <div>
      <span className="eyebrow">Step 1 · Brief</span>
      <h2 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[30px]">
        Baca brief dengan teliti.
      </h2>
      <p className="mb-6 max-w-[640px] text-[14px] leading-[1.6] text-sk-muted">
        Sebelum mulai kerja, pastikan kamu paham konteks bisnis, role kamu, dan apa yang harus di-deliver di akhir minggu.
      </p>

      <h4 className="mb-2 mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Case Background</h4>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.caseBackground}</p>

      <h4 className="mb-2 mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Role</h4>
      <p className="text-[14px] leading-[1.65] text-sk-text">{project.role}</p>

      <h4 className="mb-2 mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Objective</h4>
      <ul className="list-disc space-y-1 pl-[18px] text-[14px] leading-[1.7] text-sk-text">
        {project.objective.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>

      <h4 className="mb-2 mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Deliverables</h4>
      <ul className="list-disc space-y-1 pl-[18px] text-[14px] leading-[1.7] text-sk-text">
        {project.deliverables.map((d) => (
          <li key={d.id}>
            <b className="font-semibold">{d.title}</b>
            {d.description ? ` — ${d.description}` : ''}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <Button
          onClick={() => {
            dispatch({ type: 'WS_SET_STEP', step: 'plan' });
          }}
        >
          Saya Paham, Mulai Rencanakan →
        </Button>
      </div>
    </div>
  );

  const planBody = (
    <div>
      <span className="eyebrow">Step 2 · Plan Your Work</span>
      <h2 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[30px]">
        Rencanakan kerjamu.
      </h2>
      <p className="mb-6 max-w-[640px] text-[14px] leading-[1.6] text-sk-muted">
        Plan yang jelas membuat eksekusi lebih fokus. Isi singkat saja — ini untuk kamu sendiri.
      </p>

      <label className="block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">My Approach</span>
        <Textarea
          rows={3}
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          placeholder="Bagaimana kamu akan menyelesaikan project ini? (2–4 kalimat)"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Tools I Will Use</span>
        <Input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Contoh: Excel, Google Sheets, Looker Studio" />
      </label>

      <div className="mt-5">
        <span className="mb-2 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Mini Task Breakdown</span>
        <div className="rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-2">
          {tasks.map((task) => (
            <div key={task.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sk-bg">
              <button
                type="button"
                role="checkbox"
                aria-checked={task.done}
                aria-label={task.label}
                onClick={() => setTasks((t) => t.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)))}
                className={`flex h-5.5 w-5.5 h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  task.done ? 'border-sk-success bg-sk-success text-white' : 'border-sk-blue-tint-border group-hover:border-sk-blue'
                }`}
              >
                {task.done && <Check size={12} strokeWidth={3.5} aria-hidden />}
              </button>
              <input
                value={task.label}
                onChange={(e) => setTasks((t) => t.map((x) => (x.id === task.id ? { ...x, label: e.target.value } : x)))}
                className={`w-full bg-transparent text-[13.5px] focus:outline-none ${task.done ? 'text-sk-muted line-through' : 'text-sk-navy'}`}
                aria-label={`Task: ${task.label}`}
              />
              <button
                type="button"
                aria-label={`Hapus task ${task.label}`}
                onClick={() => setTasks((t) => t.filter((x) => x.id !== task.id))}
                className="shrink-0 rounded-md p-1.5 text-sk-faint opacity-0 transition-opacity hover:bg-sk-error-wash hover:text-sk-error group-hover:opacity-100"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Plus size={15} aria-hidden className="shrink-0 text-sk-faint" />
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTask.trim()) {
                  e.preventDefault();
                  setTasks((t) => [...t, { id: `t-${Date.now()}`, label: newTask.trim(), done: false }]);
                  setNewTask('');
                }
              }}
              placeholder="Tambah task baru, tekan Enter"
              aria-label="Tambah task baru"
              className="w-full bg-transparent text-[13.5px] text-sk-navy placeholder:text-sk-faint focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <Button
          onClick={() => {
            dispatch({ type: 'WS_SAVE_PLAN', plan: { approach, tools, tasks } });
            dispatch({ type: 'WS_SET_STEP', step: 'work' });
            showToast('Plan tersimpan. Selamat mengerjakan!');
          }}
        >
          Simpan Plan & Mulai Kerja →
        </Button>
      </div>
    </div>
  );

  const doneTasks = tasks.filter((t) => t.done).length;
  const workProgress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const workBody = (
    <div>
      <span className="eyebrow">Step 3 · Do The Work</span>
      <h2 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[30px]">
        Saatnya eksekusi.
      </h2>
      <p className="mb-6 max-w-[640px] text-[14px] leading-[1.6] text-sk-muted">
        Kamu mengerjakan di tool masing-masing (Excel, Figma, Docs — sesuai project). Halaman ini membantu kamu tetap on-track
        sampai deadline.
      </p>

      <div className="mb-5 flex items-center gap-3.5 rounded-[var(--radius-sk-lg)] border border-sk-border bg-sk-bg p-4">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sk-track">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-mint"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${workProgress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-sk-blue">
          {doneTasks}/{tasks.length} TASK · {workProgress}%
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Task Kamu</h4>
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <li key={t.id} className={`flex items-start gap-2 text-[13.5px] ${t.done ? 'text-sk-muted line-through' : 'text-sk-text'}`}>
                <span aria-hidden className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${t.done ? 'bg-sk-success' : 'bg-sk-blue'}`} />
                {t.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Deliverables Target</h4>
          <ul className="flex flex-col gap-1.5">
            {project.deliverables.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-[13.5px] leading-snug text-sk-text">
                <Check size={14} aria-hidden className="mt-0.5 shrink-0 text-sk-success" />
                {d.title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">
          Catatan Pribadi (tersimpan lokal)
        </span>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => dispatch({ type: 'WS_SAVE_NOTES', notes })}
          placeholder="Temuan, pertanyaan, atau keputusan yang ingin kamu ingat saat mengerjakan…"
        />
      </label>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <Button onClick={() => dispatch({ type: 'WS_SET_STEP', step: 'review' })}>Lanjut ke Review Checklist →</Button>
        <Button
          variant="ghost"
          onClick={() => {
            dispatch({ type: 'WS_SAVE_NOTES', notes });
            showToast('Catatan tersimpan.');
          }}
        >
          Simpan Catatan
        </Button>
      </div>
    </div>
  );

  const reviewBody = (
    <div>
      <span className="eyebrow">Step 4 · Review Checklist</span>
      <h2 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[30px]">
        Periksa sebelum kirim.
      </h2>
      <p className="mb-6 max-w-[640px] text-[14px] leading-[1.6] text-sk-muted">
        Reviewer menilai apa yang terlihat. Pastikan semua item wajib tercentang sebelum lanjut ke submit.
      </p>

      <div className="rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-3 py-2">
        {REVIEW_ITEMS.map((item) => (
          <ChecklistRow
            key={item.id}
            label={item.label}
            mandatory={item.mandatory}
            checked={enrollment.checklist?.[item.id] ?? false}
            onToggle={() => dispatch({ type: 'WS_TOGGLE_CHECK', id: item.id, value: !(enrollment.checklist?.[item.id] ?? false) })}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sk-track">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-mint"
            animate={{ width: `${(doneMandatory / REVIEW_ITEMS.filter((i) => i.mandatory).length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className="font-mono text-[11px] font-bold text-sk-blue">
          {doneMandatory}/{REVIEW_ITEMS.filter((i) => i.mandatory).length} WAJIB
        </span>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Button disabled={!allMandatory} onClick={() => dispatch({ type: 'WS_SET_STEP', step: 'submit' })}>
          Lanjut ke Submit →
        </Button>
        {!allMandatory && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-sk-warning-ink">
            <CircleAlert size={13} aria-hidden /> Selesaikan semua item wajib dulu
          </span>
        )}
      </div>
    </div>
  );

  const submitBody = (
    <div>
      <span className="eyebrow">Step 5 · Submit</span>
      <h2 className="mb-2 mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[30px]">
        Submit project kamu.
      </h2>
      <p className="mb-6 max-w-[640px] text-[14px] leading-[1.6] text-sk-muted">
        Satu link publik yang berisi semua deliverables. Reviewer akan membukanya langsung.
      </p>

      <label className="block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Submission Link</span>
        <Input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError(null);
          }}
          invalid={Boolean(urlError)}
          placeholder="https://lookerstudio.google.com/reporting/…"
          aria-label="Submission link"
        />
        {urlError && (
          <span role="alert" className="mt-1.5 block text-[12px] text-sk-error">
            {urlError}
          </span>
        )}
        <span className="mt-2 flex flex-wrap gap-1.5">
          {['Google Drive', 'Docs', 'Notion', 'GitHub', 'Figma', 'Canva', 'HTTPS publik'].map((h) => (
            <span key={h} className="rounded bg-sk-track px-2 py-0.5 font-mono text-[10px] text-sk-muted">
              {h}
            </span>
          ))}
        </span>
      </label>

      <label className="mt-5 block">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Short Explanation</span>
        <Textarea
          rows={3}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="Ringkas apa yang kamu buat dan insight utamanya…"
        />
      </label>

      <div className="mt-5 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash p-4">
        <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-blue">Final Checklist</div>
        <div className="flex flex-col">
          {SUBMIT_CHECKLIST.map((item) => (
            <ChecklistRow
              key={item.id}
              label={item.label}
              checked={finalChecks[item.id] ?? false}
              onToggle={() => setFinalChecks((c) => ({ ...c, [item.id]: !c[item.id] }))}
            />
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <Button
          disabled={!allFinalChecked || !url.trim()}
          loading={phase === 'submitting'}
          onClick={submitProject}
          className="min-w-[220px]"
        >
          {phase === 'submitting' ? 'Mengirim submission…' : 'Submit Project →'}
        </Button>
        {phase === 'submitting' && (
          <span className="inline-flex items-center text-[12.5px] text-sk-muted">Memvalidasi link & deliverables…</span>
        )}
      </div>
    </div>
  );

  const stepBodies = [briefBody, planBody, workBody, reviewBody, submitBody];

  return (
    <div>
      {/* Header bar */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-4 py-3 sm:px-5">
        <Badge variant="slate">{project.category.toUpperCase()}</Badge>
        <span className="text-[15px] font-bold text-sk-navy sm:text-[17px]">{project.title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="hidden font-mono text-[11.5px] text-sk-muted sm:inline">DEADLINE · {project.deadlineLabel.toUpperCase()}</span>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-sk-track">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-mint"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <span className="font-mono text-[11.5px] font-bold text-sk-blue">{progress}%</span>
        </div>
      </div>

      <WorkspaceStepper
        current={step}
        onStepClick={(target) => {
          // Allow going back to earlier steps only.
          if (STEPS.indexOf(target) <= stepIndex) dispatch({ type: 'WS_SET_STEP', step: target });
        }}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-6 sm:p-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -14 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {stepBodies[stepIndex]}
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Side meta panel */}
        <div className="flex flex-col gap-4">
          <Card className="p-4.5 p-5">
            <h5 className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Deadline</h5>
            <div className="flex items-center gap-2 text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy">
              <CalendarClock size={17} className="text-sk-warning" aria-hidden />
              {project.deadlineLabel}
            </div>
            <div className="mt-1 text-[12px] text-sk-muted">Jumat minggu ini · 21:59 WIB</div>
          </Card>

          <Card className="p-5">
            <h5 className="mb-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
              Skills You&apos;ll Prove
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {project.skills.map((s) => (
                <span key={s} className="rounded-md bg-sk-blue-tint px-2 py-1 font-mono text-[11px] text-sk-blue">
                  {s}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h5 className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Resources</h5>
            <ResourceList resources={project.resources} />
          </Card>

          <Card className="p-5">
            <h5 className="mb-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Project Status</h5>
            <StatusBadge status={enrollment.status} />
            <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-sk-muted">
              <FileText size={12} aria-hidden />
              Step {stepIndex + 1} dari 5 · {WORKSPACE_STEP_LABELS[step]}
            </div>
          </Card>

          <div className="flex items-center gap-2 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border px-4 py-3 text-[11.5px] leading-relaxed text-sk-muted">
            <Link2 size={13} aria-hidden className="shrink-0" />
            Progress tersimpan otomatis di browser ini.
          </div>
        </div>
      </div>
    </div>
  );
}
