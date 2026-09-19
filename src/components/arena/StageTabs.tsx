'use client';

import { useState, type ReactNode } from 'react';
import { Check, ClipboardCheck, FileText, KanbanSquare, ListChecks, Send } from 'lucide-react';
import { WORKSPACE_STEP_LABELS } from '@/components/primitives/StatusBadge';
import type { WorkspaceStep } from '@/types/project';
import { cn } from '@/lib/cn';

/**
 * The five workspace steps, in the Core Features layout Saasto uses: a pill
 * tab bar over a split of visual and copy.
 *
 * Every visual here is drawn in markup rather than loaded as an image. A
 * screenshot of the workspace would go stale the first time the workspace
 * changes, and nobody would notice until a participant did.
 *
 * Labels come from WORKSPACE_STEP_LABELS rather than a second copy of the same
 * strings: someone who reads the pitch and then enrols should meet the same
 * word in the stepper.
 */

const PANEL = 'rounded-[var(--radius-sk-xl)] border border-sk-border bg-sk-bg p-4';
const ROW = 'rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-3 py-2.5';

/** Grey placeholder line — stands in for text inside the mock surfaces. */
function Line({ w = 'w-full', tone = 'bg-sk-track' }: { w?: string; tone?: string }) {
  return <span aria-hidden className={cn('block h-2 rounded-full', w, tone)} />;
}

