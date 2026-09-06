import Link from 'next/link';
import { ButtonLink } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { Entrance, Reveal } from '@/components/motion/Reveal';
import { StatCard } from '@/components/primitives/StatCard';
import { HowItWorks } from '@/components/arena/HowItWorks';
import { KanbanPreview } from '@/components/arena/KanbanPreview';
import { getPublicArenaHome } from '@/lib/arena-view';

export const metadata = { title: 'Side Hustle Arena' };
export const dynamic = 'force-dynamic';

export default async function ArenaLandingPage() {
  // Live week/projects/divisions. Stat cards that have no backend source
  // (fake participant/completion counters) were removed, not faked.
  //
  // `home` is null before the first week exists. The page still has a job to do
  // then — it is the public pitch for the Arena — so it renders with the
  // week-dependent slots showing that nothing is scheduled yet.
  const home = await getPublicArenaHome();
  const stats = [
    { key: 'projects', label: 'Project Minggu Ini', value: home ? String(home.projectCount) : '—' },
    { key: 'deadline', label: 'Deadline', value: home ? home.deadline : 'Belum dijadwalkan', small: true },
    { key: 'divisions', label: 'Divisi Aktif', value: home ? String(home.divisionCount) : '—' },
    { key: 'drop', label: 'Project Drop', value: 'Setiap Senin', small: true },
  ];
  return (
    <div className="relative overflow-hidden bg-sk-bg">
      <div className="ambient" aria-hidden />

      <div className="relative z-[2] mx-auto max-w-6xl px-6 pb-16 pt-32 md:pt-36">
        <div className="grid gap-14 lg:grid-cols-[1fr_460px] lg:gap-14">
          {/* Left: hero */}
          <div className="pt-2 md:pt-6">
            <Entrance>
              <span className="eyebrow">Side Hustle Arena</span>
            </Entrance>
            <h1 className="mb-5 mt-4 text-[40px] font-extrabold leading-[1.02] tracking-[-0.035em] text-sk-navy sm:text-[52px] lg:text-[62px]">
              <Entrance delay={0.08} className="block">
                Jangan cuma bilang bisa.
              </Entrance>
              <Entrance delay={0.2} className="block">
                <em className="not-italic text-sk-blue">Buktikan lewat project.</em>
              </Entrance>
            </h1>
            <Entrance delay={0.32}>
              <p className="mb-7 max-w-[520px] text-[15.5px] leading-relaxed text-sk-muted">
                Ambil satu project dunia nyata setiap minggu, kerjakan seperti kamu bekerja di industri, dapat feedback, dan
                kumpulkan bukti untuk portfolio.
              </p>
            </Entrance>
            <Entrance delay={0.42}>
              <div className="mb-8 flex flex-wrap gap-3">
                <ButtonLink href="/arena/projects" size="lg">
                  Lihat Project Minggu Ini
                </ButtonLink>
                <ButtonLink href="#cara-kerja" variant="ghost" size="lg">
                  Cara Kerjanya
                </ButtonLink>
              </div>
            </Entrance>

            <Reveal delay={0.2}>
              <div className="grid max-w-[480px] grid-cols-2 gap-3">
                {stats.map((stat) => (
                  <StatCard key={stat.key} label={stat.label} value={stat.value} small={stat.small} />
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right: this week's drop preview */}
          <Reveal delay={0.25} y={16} className="mx-auto w-full max-w-[480px]">
            <KanbanPreview
              projects={home?.projects ?? []}
              weekLabel={home?.weekLabel ?? 'Belum ada minggu aktif'}
              total={home?.projectCount ?? 0}
            />
            <div className="mt-4 text-center">
              <Link href="/arena/showcase" className="text-[13px] font-semibold text-sk-blue transition-colors hover:text-sk-blue-700">
                Lihat project terbaik minggu lalu — Weekly Spotlight
              </Link>
            </div>
          </Reveal>
        </div>

        {/* How it works */}
        <div id="cara-kerja" className="mt-24 scroll-mt-24 md:mt-32">
          <Reveal className="mb-8 max-w-xl">
            <Badge variant="slate">{home ? `WEEK ${home.weekNo}` : 'SEGERA'}</Badge>
            <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[30px]">
              Lima langkah, satu minggu.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-sk-muted">
              Bukan kelas, bukan tutorial. Kamu mengerjakan project sungguhan dan mendapat feedback yang terukur.
            </p>
          </Reveal>
          <HowItWorks />
        </div>

        {/* Closing CTA */}
        <Reveal className="mt-20" y={16}>
          <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-[#0B1933] via-[#1a2f5a] to-sk-blue p-8 text-white md:px-12 md:py-12">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(80,180,255,0.22),transparent_70%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-lg">
                <span className="eyebrow eyebrow-dark">Siap Membuktikan?</span>
                <h3 className="mt-2 text-[22px] font-extrabold tracking-[-0.02em] md:text-[26px]">
                  Satu project minggu ini bisa jadi bukti pertamamu.
                </h3>
              </div>
              <ButtonLink href="/arena/projects" variant="white" size="lg">
                Pilih Project
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
