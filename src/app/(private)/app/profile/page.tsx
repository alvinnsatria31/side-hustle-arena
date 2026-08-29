'use client';

import { useRouter } from 'next/navigation';
import { useDemoAuth } from '@/features/auth/useDemoAuth';
import { mockUser } from '@/data/mock/user';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { Badge } from '@/components/primitives/Badge';
import { CareerMetric } from '@/components/ui/CareerMetric';
import { Briefcase, Target, Award, LogOut, Edit3, Sparkles } from 'lucide-react';
import { useState } from 'react';

const interests = ['Marketing', 'Data', 'UI/UX', 'Business', 'AI', 'Product'];

export default function ProfilePage() {
  const router = useRouter();
  const { signOut } = useDemoAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Marketing', 'Data']);
  const [editing, setEditing] = useState(false);

  const toggle = (i: string) => {
    setSelectedInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  };

  return (
    <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-8 lg:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[var(--color-brand-500)] text-white text-[18px] font-bold flex items-center justify-center">
            {mockUser.initials}
          </div>
          <div>
            <h1 className="text-[24px] sm:text-[30px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
              {mockUser.name}
            </h1>
            <p className="text-[13.5px] text-[var(--color-ink-tertiary)]">{mockUser.email}</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<LogOut className="h-4 w-4" />}
          onClick={() => {
            signOut();
            router.push('/');
          }}
        >
          Keluar
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <CareerMetric label="Points" value={mockUser.points.toLocaleString('id-ID')} sublabel="akumulasi" icon={<Sparkles className="h-4.5 w-4.5" />} />
        <CareerMetric label="Streak" value={`${mockUser.streakWeeks} weeks`} sublabel="aktif" icon={<Target className="h-4.5 w-4.5" />} tone="brand" />
        <CareerMetric label="Projects" value="8" sublabel="selesai" icon={<Award className="h-4.5 w-4.5" />} />
      </div>

      {/* Profile sections */}
      <div className="mt-7 space-y-5">
        <Card padding="lg">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Career Interest</h2>
            <button
              type="button"
              onClick={() => setEditing((s) => !s)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)]"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editing ? 'Selesai' : 'Edit'}
            </button>
          </div>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-tertiary)]">
            Pilih 1–3 divisi yang jadi fokus karirmu.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {interests.map((i) => {
              const active = selectedInterests.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => editing && toggle(i)}
                  className={
                    'h-8 px-3 rounded-[var(--radius-pill)] text-[12.5px] font-semibold border transition-colors ' +
                    (active
                      ? 'bg-[var(--color-brand-500)] text-white border-[var(--color-brand-500)]'
                      : 'bg-white text-[var(--color-ink-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]')
                  }
                >
                  {i}
                </button>
              );
            })}
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Current Focus</h2>
          <Textarea
            defaultValue={mockUser.currentFocus}
            rows={3}
            className="mt-3"
            readOnly={!editing}
          />
        </Card>

        <Card padding="lg">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-primary)]">Akses cepat</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Portfolio', href: '/app/portfolio', desc: 'Lihat case study' },
              { label: 'Rewards', href: '/app/rewards', desc: 'Tukar poin' },
              { label: 'Career Report', href: '/app/report', desc: 'Pantau pertumbuhan' },
              { label: 'Weekly Project', href: '/app/project', desc: 'Lanjutkan kerja' },
            ].map((it) => (
              <a
                key={it.label}
                href={it.href}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white hover:bg-[var(--color-surface-soft)] transition-colors"
              >
                <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-[var(--color-ink-primary)]">{it.label}</p>
                  <p className="text-[11.5px] text-[var(--color-ink-tertiary)]">{it.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </Card>

        <Card padding="lg" className="bg-[var(--color-surface-soft)]">
          <p className="text-[11.5px] text-[var(--color-ink-tertiary)]">
            Bergabung sejak {new Date(mockUser.joinedAt).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}.
          </p>
        </Card>
      </div>
    </div>
  );
}
