'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { attributeAdminProjectCriteria, editAdminProject, getAdminProject, useAdminResource } from '@/lib/admin-client';
import { ArenaApiError } from '@/lib/arena-client';
import { jakartaDate } from '@/lib/jakarta-time';

type Draft = {
  title: string;
  shortDescription: string;
  caseBackground: string;
  roleDescription: string;
  mission: string;
  objective: string;
  estimatedMinutes: string;
};

/** Per-criterion prose the reviewer reads. Keyed by the criterion's position. */
type RubricDraft = Array<{ description: string; reviewInstruction: string }>;

/** The materials a participant opens to do the task. */
type ResourceDraft = Array<{ label: string; url: string }>;

/** packageSchema.resources allows twenty. */
const MAX_RESOURCES = 20;

const FIELDS: Array<{ key: keyof Draft; label: string; rows?: number }> = [
  { key: 'title', label: 'Judul' },
  { key: 'shortDescription', label: 'Deskripsi singkat', rows: 2 },
  { key: 'caseBackground', label: 'Latar kasus', rows: 5 },
  { key: 'roleDescription', label: 'Peran peserta', rows: 4 },
  { key: 'mission', label: 'Misi', rows: 4 },
  { key: 'objective', label: 'Tujuan', rows: 3 },
];

/**
 * The rule packageSchema.resources applies, checked here so the editor names
 * the row at fault — the server would only report that the package failed.
 */
function resourceProblem(resource: { label: string; url: string }): string | null {
  const label = resource.label.trim();
  const url = resource.url.trim();
  if (label.length < 2 || label.length > 200) return 'label harus 2–200 karakter';
  if (url.length > 2048) return 'URL maksimal 2048 karakter';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return 'URL harus https:// tanpa nama pengguna atau kata sandi';
  } catch {
    return 'URL tidak valid';
  }
  return null;
}

/**
 * The project editor.
 *
 * It submits the whole package back through the domain's `edit` action rather
 * than patching columns, because the validation record's content hash is what
 * `publishWeek` checks — a direct column write would publish-block the project
 * it just "fixed".
 *
 * The rubric is partly editable, and the split is not arbitrary: `rubricHash`
 * covers only `name`, `weight` and `maxScore`, so those three are frozen per
 * division and shown read-only. `description` and `reviewInstruction` are
 * outside that hash and editable here — which matters, because they are the
 * only text the reviewer model is given about what a criterion means. A
 * criterion called "Evidence" with empty prose is a grade with nothing behind
 * it, and before this the console rendered neither field, so a curator could
 * not even see what the generator had written.
 *
 * Resources — the dataset, template or guide a brief tells the participant to
 * use — are editable as well. The generator can return a dead or missing link,
 * and a brief that says "analyse the attached dataset" with nothing attached
 * cannot be completed; before this the console could not even show them. They
 * ride in the same package, so the validation record stays in step.
 *
 * Each criterion can name the skill it measures. That attribution is what
 * finalization (`skill-attribution.ts`) turns into a per-skill score; an
 * unattributed criterion leaves its skills carrying the project score, labelled
 * as such. On a draft it is saved with the package. On a published project the
 * package is frozen, but attribution is not content — it is saved on its own
 * and stays editable until the week is finalized.
 *
 * The project's skill list and requirement bounds stay read-only: they change
 * what a submission must contain, which is a different decision from wording
 * a brief.
 */
