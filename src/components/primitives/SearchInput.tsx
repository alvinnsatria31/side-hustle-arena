'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export function SearchInput({ value, onChange, placeholder, className, label = 'Cari' }: SearchInputProps) {
  return (
    <div
      className={cn(
        'flex h-12 flex-1 items-center gap-2.5 rounded-[var(--radius-sk-lg)] border border-sk-border bg-white px-4 transition-all duration-200 focus-within:border-sk-blue focus-within:shadow-[0_0_0_4px_rgba(36,107,253,0.08)]',
        className,
      )}
    >
      <Search size={16} className="shrink-0 text-sk-muted" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13.5px] text-sk-navy placeholder:text-sk-muted focus:outline-none"
      />
    </div>
  );
}
