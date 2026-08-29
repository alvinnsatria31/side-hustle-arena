'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useDemoAuth } from '@/features/auth/useDemoAuth';

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthed, hydrated, signIn } = useDemoAuth();

  useEffect(() => {
    if (hydrated && isAuthed) {
      router.replace('/app');
    }
  }, [hydrated, isAuthed, router]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-base)]">
      <header className="px-5 lg:px-8 h-16 flex items-center border-b border-[var(--color-border)] bg-white">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[960px] grid gap-8 lg:grid-cols-[1.1fr_1fr] items-start">
          {/* Left value card */}
          <div className="hidden lg:block">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
              Sekolah Karir
            </span>
            <h1 className="mt-4 text-[40px] leading-[1.05] font-bold tracking-[-0.02em] text-[var(--color-ink-primary)]">
              Mulai bangun karirmu, minggu ini.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-secondary)] max-w-md">
              Buat akun gratis untuk akses lengkap: CV Scanner, weekly project, Career Report, dan Portfolio.
            </p>

            <ul className="mt-7 flex flex-col gap-3">
              {[
                'Scan CV tanpa batas dan simpan riwayatnya',
                'Akses Side Hustle Arena dan pilih weekly project',
                'Pantau pertumbuhan skill lewat Career Report',
                'Hasilkan portfolio profesional dari setiap project',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[14px] text-[var(--color-ink-secondary)]">
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-brand-500)] mt-0.5 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Right form */}
          <div>
            <div className="lg:hidden mb-7">
              <h1 className="text-[28px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
                Buat akun gratis
              </h1>
              <p className="mt-1.5 text-[13px] text-[var(--color-ink-tertiary)]">
                Akses lengkap Sekolah Karir.
              </p>
            </div>

            <Card padding="xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  signIn();
                  router.push('/app');
                }}
                className="flex flex-col gap-4"
              >
                <Input label="Nama lengkap" placeholder="Nama kamu" defaultValue="Riani Putri" />
                <Input
                  label="Email"
                  type="email"
                  placeholder="kamu@email.com"
                  defaultValue="riani.putri@email.com"
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Buat password"
                  defaultValue="sekolahkarir"
                  helper="Minimal 8 karakter"
                />
                <Button type="submit" variant="primary" size="lg" fullWidth iconRight={<ArrowRight className="h-4 w-4" />}>
                  Buat Akun
                </Button>
              </form>

              <p className="mt-6 text-center text-[12.5px] text-[var(--color-ink-tertiary)]">
                Sudah punya akun?{' '}
                <Link href="/login" className="font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]">
                  Masuk
                </Link>
              </p>
            </Card>

            <p className="mt-5 text-center text-[11.5px] text-[var(--color-ink-tertiary)]">
              Dengan membuat akun, kamu menyetujui demo terms layanan ini.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
