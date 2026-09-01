'use client';

import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Badge } from '@/components/primitives/Badge';
import { Button, ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Entrance } from '@/components/motion/Reveal';
import { useDemo } from '@/features/demo/store';
import { useRouter } from 'next/navigation';
import { DEMO_USER } from '@/data/mock/user';
import { useToast } from '@/features/ui/toast';

export default function ProfilePage() {
  const { state, snapshot, logout, resetDemo } = useDemo();
  const { showToast } = useToast();
  const router = useRouter();
  const user = state.user ?? DEMO_USER;

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumb items={[{ label: 'App', href: '/app' }, { label: 'Profile' }]} />

      <Entrance className="mt-5">
        <Card className="p-7 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sk-blue to-sk-blue-400 text-[20px] font-bold text-white">
              {user.initials}
            </span>
            <div>
              <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy">{user.displayName}</h1>
              <p className="font-mono text-[11.5px] text-sk-muted">{user.email}</p>
            </div>
            <Badge variant="slate" className="ml-auto">
              SESI DEMO LOKAL
            </Badge>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'CV SCORE', v: snapshot.cvScore ?? '—' },
              { k: 'PROJECTS', v: snapshot.projectsCompleted },
              { k: 'SKILLS', v: snapshot.skillsProven.length },
              { k: 'POINTS', v: snapshot.careerPoints },
            ].map((s) => (
              <div key={s.k} className="rounded-[var(--radius-sk-lg)] border border-sk-border bg-sk-bg p-3.5 text-center">
                <div className="font-mono text-[9.5px] tracking-[0.1em] text-sk-muted">{s.k}</div>
                <div className="mt-1 text-[22px] font-extrabold text-sk-navy">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash p-4 text-[12.5px] leading-relaxed text-sk-body">
            Ini adalah akun demo frontend. Semua data disimpan di <b>localStorage browser ini</b> dan tidak ada koneksi ke
            backend atau database. Gunakan &ldquo;Reset demo&rdquo; untuk mengembalikan seluruh data ke kondisi awal.
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                resetDemo();
                showToast('Demo direset. Data kembali ke awal.');
                router.push('/app');
              }}
            >
              Reset Demo
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                showToast('Sesi demo ditutup.');
                router.push('/');
              }}
              className="text-sk-error hover:bg-sk-error-wash"
            >
              Keluar
            </Button>
            <ButtonLink href="/app/career-report" variant="ghost" className="ml-auto">
              Lihat Career Report
            </ButtonLink>
          </div>
        </Card>
      </Entrance>
    </div>
  );
}
