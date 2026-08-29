'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useDemoAuth } from '@/features/auth/useDemoAuth';

export default function LoginPage() {
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
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-7">
            <h1 className="text-[30px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
              Masuk ke akunmu
            </h1>
            <p className="mt-2 text-[14px] text-[var(--color-ink-tertiary)]">
              Lanjutkan perkembangan karirmu.
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
              <Input
                label="Email"
                type="email"
                placeholder="kamu@email.com"
                defaultValue="riani.putri@email.com"
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                defaultValue="sekolahkarir"
                autoComplete="current-password"
              />
              <Button type="submit" variant="primary" size="lg" fullWidth iconRight={<ArrowRight className="h-4 w-4" />}>
                Masuk
              </Button>
            </form>

            <div className="mt-5 flex items-center gap-3 text-[12px] text-[var(--color-ink-tertiary)]">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <span>atau</span>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="mt-5">
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => {
                  signIn();
                  router.push('/app');
                }}
                iconLeft={<Lock className="h-4 w-4" />}
              >
                Coba sebagai demo user
              </Button>
            </div>

            <p className="mt-6 text-center text-[12.5px] text-[var(--color-ink-tertiary)]">
              Belum punya akun?{' '}
              <Link href="/register" className="font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]">
                Buat akun
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
