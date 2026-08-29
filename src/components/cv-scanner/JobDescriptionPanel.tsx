'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Briefcase } from 'lucide-react';
import { Textarea } from '@/components/primitives/Textarea';
import { Badge } from '@/components/primitives/Badge';
import { cn } from '@/lib/cn';

interface JobDescriptionPanelProps {
  value: string;
  onChange: (v: string) => void;
  defaultOpen?: boolean;
}

export function JobDescriptionPanel({ value, onChange, defaultOpen = false }: JobDescriptionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const filled = value.trim().length > 0;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--color-surface-soft)] transition-colors"
        aria-expanded={open}
      >
        <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
          <Briefcase className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-[var(--color-ink-primary)]">
              Tambahkan Job Description
            </p>
            <Badge variant="brand" size="sm">Optional</Badge>
            {filled && (
              <Badge variant="success" size="sm">Ditambahkan</Badge>
            )}
          </div>
          <p className="text-[12.5px] text-[var(--color-ink-tertiary)] mt-0.5">
            Supaya analisis keyword dan relevansi CV lebih akurat untuk role yang kamu incar.
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-[var(--color-ink-tertiary)]" /> : <ChevronDown className="h-4 w-4 text-[var(--color-ink-tertiary)]" />}
      </button>

      {open && (
        <div className={cn('px-5 pb-5 pt-1')}>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Tempelkan deskripsi lowongan yang kamu incar di sini..."
            rows={5}
          />
        </div>
      )}
    </div>
  );
}
