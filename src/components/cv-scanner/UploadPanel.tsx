'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { cn } from '@/lib/cn';

interface UploadPanelProps {
  onFileChosen: (fileName: string, sizeBytes: number) => void;
  hasFile: boolean;
  error?: string | null;
}

export function UploadPanel({ onFileChosen, hasFile, error }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    onFileChosen(file.name, file.size);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!hasFile) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (hasFile) return;
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={cn(
        'relative rounded-[var(--radius-xl)] border-2 border-dashed bg-white px-6 py-12 sm:py-16 transition-colors',
        hasFile
          ? 'border-[var(--color-border)]'
          : isDragging
            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)]'
            : 'border-[var(--color-border-strong)]',
        error && 'border-[var(--color-danger)]',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="h-14 w-14 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[18px] font-semibold text-[var(--color-ink-primary)]">
          Tarik file CV ke sini
        </p>
        <p className="mt-1.5 text-[13px] text-[var(--color-ink-tertiary)]">
          PDF atau DOCX · maksimal 5 MB
        </p>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px w-10 bg-[var(--color-border)]" />
          <span className="text-[12px] text-[var(--color-ink-tertiary)] font-medium">atau</span>
          <span className="h-px w-10 bg-[var(--color-border)]" />
        </div>

        <div className="mt-6">
          <Button onClick={() => inputRef.current?.click()} variant="primary" size="lg">
            Pilih CV
          </Button>
        </div>

        {error && (
          <p className="mt-4 text-[12.5px] text-[var(--color-danger)] font-medium">{error}</p>
        )}
      </div>
    </div>
  );
}
