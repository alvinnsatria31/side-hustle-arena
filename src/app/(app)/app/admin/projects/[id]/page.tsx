'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminShell, AdminRefreshButton } from '@/components/admin/AdminShell';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { editAdminProject, getAdminProject, useAdminResource } from '@/lib/admin-client';
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

const FIELDS: Array<{ key: keyof Draft; label: string; rows?: number }> = [
  { key: 'title', label: 'Judul' },
  { key: 'shortDescription', label: 'Deskripsi singkat', rows: 2 },
  { key: 'caseBackground', label: 'Latar kasus', rows: 5 },
  { key: 'roleDescription', label: 'Peran peserta', rows: 4 },
  { key: 'mission', label: 'Misi', rows: 4 },
  { key: 'objective', label: 'Tujuan', rows: 3 },
];

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
 * Skills and requirement bounds stay read-only: they change what a submission
 * must contain, which is a different decision from wording a brief.
 */
export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useAdminResource(useCallback(() => getAdminProject(id), [id]));

  const [draft, setDraft] = useState<Draft | null>(null);
  const [rubricDraft, setRubricDraft] = useState<RubricDraft | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
  }, [detail.data]);

  const save = async () => {
    if (!draft || !rubricDraft || !detail.data) return;
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
          })),
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
                  Menyimpan mencakup konten di atas <em>dan</em> rubrik di bawah, lalu memvalidasi ulang
                  paket dan mengembalikan status preview ke PENDING — jadi setujui lagi sebelum publikasi.
                </p>
              </div>
            </div>
          </Card>

          <Card className="mb-6 p-6">
            <PanelHeading>Rubrik penilaian</PanelHeading>
            <p className="mb-4 text-[12px] text-sk-muted">
              Ini satu-satunya teks yang dibaca reviewer AI tentang arti tiap kriteria. Nama, bobot
              dan skor maksimum dibekukan per divisi, jadi tidak bisa diubah di sini.
            </p>
            <ul className="space-y-5">
              {detail.data.package.rubric.map((criterion, index) => (
                <li key={`${criterion.name}-${index}`} className="border-l-2 border-sk-border pl-4">
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-semibold text-sk-navy">{criterion.name}</span>
                    <span className="text-xs text-sk-muted">Bobot {criterion.weight} · Maks {criterion.maxScore}</span>
                  </div>
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