function MockBrief() {
  return (
    <div className={PANEL}>
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-full bg-sk-blue-tint px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-sk-blue-700">
          Brief
        </span>
        <span className="rounded-full bg-sk-warning-tint px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-sk-warning-ink">
          Rubrik terbuka
        </span>
      </div>
      <div className="space-y-2.5 rounded-[var(--radius-sk-md)] border border-sk-border bg-white p-4">
        <Line w="w-1/3" tone="bg-sk-navy/20" />
        <Line />
        <Line w="w-11/12" />
        <Line w="w-8/12" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {['Kualitas', 'Proses', 'Bukti'].map((c) => (
          <div key={c} className="rounded-[var(--radius-sk-md)] border border-sk-border bg-white px-2.5 py-2 text-center">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-sk-faint">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPlan() {
  return (
    <div className={PANEL}>
      <div className="grid grid-cols-3 gap-2.5">
        {['Rencana', 'Jalan', 'Selesai'].map((col, i) => (
          <div key={col} className="rounded-[var(--radius-sk-md)] bg-white/70 p-2">
            <span className="mb-2 block font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-sk-faint">
              {col}
            </span>
            <div className="space-y-1.5">
              {Array.from({ length: i === 0 ? 3 : i === 1 ? 2 : 1 }).map((_, j) => (
                <div key={j} className="rounded-[10px] border border-sk-border bg-white p-2">
                  <Line w="w-10/12" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockWork() {
  return (
    <div className={PANEL}>
      <div className="space-y-2">
        {[
          ['Riset pengguna', 'bg-sk-success'],
          ['Analisis data', 'bg-sk-blue'],
          ['Susun rekomendasi', 'bg-sk-track'],
        ].map(([label, dot]) => (
          <div key={label} className={cn(ROW, 'flex items-center gap-2.5')}>
            <span aria-hidden className={cn('h-2 w-2 flex-none rounded-full', dot)} />
            <span className="text-[12.5px] font-semibold text-sk-navy">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-[var(--radius-sk-md)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-3 py-2.5 text-center">
        <span className="font-mono text-[10.5px] font-semibold text-sk-blue-700">Versi tersimpan otomatis</span>
      </div>
    </div>
  );
}

function MockReview() {
  return (
    <div className={PANEL}>
      <div className="space-y-2">
        {[
          ['Tautan bisa dibuka', true],
          ['Hasil kerja sudah lengkap', true],
          ['Izin akses sudah benar', false],
        ].map(([label, done]) => (
          <div key={label as string} className={cn(ROW, 'flex items-center gap-2.5')}>
            <span
              aria-hidden
              className={cn(
                'grid h-4 w-4 flex-none place-items-center rounded-full',
                done ? 'bg-sk-success text-white' : 'border border-sk-border bg-white',
              )}
            >
              {done ? <Check size={10} strokeWidth={3} /> : null}
            </span>
            <span className="text-[12.5px] font-semibold text-sk-navy">{label as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockSubmit() {
  return (
    <div className={PANEL}>
      <div className="space-y-2">
        {['laporan-akhir.pdf', 'lampiran-data.xlsx'].map((f) => (
          <div key={f} className={cn(ROW, 'flex items-center gap-2.5')}>
            <FileText size={14} strokeWidth={2.2} aria-hidden className="flex-none text-sk-blue" />
            <span className="flex-1 truncate font-mono text-[11.5px] text-sk-navy">{f}</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sk-success">
              Terunggah
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-[var(--radius-sk-md)] bg-sk-navy px-3 py-3 text-center">
        <span className="font-mono text-[11px] font-semibold text-white">Masuk antrean penilaian</span>
      </div>
    </div>
  );
}

interface Stage {
  step: WorkspaceStep;
  icon: typeof FileText;
  headline: string;
  body: string;
  points: [string, string];
  mock: ReactNode;
}

const STAGES: Stage[] = [
  {
    step: 'brief',
    icon: FileText,
    headline: 'Pahami yang diminta',
    body: 'Brief lengkap dengan latar kasus, peran yang kamu ambil, dan hasil yang harus dikumpulkan. Rubrik penilaian proyek itu terbuka di tahap ini juga.',
    points: ['Rubrik terbuka sebelum kamu menulis', 'Latar kasus dan peran dijelaskan'],
    mock: <MockBrief />,
  },
  {
    step: 'plan',
    icon: KanbanSquare,
    headline: 'Susun rencana kerja',
    body: 'Pecah pekerjaan jadi langkah yang muat dalam satu minggu. Rencana ini bagian dari hasil kerja, bukan catatan pribadi.',
    points: ['Papan kerja per langkah', 'Rencana ikut dinilai'],
    mock: <MockPlan />,
  },
  {
    step: 'work',
    icon: ClipboardCheck,
    headline: 'Garap di workspace',
    body: 'Kerjakan langsung di workspace. Berkas dan tautan tersimpan sebagai versi yang tidak bisa diubah setelah dikirim, jadi jejak kerjamu utuh.',
    points: ['Versi tersimpan otomatis', 'Riwayat kerja tidak bisa diubah'],
    mock: <MockWork />,
  },
  {
    step: 'review',
    icon: ListChecks,
    headline: 'Periksa sebelum kirim',
    body: 'Checklist terbuka sebelum pengumpulan, isinya hal yang memang dinilai. Kamu bisa memperbaiki selagi masih sempat.',
    points: ['Checklist sama dengan yang dinilai', 'Bisa diperbaiki sebelum dikunci'],
    mock: <MockReview />,
  },
  {
    step: 'submit',
    icon: Send,
    headline: 'Kirim dan tunggu hasil',
    body: 'Hasilmu masuk antrean penilaian. Umpan balik kembali per kriteria, bukan satu angka tanpa penjelasan.',
    points: ['Umpan balik per kriteria', 'Skor dihitung di dalam Arena'],
    mock: <MockSubmit />,
  },
];

export function StageTabs() {
  const [active, setActive] = useState<WorkspaceStep>('brief');
  const stage = STAGES.find((s) => s.step === active) ?? STAGES[0];
  const index = STAGES.indexOf(stage);

  return (
    <div>
      {/* Pill tab bar, centred over the split — the Core Features pattern. */}
      <div
        role="tablist"
        aria-label="Tahapan workspace"
        className="mx-auto flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-sk-border bg-white p-1.5 shadow-sk-xs"
      >
        {STAGES.map(({ step, icon: Icon }) => {
          const on = step === active;
          return (
            <button
              key={step}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setActive(step)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-bold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2',
                on ? 'bg-sk-blue text-white shadow-sk-btn' : 'text-sk-muted hover:text-sk-navy',
              )}
            >
              <Icon size={15} strokeWidth={2.3} aria-hidden />
              {WORKSPACE_STEP_LABELS[step]}
            </button>
          );
        })}
      </div>

      <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>{stage.mock}</div>

        <div>
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.15em] text-sk-blue-700">
            Tahap {index + 1} dari {STAGES.length}
          </span>
          <h3 className="mt-3 text-[26px] font-extrabold tracking-[-0.035em] text-sk-navy md:text-[30px]">
            {stage.headline}
          </h3>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-sk-muted">{stage.body}</p>

          <ul className="mt-7 space-y-3.5">
            {stage.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-sk-success-tint text-sk-success"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-[14.5px] font-semibold text-sk-navy">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
