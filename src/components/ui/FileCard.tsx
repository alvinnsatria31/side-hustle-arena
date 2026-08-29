import { FileText, RefreshCw, X } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { StatusBadge } from '@/components/primitives/StatusBadge';
import { cn } from '@/lib/cn';

interface FileCardProps {
  name: string;
  sizeBytes: number;
  pages: number;
  status?: string;
  onReplace?: () => void;
  onRemove?: () => void;
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1].toUpperCase() : 'FILE';
}

export function FileCard({
  name,
  sizeBytes,
  pages,
  status = 'Ready',
  onReplace,
  onRemove,
  className,
}: FileCardProps) {
  return (
    <Card padding="md" className={cn('flex items-center gap-4', className)}>
      <div className="h-11 w-11 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[var(--color-ink-primary)] truncate">{name}</p>
        <p className="text-[12px] text-[var(--color-ink-tertiary)]">
          {getExt(name)} · {formatSize(sizeBytes)} · {pages} halaman
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <StatusBadge label={status} tone="success" dot />
        <div className="flex items-center gap-1">
          {onReplace && (
            <button
              type="button"
              onClick={onReplace}
              className="h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-tertiary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink-primary)]"
              aria-label="Ganti file"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-tertiary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink-primary)]"
              aria-label="Hapus file"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="sm:hidden">
        <StatusBadge label={status} tone="success" dot />
      </div>
    </Card>
  );
}
