import { ButtonLink } from '@/components/primitives/Button';
import { Entrance, Reveal } from '@/components/motion/Reveal';import { CountUp } from '@/components/motion/CountUp';
import { StatCard } from '@/components/primitives/StatCard';
import { JourneyStrip } from '@/components/arena/HowItWorks';
import { HERO_FLOAT_CARDS } from '@/data/mock/arena';
import { cn } from '@/lib/cn';

const HERO_LINES = ['Bangun Skill.', 'Buktikan Kemampuan.', 'Majukan Karirmu.'];
const FLOAT_POSITIONS = [
  'left-0 top-4 md:left-2',
  'right-0 top-8 md:right-2',
  'bottom-16 left-0',
  'bottom-4 right-2 md:right-6',
];
const FLOAT_ANIMS = ['anim-float', 'anim-float-slow', 'anim-float-slower', 'anim-float'];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden bg-sk-bg">
      {/* Ambient depth + dot grid */}
      <div className="ambient" aria-hidden />
      <div className="dot-grid absolute inset-0 opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-32 md:pt-40">
        {/* ---------------- HERO ---------------- */}
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <Entrance>
              <span className="eyebrow">All-in-one Career Ecosystem</span>
            </Entrance>

            <h1 className="mb-5 mt-4 text-[42px] font-extrabold leading-[1.05] tracking-[-0.035em] text-sk-navy sm:text-[52px] lg:text-[64px]">
              {HERO_LINES.map((line, i) => (
                <Entrance key={line} delay={0.1 + i * 0.12} className="block">
                  {i === HERO_LINES.length - 1 ? (
                    <span className="text-sk-blue">{line}</span>
                  ) : (
                    line
                  )}
                </Entrance>
              ))}
            </h1>

            <Entrance delay={0.45}>
              <p className="mb-8 max-w-[520px] text-[15px] leading-relaxed text-sk-muted md:text-[16px]">
                Scan CV, temukan skill gap, kerjakan project dunia nyata, bangun bukti skill, dan temukan peluang kerja yang
                lebih relevan.
              </p>
            </Entrance>

            <Entrance delay={0.55}>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/cv-scanner" size="lg">
                  Scan CV Gratis →
                </ButtonLink>
                <ButtonLink href="/arena" variant="ghost" size="lg">
                  Lihat Side Hustle Arena
                </ButtonLink>
              </div>
            </Entrance>

            <Entrance delay={0.65}>
              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-sk-muted">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sk-success" aria-hidden />
                  12.400+ pengguna aktif
                </span>
                <span aria-hidden>·</span>
                <span>Terintegrasi dengan Jobs</span>
                <span aria-hidden>·</span>
                <span>Gratis untuk memulai</span>
              </div>
            </Entrance>
          </div>

          {/* Hero visual: orbit + core + floating glass widgets */}
          <Reveal delay={0.3} className="relative mx-auto h-[420px] w-full max-w-[480px] sm:h-[520px]">
            <div aria-hidden className="absolute inset-2 rounded-full border border-dashed border-sk-blue/25" />
            <div aria-hidden className="absolute inset-[70px] rounded-full border border-dashed border-sk-blue/25" />
            <div aria-hidden className="absolute inset-[130px] rounded-full border border-dashed border-sk-blue/25" />

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex h-[150px] w-[150px] flex-col items-center justify-center rounded-full text-white shadow-[0_40px_80px_-20px_rgba(36,107,253,0.5)] sm:h-[180px] sm:w-[180px]"
                style={{ background: 'radial-gradient(circle at 30% 30%, #4b8bff, #246BFD 60%, #1a56d6)' }}
              >
                <CountUp to={72} className="font-mono text-[40px] tracking-[-0.02em] sm:text-[44px]" />
                <span className="mt-1 font-mono text-[10px] tracking-[0.14em] opacity-85">CAREER SCORE</span>
              </div>
            </div>

            {HERO_FLOAT_CARDS.map((card, i) => (
              <div
                key={card.key}
                className={cn('absolute', FLOAT_POSITIONS[i], FLOAT_ANIMS[i])}
              >
                <StatCard label={card.label} value={card.value} suffix={card.suffix || undefined} />
              </div>
            ))}
          </Reveal>
        </div>

        {/* ---------------- JOURNEY STRIP ---------------- */}
        <Reveal className="mt-24 md:mt-32" y={16}>
          <div className="mb-10 max-w-xl">
            <span className="eyebrow">Satu Ekosistem</span>
            <h2 className="mt-2.5 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[30px]">
              Dari tahu apa yang kurang, sampai terbukti bisa.
            </h2>
          </div>
          <JourneyStrip />
        </Reveal>

        {/* ---------------- CLOSING CTA ---------------- */}
        <Reveal className="mt-20" y={16}>
          <div className="glass-nav relative overflow-hidden rounded-[var(--radius-sk-3xl)] px-7 py-10 md:px-12">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.18),transparent_65%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-lg">
                <span className="eyebrow">Mulai Hari Ini</span>
                <h3 className="mt-2 text-[22px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[26px]">
                  Pindah dari &ldquo;bisa&rdquo; ke &ldquo;terbukti bisa&rdquo;.
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-sk-muted">
                  Mulai dari scan CV — lima menit, gratis, dan langsung dapat langkah berikutnya yang spesifik.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/cv-scanner" size="lg">
                  Scan CV Gratis →
                </ButtonLink>
                <ButtonLink href="/arena/projects" variant="ghost" size="lg">
                  Lihat Project Minggu Ini
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
