'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, Check, CircleAlert, FileText, Link2, Plus, RefreshCw, Trash2, UploadCloud, X } from 'lucide-react';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { ChecklistRow } from '@/components/primitives/ChecklistRow';
import { WorkspaceStepper } from '@/components/primitives/WorkspaceStepper';
import { ErrorState } from '@/components/states/ErrorState';
import { ResourceList } from '@/components/arena/KanbanPreview';
import { WORKSPACE_STEP_LABELS } from '@/components/primitives/StatusBadge';
import { useToast } from '@/features/ui/toast';
import {
  ALLOWED_FILE_TYPES,
  ArenaApiError,
  FILE_PICKER_ACCEPT,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_LINKS,
  addSubmissionLink,
  deleteSubmissionItem,
  finalizeUpload,
  formatBytes,
  getCurrentEnrollment,
  getSubmission,
  getVisibleProjectDetail,
  getWeekCurrent,
  getWorkspace,
  mimeForFilename,
  patchSubmissionDraft,
  patchWorkspace,
  requestUploadIntent,
  selectProject,
  submitEnrollment,
  type DraftItem,
  type VisibleProjectDetail,
  type WorkspacePatch,
  type WorkspaceStep as ServerStep,
} from '@/lib/arena-client';
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

function toServerStep(step: WorkspaceStep): ServerStep {
  return step.toUpperCase() as ServerStep;
}

function fromServerStep(step: ServerStep | null): WorkspaceStep {
  const lower = (step ?? 'BRIEF').toLowerCase();
  return (STEPS as string[]).includes(lower) ? (lower as WorkspaceStep) : 'brief';
}

function deadlineLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(date);
  const time = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(date);
  return `${weekday} · ${time}`;
}

function estimatedLabel(minutes: number | null): string {
  if (!minutes || minutes <= 0) return 'Fleksibel';
  const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(Math.round((minutes / 60) * 2) / 2);
  return `${formatted} jam`;
}

function friendlyError(err: unknown): string {
  if (err instanceof ArenaApiError) {
    switch (err.code) {
      case 'UNAUTHORIZED':
        return 'Sesi berakhir. Login ulang lalu coba lagi.';
      case 'WEEK_CLOSED':
      case 'WEEK_NOT_OPEN':
      case 'SUBMISSION_DEADLINE_PASSED':
      case 'SELECTION_DEADLINE_PASSED':
        return 'Week sudah tutup (Jumat 23:59 WIB). Perubahan tidak bisa disimpan.';
      case 'FEATURE_CLOSED':
        return 'Fitur lagi ditutup sementara (kill-switch). Coba lagi nanti.';
      case 'REVIEW_ATTEMPT_LIMIT_REACHED':
        return 'Jatah 3x review minggu ini habis.';
      case 'SUBMISSION_REQUIREMENTS_INCOMPLETE':
        return 'Requirement belum lengkap — tambah link/file sesuai ketentuan project.';
      case 'FILE_LIMIT_EXCEEDED':
        return `Maksimal ${MAX_FILES} file per submission.`;
      case 'LINK_LIMIT_EXCEEDED':
        return `Maksimal ${MAX_LINKS} link per submission.`;
      case 'FILE_TYPE_NOT_ALLOWED':
        return 'Tipe file tidak didukung. Pakai PDF, DOCX, PPTX, CSV, XLSX, PNG, JPG, atau WEBP.';
      case 'FILE_TOO_LARGE':
        return 'File melebihi 20 MB.';
      case 'UPLOAD_INTENT_NOT_FOUND':
      case 'UPLOAD_INTENT_EXPIRED':
        return 'Sesi upload kedaluwarsa. Coba upload ulang file-nya.';
      case 'UPLOAD_VALIDATION_FAILED':
        return 'File gagal diverifikasi server. Coba upload ulang.';
      case 'STORAGE_NOT_CONFIGURED':
        return 'Penyimpanan lagi bermasalah. Coba lagi nanti.';
      default:
        return `Gagal menyimpan: ${err.message}`;
    }
  }
  return 'Gagal menyimpan. Cek koneksi lalu coba lagi.';
}

