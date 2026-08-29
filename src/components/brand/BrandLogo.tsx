import { BrandMark } from './BrandMark';
import { cn } from '@/lib/cn';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { mark: 22, text: 'text-[14px]' },
  md: { mark: 26, text: 'text-[15px]' },
  lg: { mark: 32, text: 'text-[18px]' },
};

export function BrandLogo({ size = 'md', className }: BrandLogoProps) {
  const s = sizes[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={s.mark} />
      <span className={cn('font-bold tracking-[-0.01em] text-[var(--color-ink-primary)]', s.text)}>
        Sekolah Karir
      </span>
    </span>
  );
}
