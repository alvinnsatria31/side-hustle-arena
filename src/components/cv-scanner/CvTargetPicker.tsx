'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';
import {
  CV_TARGET_COMPANIES,
  CV_TARGET_CUSTOM_MAX,
  CV_TARGET_CUSTOM_ROLE,
  CV_TARGET_LEVELS,
  CV_TARGET_ROLES,
  parseCvTarget,
} from '@/lib/cv-target';
import type { CvTargetChoice } from '@/lib/cv-scan-client';

export const EMPTY_CV_TARGET: CvTargetChoice = { role: '', customRole: '', level: '', company: '' };

/** Null when the choice can be sent (including skipped), else what to fix. */
export function cvTargetProblem(choice: CvTargetChoice): string | null {
  if (!choice.role) return null;
  const parsed = parseCvTarget(choice);
  return parsed.ok ? null : parsed.message;
}

function ChoiceGroup({
  legend,
  hint,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="mt-5 first:mt-0">
      <legend className="text-[13.5px] font-bold text-sk-navy">
        {legend}
        {hint && <span className="ml-1.5 font-normal text-sk-muted">{hint}</span>}
      </legend>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              // Clicking the chosen chip again un-chooses it: every question here is optional.
              onClick={() => onChange(selected ? '' : option.id)}
              className={cn(
                'rounded-full border px-3.5 py-2 text-[13px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue',
                selected
                  ? 'border-sk-blue bg-sk-blue-wash font-semibold text-sk-navy'
                  : 'border-sk-border bg-white text-sk-body hover:border-sk-blue-tint-border',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * "Mau dinilai buat posisi apa?" — asked before the scan, skippable.
 * Level and employer only calibrate a named position, so they wait for one.
 */
export function CvTargetPicker({ value, onChange }: { value: CvTargetChoice; onChange: (next: CvTargetChoice) => void }) {
  const customId = useId();
  const problem = value.role === CV_TARGET_CUSTOM_ROLE && value.customRole.trim() ? cvTargetProblem(value) : null;

  return (
    <section
      aria-labelledby={`${customId}-title`}
      className="mt-5 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-5"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[520px]">
          <h2 id={`${customId}-title`} className="text-[15px] font-bold text-sk-navy">
            Mau dinilai untuk posisi apa? <span className="font-normal text-sk-muted">(opsional)</span>
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-sk-muted">
            CV kamu akan dinilai pakai standar recruiter posisi itu, dan kamu dapat skor kecocokan. Lewati kalau mau
            AI menebak posisinya dari CV.
          </p>
        </div>
        {value.role && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_CV_TARGET)}
            className="text-[12.5px] font-semibold text-sk-blue hover:underline"
          >
            Lewati pertanyaan
          </button>
        )}
      </div>

      <ChoiceGroup
        legend="1. Posisi yang dilamar"
        options={[...CV_TARGET_ROLES, { id: CV_TARGET_CUSTOM_ROLE, label: 'Lainnya…' }]}
        value={value.role}
        onChange={(role) => onChange(role ? { ...value, role } : EMPTY_CV_TARGET)}
      />

      {value.role === CV_TARGET_CUSTOM_ROLE && (
        <div className="mt-3">
          <label htmlFor={customId} className="text-[12.5px] text-sk-body">
            Tulis nama posisinya
          </label>
          <input
            id={customId}
            type="text"
            value={value.customRole}
            maxLength={CV_TARGET_CUSTOM_MAX}
            placeholder="contoh: Business Analyst"
            onChange={(event) => onChange({ ...value, customRole: event.target.value })}
            aria-invalid={Boolean(problem)}
            aria-describedby={problem ? `${customId}-error` : undefined}
            className="mt-1.5 w-full max-w-[360px] rounded-xl border border-sk-border px-3.5 py-2.5 text-[14px] text-sk-navy outline-none focus:border-sk-blue"
          />
          {problem && (
            <p id={`${customId}-error`} role="alert" className="mt-1.5 text-[12px] text-sk-error">
              {problem}
            </p>
          )}
        </div>
      )}

      {value.role && (
        <>
          <ChoiceGroup
            legend="2. Level kamu"
            hint="(opsional)"
            options={CV_TARGET_LEVELS}
            value={value.level}
            onChange={(level) => onChange({ ...value, level })}
          />
          <ChoiceGroup
            legend="3. Target perusahaan"
            hint="(opsional)"
            options={CV_TARGET_COMPANIES}
            value={value.company}
            onChange={(company) => onChange({ ...value, company })}
          />
        </>
      )}
    </section>
  );
}