interface LiveProject {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  estimatedTime: string;
  caseBackground: string;
  role: string;
  objective: string[];
  deliverables: Array<{ id: string; title: string; description?: string }>;
  skills: string[];
  linkRequirementId: string | null;
  fileRequirementId: string | null;
}

function toLiveProject(detail: VisibleProjectDetail): LiveProject {
  return {
    id: detail.id,
    slug: detail.slug,
    title: detail.title,
    category: detail.division.name,
    difficulty: detail.difficulty === 'STANDARD' ? 'Intermediate' : detail.difficulty,
    estimatedTime: estimatedLabel(detail.estimatedMinutes),
    caseBackground: detail.caseBackground ?? '',
    role: detail.roleDescription ?? '',
    objective: detail.objective ? [detail.objective] : [],
    deliverables: [],
    skills: detail.skills.map((s) => s.name),
    linkRequirementId: detail.requirements.find((r) => r.type === 'LINK')?.id ?? null,
    fileRequirementId: detail.requirements.find((r) => r.type === 'FILE')?.id ?? null,
  };
}

type UploadStatus = 'queued' | 'uploading' | 'verifying' | 'uploaded' | 'failed';

interface PendingUpload {
  key: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number | null; // null = indeterminate honest state
  error: string | null;
}

function putToCos(url: string, contentType: string, file: File, onProgress: (ratio: number | null) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', contentType);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      onProgress(event.lengthComputable && event.total > 0 ? event.loaded / event.total : null);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Upload gagal — cek koneksi lalu coba lagi.'));
    xhr.ontimeout = () => reject(new Error('Upload timeout. Coba lagi.'));
    xhr.send(file);
  });
}

