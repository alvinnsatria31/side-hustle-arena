'use client';

import { useState } from 'react';
import { Textarea } from '@/components/primitives/Textarea';
import { Input } from '@/components/primitives/Input';
import { FileText, Link as LinkIcon, Paperclip, X } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { cn } from '@/lib/cn';

interface SubmissionAreaProps {
  text: string;
  link: string;
  notes: string;
  onChange: (patch: { text?: string; link?: string; notes?: string }) => void;
  readOnly?: boolean;
}

const MAX_FILES = 3;
const MOCK_FILES = ['Campaign_Strategy_v1.pdf', 'Persona_Slides.pdf'];

export function SubmissionArea({ text, link, notes, onChange, readOnly }: SubmissionAreaProps) {
  const [files, setFiles] = useState<string[]>(MOCK_FILES);
  const [tab, setTab] = useState<'text' | 'link' | 'file'>('text');

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] w-full sm:w-fit">
        {[
          { id: 'text', label: 'Text', Icon: FileText },
          { id: 'link', label: 'Link', Icon: LinkIcon },
          { id: 'file', label: 'File', Icon: Paperclip },
        ].map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                'inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] text-[13px] font-semibold transition-colors',
                active ? 'bg-white text-[var(--color-ink-primary)] shadow-[0_1px_2px_rgba(13,25,48,0.04)]' : 'text-[var(--color-ink-tertiary)]',
              )}
            >
              <t.Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'text' && (
        <Textarea
          label="Campaign Strategy Document"
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={8}
          placeholder="Tulis strategi campaign, audience analysis, key messages, channel strategy, dan KPI plan kamu di sini..."
          readOnly={readOnly}
        />
      )}

      {tab === 'link' && (
        <div className="space-y-3">
          <Input
            label="Link"
            value={link}
            onChange={(e) => onChange({ link: e.target.value })}
            placeholder="Google Drive, Figma, atau Notion link"
            helper="Pastikan link bisa diakses tanpa login."
            readOnly={readOnly}
            iconLeft={<LinkIcon className="h-4 w-4" />}
          />
        </div>
      )}

      {tab === 'file' && (
        <div>
          <label className="text-[13px] font-semibold text-[var(--color-ink-primary)]">Files</label>
          <div className="mt-2 grid gap-2">
            {files.length === 0 ? (
              <button
                type="button"
                className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border-strong)] bg-white p-6 text-center hover:bg-[var(--color-surface-soft)] transition-colors"
              >
                <Paperclip className="h-5 w-5 text-[var(--color-ink-tertiary)] mx-auto" />
                <p className="mt-2 text-[13px] text-[var(--color-ink-tertiary)]">
                  Tarik file atau klik untuk pilih
                </p>
              </button>
            ) : (
              files.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white"
                >
                  <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)] truncate">{name}</p>
                    <p className="text-[11.5px] text-[var(--color-ink-tertiary)]">PDF · siap di-submit</p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setFiles((f) => f.filter((n) => n !== name))}
                      className="h-8 w-8 rounded-full text-[var(--color-ink-tertiary)] hover:bg-[var(--color-surface-soft)] flex items-center justify-center"
                      aria-label="Hapus"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          {!readOnly && files.length < MAX_FILES && (
            <button
              type="button"
              onClick={() => setFiles((f) => [...f, 'Untitled.pdf'])}
              className="mt-2 text-[12.5px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
            >
              + Tambah file
            </button>
          )}
        </div>
      )}

      <Card padding="md" className="bg-[var(--color-surface-soft)]">
        <label
          htmlFor="notes"
          className="text-[13px] font-semibold text-[var(--color-ink-primary)]"
        >
          Supporting Notes <span className="text-[var(--color-ink-tertiary)] font-normal">(opsional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={3}
          placeholder="Catatan tambahan untuk evaluator: asumsi, referensi, atau konteks yang ingin kamu jelaskan."
          className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3.5 py-3 text-[14px] text-[var(--color-ink-primary)] placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-3 focus:ring-[var(--color-brand-50)]"
          readOnly={readOnly}
        />
      </Card>
    </div>
  );
}
