'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/primitives/Button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/', label: 'Beranda' },
  { href: '/cv-scanner', label: 'CV Scanner' },
  { href: '/arena', label: 'Side Hustle Arena' },
  { href: '/arena/showcase', label: 'Showcase' },
];

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 glass border-b border-[var(--color-border)]">
      <div className="mx-auto max-w-[1280px] px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Sekolah Karir">
          <BrandLogo size="md" />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'h-10 px-3.5 inline-flex items-center text-[14px] font-medium rounded-[var(--radius-sm)] transition-colors',
                  active
                    ? 'text-[var(--color-brand-600)] bg-[var(--color-brand-50)]'
                    : 'text-[var(--color-ink-secondary)] hover:bg-[var(--color-surface-soft)]',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Masuk
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="primary" size="sm">
              Buat Akun
            </Button>
          </Link>
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-soft)]"
          onClick={() => setOpen((s) => !s)}
          aria-label="Buka menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--color-border)] bg-white">
          <div className="px-5 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="h-11 px-3 inline-flex items-center text-[15px] font-medium text-[var(--color-ink-primary)] rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-soft)]"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="secondary" fullWidth>
                  Masuk
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button variant="primary" fullWidth>
                  Buat Akun
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