export default function WorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { showToast } = useToast();

  const [boot, setBoot] = useState<'loading' | 'ready' | 'missing-project' | 'no-enrollment' | 'session-expired' | 'error'>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [project, setProject] = useState<LiveProject | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string>('ACTIVE');
  const [weekCode, setWeekCode] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [step, setStep] = useState<WorkspaceStep>('brief');

  // Plan step local drafts (persisted on save).
  const [approach, setApproach] = useState('');
  const [tools, setTools] = useState('');
  const [tasks, setTasks] = useState<{ id: string; label: string; done: boolean }[]>([]);
  const [newTask, setNewTask] = useState('');
  const [notes, setNotes] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [url, setUrl] = useState('');
  const [explanation, setExplanation] = useState('');
  const [finalChecks, setFinalChecks] = useState<Record<string, boolean>>({});
  const [urlError, setUrlError] = useState<string | null>(null);
  const [links, setLinks] = useState<Array<{ id: string; url: string }>>([]);
  const [files, setFiles] = useState<DraftItem[]>([]);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'idle' | 'submitting' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getVisibleProjectDetail(params.projectId);
        const enrollment = await getCurrentEnrollment();
        if (cancelled) return;
        if (!enrollment || enrollment.projectId !== detail.id) {
          setProject(toLiveProject(detail));
          setProjectId(detail.id);
          setBoot('no-enrollment');
          return;
        }
        const [ws, sub, week] = await Promise.all([
          getWorkspace(enrollment.id),
          getSubmission(enrollment.id),
          getWeekCurrent(),
        ]);
        if (cancelled) return;
        const live = toLiveProject(detail);
        live.deliverables = detail.requirements.map((r) => ({
          id: r.id,
          title: r.label,
          description: r.instructions ?? undefined,
        }));
        setProject(live);
        setProjectId(detail.id);
        setEnrollmentId(enrollment.id);
        setEnrollmentStatus(enrollment.status);
        setWeekCode(week.weekCode);
        setDeadline(deadlineLabel(week.submissionDeadlineAt));
        setStep(fromServerStep(ws?.currentStep ?? null));
        setApproach(ws?.planText ?? '');
        setTools((ws?.tools ?? []).join(', '));
        setTasks(
          ws?.taskBreakdown && ws.taskBreakdown.length > 0
            ? ws.taskBreakdown.map((t, i) => ({ id: `t-${i + 1}`, label: t.title, done: t.done }))
            : DEFAULT_TASKS.map((label, i) => ({ id: `t-${i + 1}`, label, done: false })),
        );
        setNotes(ws?.notes ?? sub.notes ?? '');
        const serverChecks = new Map((ws?.reviewChecklist ?? []).map((c) => [c.label, c.done]));
        const nextChecks: Record<string, boolean> = {};
        for (const item of REVIEW_ITEMS) nextChecks[item.id] = serverChecks.get(item.label) ?? false;
        setChecks(nextChecks);
        // Draft attachments come from the server — refresh-safe, device-safe.
        setLinks(
          sub.items
            .filter((item) => item.itemType === 'LINK' && item.externalUrl)
            .map((item) => ({ id: item.id, url: item.externalUrl as string })),
        );
        setFiles(sub.items.filter((item) => item.itemType === 'FILE'));
        setUrl('');
        setExplanation(sub.explanation ?? '');
        setBoot('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ArenaApiError && (err.code === 'PROJECT_NOT_FOUND' || err.code === 'PROJECT_NOT_PUBLISHED')) {
          setBoot('missing-project');
        } else if (err instanceof ArenaApiError && err.status === 401) {
          setBoot('session-expired');
        } else {
          setBootError(friendlyError(err));
          setBoot('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.projectId]);

  const savePatch = async (patch: WorkspacePatch, toastMsg?: string) => {
    if (!enrollmentId) return;
    try {
      await patchWorkspace(enrollmentId, patch);
      if (toastMsg) showToast(toastMsg);
    } catch (err) {
      showToast(friendlyError(err));
    }
  };

  const goStep = (target: WorkspaceStep) => {
    setStep(target);
    void savePatch({ currentStep: toServerStep(target) });
  };

  const stepIndex = STEPS.indexOf(step);
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const doneMandatory = useMemo(
    () => REVIEW_ITEMS.filter((i) => i.mandatory && (checks[i.id] ?? false)).length,
    [checks],
  );
  const allMandatory = doneMandatory === REVIEW_ITEMS.filter((i) => i.mandatory).length;
  const allFinalChecked = SUBMIT_CHECKLIST.every((c) => finalChecks[c.id]);

  const enrollHere = async () => {
    if (!projectId) return;
    try {
      const res = await selectProject(projectId);
      setEnrollmentId(res.enrollment.id);
      setEnrollmentStatus(res.enrollment.status);
      setBoot('ready');
      router.refresh();
    } catch (err) {
      showToast(friendlyError(err));
    }
  };

  const toggleCheck = (id: string) => {
    const next = { ...checks, [id]: !(checks[id] ?? false) };
    setChecks(next);
    void savePatch({
      reviewChecklist: REVIEW_ITEMS.map((item) => ({ label: item.label, done: next[item.id] ?? false })),
    });
  };

  const busyUploads = uploads.length > 0;

  const setUploadState = (key: string, patch: Partial<PendingUpload>) => {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  };

  const runUpload = async (entry: PendingUpload) => {
    if (!enrollmentId || !project?.fileRequirementId) return;
    const mime = mimeForFilename(entry.name) ?? entry.file.type;
    setUploadState(entry.key, { status: 'uploading', progress: null, error: null });
    try {
      // Fresh intent per attempt: retry never reuses an expired authorization
      // and never duplicates a finalized draft item.
      const intent = await requestUploadIntent(enrollmentId, {
        requirementId: project.fileRequirementId,
        filename: entry.name,
        mimeType: mime,
        sizeBytes: entry.file.size,
      });
      await putToCos(intent.uploadUrl, mime, entry.file, (ratio) =>
        setUploadState(entry.key, { progress: ratio }),
      );
      setUploadState(entry.key, { status: 'verifying', progress: null });
      const item = await finalizeUpload(enrollmentId, intent.intentId);
      setFiles((prev) => [...prev, item]);
      setUploads((list) => list.filter((u) => u.key !== entry.key));
      showToast('File terupload dan tersimpan di draft.');
    } catch (err) {
      // Upload failure consumes nothing: no draft item, no review attempt.
      setUploadState(entry.key, { status: 'failed', error: friendlyError(err) });
    }
  };

  const queueFiles = (picked: FileList | File[]) => {
    if (!project?.fileRequirementId) {
      showToast('Project ini tidak menerima file — pakai link atau hubungi admin Arena.');
      return;
    }
    const allowedMimes = new Set(Object.values(ALLOWED_FILE_TYPES));
    // Counted locally: state updates are batched, so one multi-file drop would
    // otherwise read a stale count and queue past the cap.
    let slotsUsed = files.length + uploads.length;
    for (const file of Array.from(picked)) {
      const mime = mimeForFilename(file.name) ?? (allowedMimes.has(file.type) ? file.type : null);
      if (!mime) {
        showToast(`“${file.name}” ditolak: tipe file tidak didukung.`);
        continue;
      }
      if (file.size <= 0) {
        showToast(`“${file.name}” ditolak: file kosong.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        showToast(`“${file.name}” ditolak: melebihi 20 MB.`);
        continue;
      }
      if (slotsUsed >= MAX_FILES) {
        showToast(`Maksimal ${MAX_FILES} file per submission.`);
        break;
      }
      slotsUsed += 1;
      const entry: PendingUpload = {
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name: file.name,
        size: file.size,
        status: 'queued',
        progress: null,
        error: null,
      };
      setUploads((list) => [...list, entry]);
      void runUpload(entry);
    }
  };

  const removeDraftItem = async (id: string) => {
    if (!enrollmentId) return;
    try {
      await deleteSubmissionItem(enrollmentId, id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setLinks((prev) => prev.filter((l) => l.id !== id));
      showToast('Lampiran dihapus dari draft.');
    } catch (err) {
      showToast(friendlyError(err));
    }
  };

  const addLink = async () => {
    const error = validateUrl(url);
    setUrlError(error);
    if (error || !project || !enrollmentId) return;
    if (!project.linkRequirementId) {
      showToast('Project ini tidak menerima submission link — hubungi admin Arena.');
      return;
    }
    if (links.length >= MAX_LINKS) {
      showToast(`Maksimal ${MAX_LINKS} link per submission.`);
      return;
    }
    try {
      const normalized = url.startsWith('http') ? url.trim() : `https://${url.trim()}`;
      const item = await addSubmissionLink(enrollmentId, { requirementId: project.linkRequirementId, url: normalized });
      setLinks((prev) => [...prev, { id: item.id, url: normalized }]);
      setUrl('');
      showToast('Link ditambahkan ke draft.');
    } catch (err) {
      showToast(friendlyError(err));
    }
  };

  const submitProject = async () => {
    if (!project || !enrollmentId) return;
    if (busyUploads) {
      showToast('Tunggu semua file selesai diupload dulu.');
      return;
    }
    // Link yang masih diketik tapi belum ditambahkan ikut disertakan.
    if (url.trim()) {
      const error = validateUrl(url);
      setUrlError(error);
      if (error) return;
      if (!project.linkRequirementId) {
        showToast('Project ini tidak menerima submission link — hubungi admin Arena.');
        return;
      }
      try {
        const normalized = url.startsWith('http') ? url.trim() : `https://${url.trim()}`;
        const item = await addSubmissionLink(enrollmentId, { requirementId: project.linkRequirementId, url: normalized });
        setLinks((prev) => [...prev, { id: item.id, url: normalized }]);
        setUrl('');
      } catch (err) {
        showToast(friendlyError(err));
        return;
      }
    }
    if (links.length === 0 && files.length === 0) {
      showToast('Tambahkan minimal satu file atau link dulu.');
      return;
    }
    setPhase('submitting');
    try {
      await patchSubmissionDraft(enrollmentId, { explanation: explanation || null, notes: notes || null });
      const result = await submitEnrollment(enrollmentId);
      showToast(
        result.version.accessStatus === 'ACCESSIBLE'
          ? `Submission #${result.version.reviewAttemptNumber ?? ''} diterima — hasil disegel sampai finalisasi Jumat.`
          : 'Ada lampiran yang tidak bisa dibuka reviewer — jatah 3x review kamu aman. Benerin sebelum deadline.',
      );
      router.push(`/app/arena/submission/${project.slug}`);
    } catch (err) {
      setPhase('error');
      showToast(friendlyError(err));
    }
  };

  /* ---------- Guards ---------- */
  if (boot === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
        <span className="h-8 w-8 rounded-full border-[3px] border-sk-blue-tint border-t-sk-blue anim-spin" />
      </div>
    );
  }

  if (boot === 'missing-project' || (boot === 'ready' && !project)) {
    return (
      <ErrorState
        title="Project tidak ditemukan."
        description="Project yang kamu cari tidak tersedia atau sudah berakhir. Lihat project minggu ini untuk mulai."
        primaryAction={{ label: 'Lihat Project Minggu Ini', href: '/app/arena/projects' }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  if (boot === 'session-expired') {
    return (
      <ErrorState
        title="Sesi berakhir."
        description="Login ulang untuk membuka workspace project kamu."
        primaryAction={{ label: 'Login', href: '/login' }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  if (boot === 'error') {
    return (
      <ErrorState
        title="Workspace gagal dimuat."
        description={bootError ?? 'Coba muat ulang halaman ini.'}
        primaryAction={{ label: 'Muat Ulang', href: `/app/arena/workspace/${params.projectId}` }}
        secondaryAction={{ label: 'Kembali ke Arena', href: '/app/arena' }}
      />
    );
  }

  if (boot === 'no-enrollment' || !enrollmentId || !project) {
    return (
      <ErrorState
        title="Kamu belum mengambil project ini."
        description="Pilih project ini dulu di halaman detail, lalu workspace-nya akan terbuka di sini."
        primaryAction={{
          label: 'Pilih Project Ini',
          onClick: () => {
            void enrollHere();
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
        <Button onClick={() => goStep('plan')}>Saya Paham, Mulai Rencanakan →</Button>
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
        Plan yang jelas membuat eksekusi lebih fokus. Isi singkat saja — tersimpan di server, bisa dilanjut dari mana saja.
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
            void savePatch(
              {
                currentStep: 'WORK',
                planText: approach || null,
                tools: tools
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 50),
                taskBreakdown: tasks.map((t) => ({ title: t.label, done: t.done })),
              },
              'Plan tersimpan di server. Selamat mengerjakan!',
            );
            setStep('work');
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
          Catatan Pribadi (tersimpan di server)
        </span>
        <Textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            void savePatch({ notes });
          }}
          placeholder="Temuan, pertanyaan, atau keputusan yang ingin kamu ingat saat mengerjakan…"
        />
      </label>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <Button onClick={() => goStep('review')}>Lanjut ke Review Checklist →</Button>
        <Button
          variant="ghost"
          onClick={() => {
            void savePatch({ notes }, 'Catatan tersimpan.');
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
            checked={checks[item.id] ?? false}
            onToggle={() => toggleCheck(item.id)}
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
        <Button disabled={!allMandatory} onClick={() => goStep('submit')}>
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
        Lampirkan file dan/atau link publik berisi deliverables-mu. Reviewer akan membukanya langsung. Maksimal 3x
        review valid per minggu — kegagalan teknis tidak memakan jatah.
      </p>

      <div>
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">
          Deliverables · {files.length + uploads.length} / {MAX_FILES} file
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) queueFiles(e.dataTransfer.files);
          }}
          aria-label="Upload file deliverables: klik untuk pilih atau seret file ke sini"
          className={`flex w-full flex-col items-center gap-2 rounded-[var(--radius-sk-lg)] border border-dashed px-4 py-7 text-center transition-colors ${
            dragOver ? 'border-sk-blue bg-sk-blue-wash' : 'border-sk-blue-tint-border bg-sk-blue-wash/50 hover:border-sk-blue'
          }`}
        >
          <UploadCloud size={22} aria-hidden className="text-sk-blue" />
          <span className="text-[13.5px] font-bold text-sk-navy">Seret file ke sini atau klik untuk pilih</span>
          <span className="text-[12px] text-sk-muted">PDF, DOCX, PPTX, CSV, XLSX, PNG, JPG, WEBP · maks 20 MB/file</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={FILE_PICKER_ACCEPT}
          className="hidden"
          aria-hidden={false}
          aria-label="Pilih file deliverables"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) queueFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {(files.length > 0 || uploads.length > 0) && (
          <ul className="mt-3 flex flex-col gap-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-3.5 py-2.5"
              >
                <FileText size={16} aria-hidden className="shrink-0 text-sk-blue" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-sk-navy">{f.originalFilename ?? 'File'}</span>
                  <span className="block font-mono text-[11px] text-sk-muted">
                    {f.fileSizeBytes != null ? formatBytes(f.fileSizeBytes) : ''} · Uploaded
                  </span>
                </span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sk-success text-white" aria-label="Terupload">
                  <Check size={11} strokeWidth={3.5} aria-hidden />
                </span>
                <button
                  type="button"
                  aria-label={`Hapus ${f.originalFilename ?? 'file'} dari draft`}
                  onClick={() => {
                    void removeDraftItem(f.id);
                  }}
                  className="shrink-0 rounded-md p-1.5 text-sk-faint transition-colors hover:bg-sk-error-wash hover:text-sk-error"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
            {uploads.map((u) => (
              <li
                key={u.key}
                className="flex items-center gap-3 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-3.5 py-2.5"
              >
                <FileText size={16} aria-hidden className="shrink-0 text-sk-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-sk-navy">{u.name}</span>
                  <span className="block font-mono text-[11px] text-sk-muted">
                    {formatBytes(u.size)} ·{' '}
                    {u.status === 'failed' ? (
                      <span className="text-sk-error">{u.error ?? 'Upload gagal.'}</span>
                    ) : u.status === 'verifying' ? (
                      'Memverifikasi…'
                    ) : u.progress != null ? (
                      `Mengupload ${Math.round(u.progress * 100)}%`
                    ) : (
                      'Mengupload…'
                    )}
                  </span>
                  {u.status !== 'failed' && (
                    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sk-track" aria-hidden>
                      <span
                        className={`block h-full rounded-full bg-sk-blue transition-all ${u.progress == null ? 'w-1/3 animate-pulse' : ''}`}
                        style={u.progress != null ? { width: `${Math.round(u.progress * 100)}%` } : undefined}
                      />
                    </span>
                  )}
                </span>
                {u.status === 'failed' ? (
                  <button
                    type="button"
                    aria-label={`Coba lagi upload ${u.name}`}
                    onClick={() => {
                      void runUpload(u);
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-bold text-sk-blue transition-colors hover:bg-sk-blue-tint"
                  >
                    <RefreshCw size={13} aria-hidden /> Coba lagi
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0 rounded-full border-2 border-sk-blue-tint border-t-sk-blue anim-spin" aria-label="Mengupload" />
                )}
                <button
                  type="button"
                  aria-label={`Batalkan upload ${u.name}`}
                  onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                  className="shrink-0 rounded-md p-1.5 text-sk-faint transition-colors hover:bg-sk-error-wash hover:text-sk-error"
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">
          Links · {links.length} / {MAX_LINKS}
        </span>
        {links.length > 0 && (
          <ul className="mb-2.5 flex flex-col gap-2">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-2.5 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-3.5 py-2.5"
              >
                <Link2 size={14} aria-hidden className="shrink-0 text-sk-blue" />
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-sk-navy">{l.url}</span>
                <button
                  type="button"
                  aria-label={`Hapus link ${l.url}`}
                  onClick={() => {
                    void removeDraftItem(l.id);
                  }}
                  className="shrink-0 rounded-md p-1.5 text-sk-faint transition-colors hover:bg-sk-error-wash hover:text-sk-error"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlError(null);
            }}
            invalid={Boolean(urlError)}
            placeholder="https://lookerstudio.google.com/reporting/…"
            aria-label="Tambah submission link"
            className="flex-1"
          />
          <Button variant="ghost" onClick={() => void addLink()} className="shrink-0">
            + Tambah Link
          </Button>
        </div>
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
      </div>

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
          disabled={!allFinalChecked || phase === 'submitting' || busyUploads}
          loading={phase === 'submitting'}
          onClick={() => {
            void submitProject();
          }}
          className="min-w-[220px]"
        >
          {phase === 'submitting' ? 'Mengirim submission…' : 'Submit Project →'}
        </Button>
        {phase === 'submitting' && (
          <span className="inline-flex items-center text-[12.5px] text-sk-muted">Memvalidasi link & deliverables…</span>
        )}
        {busyUploads && phase !== 'submitting' && (
          <span className="inline-flex items-center text-[12.5px] text-sk-muted">Tunggu file selesai diupload dulu…</span>
        )}
      </div>
    </div>
  );

  const stepBodies = [briefBody, planBody, workBody, reviewBody, submitBody];
  const statusLabel =
    enrollmentStatus === 'ACTIVE'
      ? 'IN PROGRESS'
      : enrollmentStatus === 'SUBMITTED'
        ? 'MENUNGGU REVIEW'
        : enrollmentStatus === 'UNDER_REVIEW'
          ? 'SEDANG DIREVIEW'
          : enrollmentStatus === 'REVIEW_READY'
            ? 'FEEDBACK SIAP'
            : enrollmentStatus === 'COMPLETED'
              ? 'COMPLETED'
              : enrollmentStatus.replace(/_/g, ' ');

  return (
    <div>
      {/* Header bar */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-4 py-3 sm:px-5">
        <Badge variant="slate">{project.category.toUpperCase()}</Badge>
        <span className="text-[15px] font-bold text-sk-navy sm:text-[17px]">{project.title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="hidden font-mono text-[11.5px] text-sk-muted sm:inline">DEADLINE · {deadline.toUpperCase()}</span>
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
          if (STEPS.indexOf(target) <= stepIndex) goStep(target);
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
              {deadline}
            </div>
            <div className="mt-1 text-[12px] text-sk-muted">{weekCode ? `Minggu ${weekCode} · tutup Jumat 23:59 WIB` : ''}</div>
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
            <ResourceList resources={[]} />
          </Card>

          <Card className="p-5">
            <h5 className="mb-2.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">Project Status</h5>
            <Badge variant="slate">{statusLabel}</Badge>
            <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-sk-muted">
              <FileText size={12} aria-hidden />
              Step {stepIndex + 1} dari 5 · {WORKSPACE_STEP_LABELS[step]}
            </div>
          </Card>

          <div className="flex items-center gap-2 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-border px-4 py-3 text-[11.5px] leading-relaxed text-sk-muted">
            <Link2 size={13} aria-hidden className="shrink-0" />
            Progress tersimpan di server — lanjut dari perangkat mana pun.
          </div>
        </div>
      </div>
    </div>
  );
}