export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useAdminResource(useCallback(() => getAdminProject(id), [id]));

  const [draft, setDraft] = useState<Draft | null>(null);
  const [rubricDraft, setRubricDraft] = useState<RubricDraft | null>(null);
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft | null>(null);
  /** Skill id each criterion measures, by position; '' means unattributed. */
  const [skillDraft, setSkillDraft] = useState<string[] | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [attributionReason, setAttributionReason] = useState('');
  const [attributionBusy, setAttributionBusy] = useState(false);
  const [attributionError, setAttributionError] = useState<string | null>(null);
  const [attributionSaved, setAttributionSaved] = useState<string | null>(null);

  useEffect(() => {
    const pkg = detail.data?.package;
    if (!pkg) return;
    setDraft({
      title: pkg.title, shortDescription: pkg.shortDescription, caseBackground: pkg.caseBackground,
      roleDescription: pkg.roleDescription, mission: pkg.mission, objective: pkg.objective,
      estimatedMinutes: String(pkg.estimatedMinutes),
    });
    setRubricDraft(pkg.rubric.map((c) => ({
      description: c.description ?? '',
      reviewInstruction: c.reviewInstruction ?? '',
    })));
    setResourceDraft(pkg.resources.map((r) => ({ label: r.label, url: r.url })));
    setSkillDraft(pkg.rubric.map((c) => c.skillId ?? ''));
  }, [detail.data]);

  const saveAttribution = async () => {
    if (!detail.data || !skillDraft) return;
    setAttributionBusy(true);
    setAttributionError(null);
    setAttributionSaved(null);
    try {
      const result = await attributeAdminProjectCriteria({
        projectId: id,
        reason: attributionReason,
        attributions: detail.data.rubricCriterionIds.map((criterionId, index) => ({ criterionId, skillId: skillDraft[index] || null })),
      });
      setAttributionSaved(result.changed ? `${result.changed} kriteria diperbarui. Dipakai saat minggu ini difinalisasi.` : 'Tidak ada perubahan.');
      setAttributionReason('');
      await detail.refresh();
    } catch (err) {
      setAttributionError(err instanceof ArenaApiError ? err.message : 'Pemetaan skill gagal disimpan.');
    } finally {
      setAttributionBusy(false);
    }
  };

  const updateResource = (index: number, patch: Partial<{ label: string; url: string }>) =>
    setResourceDraft((current) => current && current.map((resource, i) => (i === index ? { ...resource, ...patch } : resource)));

  const save = async () => {
    if (!draft || !rubricDraft || !resourceDraft || !detail.data) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const minutes = Number(draft.estimatedMinutes);
    if (!Number.isInteger(minutes)) {
      setError('Estimasi menit harus bilangan bulat.');
      setBusy(false);
      return;
    }
    // The package schema requires 10+ characters for both fields. Catching it
    // here names the offending criterion; the server would only report that
    // validation failed somewhere in the package.
    const thin = rubricDraft.findIndex(
      (c) => c.description.trim().length < 10 || c.reviewInstruction.trim().length < 10,
    );
    if (thin !== -1) {
      setError(
        `Kriteria "${detail.data.package.rubric[thin].name}": penjelasan dan instruksi penilaian masing-masing minimal 10 karakter.`,
      );
      setBusy(false);
      return;
    }
    // A row left completely blank is dropped rather than refused: it is an
    // "Add" the curator did not use, not a resource with a missing URL.
    const filled = resourceDraft.map((resource, index) => ({ resource, index }))
      .filter(({ resource }) => resource.label.trim() || resource.url.trim());
    const broken = filled.map(({ resource, index }) => ({ index, problem: resourceProblem(resource) })).find(({ problem }) => problem);
    if (broken) {
      setError(`Resource #${broken.index + 1}: ${broken.problem}.`);
      setBusy(false);
      return;
    }
    try {
      await editAdminProject({
        projectId: id,
        reason,
        package: {
          ...detail.data.package,
          ...draft,
          estimatedMinutes: minutes,
          rubric: detail.data.package.rubric.map((criterion, index) => ({
            ...criterion,
            description: rubricDraft[index].description.trim(),
            reviewInstruction: rubricDraft[index].reviewInstruction.trim(),
            // Absent, not null, when unattributed: that is the shape the
            // validation hash expects for an unattributed criterion.
            skillId: skillDraft?.[index] || undefined,
          })),
          resources: filled.map(({ resource }) => ({ label: resource.label.trim(), url: resource.url.trim() })),
        },
      });
      setReason('');
      setSaved(true);
      await detail.refresh();
    } catch (err) {
      setError(err instanceof ArenaApiError ? err.message : 'Perubahan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  const project = detail.data?.project;
  const locked = project ? ['PUBLISHED', 'ARCHIVED'].includes(project.status) : false;
  const weekFrozen = detail.data ? ['FINALIZED', 'ARCHIVED'].includes(detail.data.week.status) : false;
  // A live project's attribution is saved on its own, until finalization writes the evidence.
  const attributionLive = project?.status === 'PUBLISHED' && !weekFrozen;
  const attributionEditable = !locked || attributionLive;
  const savedSkills = detail.data?.package.rubric.map((c) => c.skillId ?? '') ?? [];
  const attributionDirty = Boolean(skillDraft && skillDraft.some((skillId, index) => skillId !== savedSkills[index]));
  const skillOptions = detail.data?.skillOptions ?? [];
  const mappedCriteria = skillDraft?.filter(Boolean).length ?? 0;
  const measuredSkills = new Set(skillDraft?.filter(Boolean)).size;

  return (
    <AdminShell
      title={project?.title ?? 'Project'}
      action={<AdminRefreshButton refresh={detail.refresh} loading={detail.loading} />}
    >
      <Link href="/app/admin/projects" className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-sk-blue hover:underline">
        <ArrowLeft size={15} aria-hidden /> Semua project
      </Link>

      {detail.error && (
        <div role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash p-4 text-sm text-sk-error">
          {detail.error.message}
        </div>
      )}

      {detail.data && (
        <>
          <Card className="mb-6 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Status" value={<Badge variant={locked ? 'mint' : 'blue'}>{project?.status}</Badge>} />
            <Meta label="Preview" value={<Badge variant="slate">{project?.previewStatus}</Badge>} />
            <Meta label="Minggu" value={`${detail.data.week.weekCode} · ${detail.data.week.status}`} />
            <Meta label="Divisi" value={detail.data.division?.name ?? '—'} />
            <Meta label="Buka" value={jakartaDate(detail.data.week.opensAt)} />
            <Meta label="Deadline" value={jakartaDate(detail.data.week.submissionDeadlineAt)} />
            <Meta label="Jadwal terbit" value={jakartaDate(project?.scheduledPublishAt)} />
            <Meta label="Divalidasi" value={`${jakartaDate(detail.data.validatedAt)}${detail.data.validationSource ? ` · ${detail.data.validationSource}` : ''}`} />
          </Card>

          {locked && (
            <div className="mb-6 border-l-2 border-sk-border bg-sk-bg p-4 text-sm text-sk-muted">
              Project sudah terbit atau diarsipkan, jadi isinya tidak bisa diubah lagi.
            </div>
          )}

          <Card className="mb-6 p-6">
            <PanelHeading>Konten</PanelHeading>
            <div className="grid gap-4">
              {draft && FIELDS.map(({ key, label, rows }) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">{label}</span>
                  {rows ? (
                    <Textarea rows={rows} disabled={locked} value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
                  ) : (
                    <Input disabled={locked} value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
                  )}
                </label>
              ))}
              {draft && (
                <label className="block max-w-xs">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Estimasi menit</span>
                  <Input type="number" min={120} max={960} disabled={locked} value={draft.estimatedMinutes}
                    onChange={(e) => setDraft({ ...draft, estimatedMinutes: e.target.value })} />
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Alasan perubahan (tercatat di audit log)</span>
                <Textarea rows={2} disabled={locked} value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>

              {error && <p role="alert" className="text-sm text-sk-error">{error}</p>}
              {saved && <p className="text-sm text-sk-success">Tersimpan dan divalidasi ulang.</p>}

              <div>
                <Button loading={busy} disabled={locked || !reason.trim()} onClick={save}>Simpan perubahan</Button>
                <p className="mt-2 text-[11.5px] text-sk-muted">
                  Menyimpan mencakup konten di atas <em>dan</em> resource serta rubrik di bawah, lalu memvalidasi
                  ulang paket dan mengembalikan status preview ke PENDING — jadi setujui lagi sebelum publikasi.
                </p>
              </div>
            </div>
          </Card>

          <Card className="mb-6 p-6">
            <PanelHeading>Resource &amp; dataset</PanelHeading>
            <p className="mb-4 text-[12px] text-sk-muted">
              Bahan yang dibuka peserta untuk mengerjakan tugas: dataset, template, dokumen panduan. Hanya URL
              https:// tanpa kredensial, maksimal {MAX_RESOURCES}. Ikon di sisi peserta ditebak dari label dan
              ekstensi file. Baris yang dibiarkan kosong tidak ikut disimpan.
            </p>
            {resourceDraft?.length === 0 && (
              <p className="mb-3 text-sm text-sk-muted">Belum ada resource untuk project ini.</p>
            )}
            <ul className="space-y-4">
              {resourceDraft?.map((resource, index) => (
                <li key={index} className="grid gap-2 border-l-2 border-sk-border pl-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-sk-navy">Label #{index + 1}</span>
                    <Input disabled={locked} value={resource.label} placeholder="Dataset penjualan Q3"
                      onChange={(e) => updateResource(index, { label: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-sk-navy">URL</span>
                    <Input type="url" inputMode="url" disabled={locked} value={resource.url} placeholder="https://…"
                      onChange={(e) => updateResource(index, { url: e.target.value })} />
                  </label>
                  {locked ? (
                    resource.url.startsWith('https://') && (
                      <a href={resource.url} target="_blank" rel="noopener noreferrer"
                        className="pb-3 text-[12.5px] font-semibold text-sk-blue hover:underline">
                        Buka
                      </a>
                    )
                  ) : (
                    <Button size="sm" variant="ghost"
                      onClick={() => setResourceDraft((current) => current && current.filter((_, i) => i !== index))}>
                      Hapus
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {!locked && resourceDraft && resourceDraft.length < MAX_RESOURCES && (
              <div className="mt-4">
                <Button size="sm" variant="ghost" iconLeft={<Plus size={15} aria-hidden />}
                  onClick={() => setResourceDraft((current) => [...(current ?? []), { label: '', url: '' }])}>
                  Tambah resource
                </Button>
              </div>
            )}
          </Card>

          <Card className="mb-6 p-6">
            <PanelHeading>Rubrik penilaian</PanelHeading>
            <p className="mb-2 text-[12px] text-sk-muted">
              Ini satu-satunya teks yang dibaca reviewer AI tentang arti tiap kriteria. Nama, bobot
              dan skor maksimum dibekukan per divisi, jadi tidak bisa diubah di sini.
            </p>
            <p className="mb-4 text-[12px] text-sk-muted">
              <strong className="text-sk-navy">Skill yang diukur</strong> menentukan skor per skill di laporan peserta:
              saat finalisasi, skor kriteria yang dipetakan ke sebuah skill menjadi skor skill itu. Skill tanpa kriteria
              tetap tercatat, tapi hanya membawa skor project dan diberi label begitu.{' '}
              <span className="font-semibold text-sk-navy">
                {mappedCriteria}/{detail.data.package.rubric.length} kriteria dipetakan · {measuredSkills}/{skillOptions.length} skill project terukur.
              </span>
            </p>
            <ul className="space-y-5">
              {detail.data.package.rubric.map((criterion, index) => (
                <li key={`${criterion.name}-${index}`} className="border-l-2 border-sk-border pl-4">
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-semibold text-sk-navy">{criterion.name}</span>
                    <span className="text-xs text-sk-muted">Bobot {criterion.weight} · Maks {criterion.maxScore}</span>
                  </div>
                  <label className="mb-3 block max-w-md">
                    <span className="mb-1 block text-[12px] font-semibold text-sk-navy">Skill yang diukur</span>
                    <select
                      value={skillDraft?.[index] ?? ''}
                      disabled={!attributionEditable || !skillDraft}
                      onChange={(e) => setSkillDraft((current) => current && current.map((skillId, i) => (i === index ? e.target.value : skillId)))}
                      className="h-9 w-full rounded-md border border-sk-border bg-white px-3 text-sm text-sk-navy disabled:bg-sk-bg disabled:text-sk-muted"
                    >
                      <option value="">— Tidak dipetakan (skor project dipakai) —</option>
                      {skillOptions.map((skill) => (
                        <option key={skill.id} value={skill.id}>{skill.name}</option>
                      ))}
                      {skillDraft?.[index] && !skillOptions.some((skill) => skill.id === skillDraft[index]) && (
                        <option value={skillDraft[index]}>Skill di luar daftar project</option>
                      )}
                    </select>
                  </label>
                  {rubricDraft?.[index] && (
                    <div className="grid gap-3">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-sk-navy">
                          Penjelasan kriteria
                        </span>
                        <Textarea
                          rows={3}
                          disabled={locked}
                          value={rubricDraft[index].description}
                          placeholder="Apa yang diukur kriteria ini?"
                          onChange={(e) => {
                            const next = [...rubricDraft];
                            next[index] = { ...next[index], description: e.target.value };
                            setRubricDraft(next);
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-sk-navy">
                          Instruksi penilaian
                        </span>
                        <Textarea
                          rows={3}
                          disabled={locked}
                          value={rubricDraft[index].reviewInstruction}
                          placeholder="Bagaimana reviewer memberi skor? Apa yang membedakan skor tinggi dan rendah?"
                          onChange={(e) => {
                            const next = [...rubricDraft];
                            next[index] = { ...next[index], reviewInstruction: e.target.value };
                            setRubricDraft(next);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {attributionLive && (
              <div className="mt-6 grid gap-3 border-t border-dashed border-sk-border pt-5">
                <p className="text-[12px] text-sk-muted">
                  Project ini sudah terbit, jadi isi rubrik terkunci. Pemetaan skill tetap bisa diubah sampai minggu{' '}
                  {detail.data.week.weekCode} difinalisasi, karena baru dipakai saat skor per skill dihitung.
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-sk-navy">Alasan perubahan pemetaan (tercatat di audit log)</span>
                  <Textarea rows={2} value={attributionReason} onChange={(e) => setAttributionReason(e.target.value)} />
                </label>
                {attributionError && <p role="alert" className="text-sm text-sk-error">{attributionError}</p>}
                {attributionSaved && <p className="text-sm text-sk-success">{attributionSaved}</p>}
                <div>
                  <Button loading={attributionBusy} disabled={!attributionDirty || !attributionReason.trim()} onClick={saveAttribution}>
                    Simpan pemetaan skill
                  </Button>
                </div>
              </div>
            )}
            {weekFrozen && (
              <p className="mt-5 text-[12px] text-sk-muted">
                Minggu ini sudah difinalisasi: skor per skill sudah ditulis, jadi pemetaannya dibekukan.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <PanelHeading>Syarat submission</PanelHeading>
            <ul className="space-y-3">
              {detail.data.package.requirements.map((requirement, index) => (
                <li key={`${requirement.label}-${index}`} className="text-sm">
                  <p className="font-semibold text-sk-navy">{requirement.label}</p>
                  <p className="text-xs text-sk-muted">
                    {requirement.type} · {requirement.required ? 'wajib' : 'opsional'} · {requirement.minItems}–{requirement.maxItems} item
                  </p>
                  {requirement.instructions && (
                    <p className="mt-1 whitespace-pre-line text-xs text-sk-muted">{requirement.instructions}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </AdminShell>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-sk-muted">{label}</p>
      <div className="mt-1 text-[13px] font-semibold text-sk-navy">{value}</div>
    </div>
  );
}
