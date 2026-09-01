'use client';

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, FileText, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { cn } from '@/lib/cn';
import { CV_ACCEPTED_TYPES, CV_MAX_SIZE_MB } from '@/data/mock/cv';

export interface SelectedFile {
  name: string;
  size: number; // bytes
}

export type DropzoneError = 'type' | 'size' | null;

interface FileDropzoneProps {
  file: SelectedFile | null;
  error: DropzoneError;
  onPick: (file: SelectedFile, error: DropzoneError) => void;
  onRemove: () => void;
  compact?: boolean;
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateFile(f: File): DropzoneError {
  const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
  if (!CV_ACCEPTED_TYPES.includes(ext)) return 'type';
  if (f.size > CV_MAX_SIZE_MB * 1024 * 1024) return 'size';
  return null;
}

/**
 * CV upload dropzone with real local file selection.
 * States: idle / hover / drag-over / file selected / invalid type / oversized.
 */
export function FileDropzone({ file, error, onPick, onRemove, compact }: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  const acceptFile = useCallback(
    (f: File) => onPick({ name: f.name, size: f.size }, validateFile(f)),
    [onPick],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
    e.target.value = '';
  };

  if (file && !error) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="rounded-[var(--radius-sk-2xl)] border-2 border-sk-blue-tint-border bg-sk-blue-wash p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md border border-sk-blue-tint-border bg-gradient-to-b from-[#F0F5FF] to-[#DCE7FF] font-mono text-[9px] font-bold text-sk-blue">
            {file.name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'PDF'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-sk-navy">{file.name}</div>
            <div className="mt-0.5 font-mono text-[11.5px] text-sk-muted">{formatSize(file.size)}</div>
          </div>
          <motion.span
            initial={reduce ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-sk-success text-white"
            aria-label="File valid"
          >
            <Check size={13} strokeWidth={3} aria-hidden />
          </motion.span>
          <button
            onClick={onRemove}
            aria-label="Hapus file"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sk-muted transition-colors hover:bg-white hover:text-sk-error"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CV — tarik file ke sini atau pilih dari perangkat"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'relative cursor-pointer rounded-[var(--radius-sk-2xl)] border-2 border-dashed border-sk-blue-tint-border bg-white px-6 py-10 text-center transition-all duration-200 sm:py-14',
          dragOver && 'border-sk-blue bg-[#F4F8FF] shadow-[0_0_0_6px_rgba(36,107,253,0.08)]',
          compact && 'py-8',
        )}
      >
        <motion.div
          animate={dragOver && !reduce ? { y: -4 } : { y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-sk-lg)] bg-sk-blue-tint text-sk-blue"
        >
          <UploadCloud size={28} strokeWidth={1.8} aria-hidden />
        </motion.div>
        <h3 className="mb-1.5 text-[20px] font-bold text-sk-navy">Upload CV kamu</h3>
        <p className="mb-[22px] text-[13px] text-sk-muted">Tarik file ke sini atau pilih dari perangkat kamu.</p>
        <Button
          iconLeft={<FileText size={15} aria-hidden />}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Pilih File
        </Button>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-sk-muted">
          PDF · DOCX · MAKS {CV_MAX_SIZE_MB}MB
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="sr-only"
          onChange={onChange}
          aria-hidden
          tabIndex={-1}
        />
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="alert"
            className="mt-4 rounded-xl border border-sk-error/25 bg-sk-error-wash px-4 py-3 text-[13px] text-sk-error"
          >
            {error === 'type'
              ? 'Format CV belum didukung. Saat ini kami hanya menerima PDF atau DOCX.'
              : `Ukuran file terlalu besar. Maksimal ${CV_MAX_SIZE_MB}MB — coba kompres CV kamu dulu.`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
