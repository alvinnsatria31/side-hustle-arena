import { BarChart3, FileText, Target, Zap } from 'lucide-react';
import { Reveal, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { HOW_IT_WORKS, LANDING_JOURNEY } from '@/data/mock/arena';

const JOURNEY_ICONS = [FileText, Zap, BarChart3, Target];

/** Landing journey strip (01 CV Scanner → 04 Jobs). */
export function JourneyStrip() {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
      {LANDING_JOURNEY.map((step, i) => {
        const Icon = JOURNEY_ICONS[i];
        return (
          <StaggerItem key={step.n} className="relative">
            {i < LANDING_JOURNEY.length - 1 && (
              <span
                aria-hidden
                className="absolute right-[-14px] top-[22px] hidden h-0.5 w-[calc(100%-40px)] bg-gradient-to-r from-sk-blue/40 to-sk-blue/5 lg:block"
                style={{ transform: 'translateX(50%)' }}
              />
            )}
            <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-[var(--radius-sk-md)] border border-sk-blue-tint-border bg-sk-blue-tint text-sk-blue">
              <Icon size={19} aria-hidden />
            </div>
            <div className="mb-2 font-mono text-[11px] font-semibold tracking-[0.15em] text-sk-blue">{step.n}</div>
            <h4 className="mb-1 text-[15px] font-bold text-sk-navy">{step.title}</h4>
            <p className="text-[12px] leading-relaxed text-sk-muted">{step.desc}</p>
          </StaggerItem>
        );
      })}
    </StaggerGroup>
  );
}

/** Arena "how it works" 5-step strip (glass cards). */
export function HowItWorks({ className }: { className?: string }) {
  return (
    <Reveal className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {HOW_IT_WORKS.map((step) => (
          <div key={step.n} className="glass-card rounded-[var(--radius-sk-lg)] p-4 md:p-[18px]">
            <div className="font-mono text-[10px] font-bold tracking-[0.15em] text-sk-blue">{step.n}</div>
            <div className="mt-2 text-[14px] font-bold text-sk-navy">{step.title}</div>
            <div className="mt-1 text-[11.5px] leading-snug text-sk-muted">{step.desc}</div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}
