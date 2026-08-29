import { cn } from '@/lib/cn';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="var(--color-brand-500)" />
      <path
        d="M9 9h3.6v11.4h6.3V23H9V9z"
        fill="white"
      />
      <circle cx="22.5" cy="11" r="2" fill="white" />
    </svg>
  );
}
