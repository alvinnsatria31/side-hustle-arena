'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { cn } from '@/lib/cn';
import { useDemo } from '@/features/demo/store';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { login, state } = useDemo();
  const [mode, setMode] = useState<Mode>('login');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login();
    router.push('/app');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sk-bg px-6 py-24">
      <div className="ambient" aria-hidden />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-[1] w-full max-w-md rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white p-8 shadow-sk-lg sm:p-9"
      >
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-sk-muted transition-colors hover:text-sk-blue">
          <ArrowLeft size={14} aria-hidden /> Kembali ke beranda
        </Link>

        <span className="eyebrow">{mode === 'login' ? 'Masuk' : 'Daftar Gratis'}</span>
        <h1 className="mb-1.5 mt-2 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
          {mode === 'login' ? 'Lanjutkan perjalanan karirmu.' : 'Buat akun kamu.'}
        </h1>
        <p className="mb-6 text-[13.5px] leading-relaxed text-sk-muted">
          Simpan progress CV scan dan project, kumpulkan bukti skill, dan akses Career Report.
        </p>

        <div role="tablist" aria-label="Mode autentikasi" className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-sk-track p-1">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'h-9 rounded-lg text-[13px] font-semibold transition-all duration-200',
                mode === m ? 'bg-white text-sk-navy shadow-sm' : 'text-sk-muted hover:text-sk-navy',
              )}
            >
              {m === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <label className="block">
              <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Nama Lengkap</span>
              <Input required placeholder="Nama kamu" defaultValue="Alvin Pratama" />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Email</span>
            <Input required type="email" placeholder="nama@email.com" defaultValue={state.user?.email ?? 'alvin.pratama@sekolahkarir.id'} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-sk-muted">Password</span>
            <Input required type="password" placeholder="••••••••" defaultValue="demo-only" minLength={4} />
          </label>
          <Button type="submit" size="lg" fullWidth className="mt-1">
            {mode === 'login' ? 'Masuk ke Sekolah Karir' : 'Daftar & Mulai'}
          </Button>
        </form>

        <p className="mt-6 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12px] leading-relaxed text-sk-body">
          Mode demo lokal: kredensial apa pun diterima dan hanya membuat sesi frontend di browser kamu. Tidak ada data yang
          dikirim ke server.
        </p>
      </motion.div>
    </div>
  );
}
