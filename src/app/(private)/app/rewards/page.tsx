import { Gift, Lock, Sparkles, Calendar } from 'lucide-react';
import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { mockUser } from '@/data/mock/user';
import { mockRewards } from '@/data/mock/rewards';
import { cn } from '@/lib/cn';

export default function RewardsPage() {
  const userPoints = mockUser.points;
  return (
    <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-8 lg:py-10">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
          Rewards
        </span>
        <h1 className="mt-2 text-[28px] sm:text-[34px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
          Tukar poin karirmu.
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--color-ink-tertiary)] max-w-xl">
          Kumpulkan poin dari setiap project yang kamu selesaikan, lalu tukarkan dengan benefit karirmu.
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card padding="xl" className="bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-brand-600)] text-white border-transparent overflow-hidden relative">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
            <Sparkles className="h-3.5 w-3.5" />
            Points Balance
          </div>
          <p className="mt-3 text-[48px] sm:text-[60px] font-bold leading-none tracking-[-0.03em]">
            {userPoints.toLocaleString('id-ID')}
          </p>
          <p className="mt-1 text-[14px] text-white/80">pts · akumulasi</p>
          <div className="mt-7 grid grid-cols-3 gap-3 text-[12.5px]">
            <Stat label="Earned this week" value="+450" />
            <Stat label="Redeemed" value="0" />
            <Stat label="Project done" value="8" />
          </div>
        </Card>

        <Card padding="lg">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink-primary)]">Cara dapat poin</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {[
              { label: 'Submit project mingguan', pts: '+300 – 550' },
              { label: 'Skor di atas 80', pts: '+50 bonus' },
              { label: 'Streak 4 minggu berturut', pts: '+200' },
            ].map((c) => (
              <li key={c.label} className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]">
                <span className="text-[13.5px] font-medium text-[var(--color-ink-primary)]">{c.label}</span>
                <span className="text-[12.5px] font-semibold text-[var(--color-brand-600)] tabular-nums">{c.pts}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="text-[18px] font-semibold text-[var(--color-ink-primary)]">Benefit untuk kamu</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mockRewards.map((r) => {
            const canAfford = userPoints >= r.costPoints;
            const locked = !canAfford;
            return (
              <Card
                key={r.id}
                padding="lg"
                className={cn('h-full flex flex-col', locked && 'opacity-85')}
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
                    <Gift className="h-4.5 w-4.5" />
                  </div>
                  {locked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-tertiary)]">
                      <Lock className="h-3 w-3" />
                      Locked
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-ink-primary)] leading-snug">
                  {r.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)] flex-1">
                  {r.description}
                </p>
                <p className="mt-3 text-[12px] text-[var(--color-ink-tertiary)] inline-flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {r.estimatedTime}
                </p>
                <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                  <span className="text-[15px] font-bold text-[var(--color-ink-primary)] tabular-nums">
                    {r.costPoints.toLocaleString('id-ID')} pts
                  </span>
                  <Button
                    variant={canAfford ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={locked}
                  >
                    {canAfford ? 'Tukar' : `Butuh ${(r.costPoints - userPoints).toLocaleString('id-ID')}`}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-white/10 px-3 py-2.5">
      <p className="text-[11px] text-white/70 font-medium">{label}</p>
      <p className="mt-1 text-[16px] font-bold tabular-nums">{value}</p>
    </div>
  );
}
