import Link from 'next/link';
import { Play } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { Entrance, Reveal } from '@/components/motion/Reveal';
import { StatCard } from '@/components/primitives/StatCard';
import { ArenaTour } from '@/components/arena/ArenaTour';
import { HowItWorks } from '@/components/arena/HowItWorks';
import { LiveArenaBoard } from '@/components/arena/LiveArenaBoard';
import { MilestoneRoadmap } from '@/components/arena/MilestoneRoadmap';
import { ProjectCard } from '@/components/arena/ProjectCard';
import { getPublicArenaHome, getPublicProjects } from '@/lib/arena-view';
import { listActiveCatalogItems } from '@/server/rewards/catalog-service';

/** Cards shown on the landing; the rest stay one click away on /arena/projects. */
const LANDING_PROJECT_LIMIT = 6;

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
  // Full card data for the browsable section below the hero. Same cached reader
  // /arena/projects uses, so the landing costs no extra round trip per view.
  const { projects: catalog } = await getPublicProjects();
  const featured = catalog.slice(0, LANDING_PROJECT_LIMIT);
  // Whole week, not just the featured slice — the hero panel counts everyone.
  const participantTotal = catalog.reduce((sum, project) => sum + (project.participants ?? 0), 0);
  // The ladder is an addition to the pitch, never a dependency of it: a catalog
  // read that fails hides the section instead of taking the page down.
  const rewardSteps = await listActiveCatalogItems()
    .then((items) => items.map((item) => ({ slug: item.slug, title: item.title, pointsRequired: item.pointsCost, rewardType: item.rewardType })))
    .catch(() => []);
  const stats = [
    { key: 'projects', label: 'Proyek Minggu Ini', value: home ? String(home.projectCount) : '—' },
    { key: 'deadline', label: 'Batas Pengumpulan', value: home ? home.deadline : 'Belum dijadwalkan', small: true },
    { key: 'divisions', label: 'Divisi Aktif', value: home ? String(home.divisionCount) : '—' },
    { key: 'drop', label: 'Proyek Baru', value: 'Setiap Senin', small: true },
  ];
  return (
    <div className="relative overflow-hidden bg-sk-bg">
      <div className="ambient" aria-hidden />

      <div className="relative z-[2] mx-auto max-w-[1500px] px-6 pb-16 pt-28 md:pt-32">
        <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,900px)] xl:gap-12" data-tour="hero" data-tour-target>
          {/* Left: hero */}
          <div className="pt-2 md:pt-6">
            <Entrance>
              <span className="eyebrow">Side Hustle Arena</span>
            </Entrance>
            <h1 className="mb-4 mt-3 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-sk-navy sm:text-[40px] lg:text-[46px]">
              <Entrance delay={0.08} className="block">
                Jangan cuma bilang bisa.
              </Entrance>
              <Entrance delay={0.2} className="block">
                <em className="not-italic text-sk-blue">Tunjukkan lewat karya.</em>
              </Entrance>
            </h1>
            <Entrance delay={0.32}>
              <p className="mb-6 max-w-[460px] text-[14.5px] leading-relaxed text-sk-muted">
                Pilih proyek yang mirip tantangan kerja nyata. Kerjakan, dapatkan masukan, lalu simpan hasilnya untuk portofoliomu.
              </p>
            </Entrance>
            <Entrance delay={0.42}>
              <div className="mb-7 flex flex-wrap gap-3">
                <ButtonLink href="/arena/projects" size="md">
                  Lihat Proyek Minggu Ini
                </ButtonLink>
                <ButtonLink href="#cara-kerja" variant="ghost" size="md">
                  Cara Kerjanya
                </ButtonLink>
                <ButtonLink
                  href="/arena?tur=1"
                  variant="ghost"
                  size="md"
                  data-tour-trigger
                  iconRight={<Play size={14} strokeWidth={2.4} aria-hidden />}
                >
                  Pelajari Arena
                </ButtonLink>
              </div>
            </Entrance>

            <Reveal delay={0.2}>
              <div className="grid max-w-[420px] grid-cols-2 gap-2.5">
                {stats.map((stat) => (
                  <StatCard key={stat.key} label={stat.label} value={stat.value} small={stat.small} />
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right: this week's drop preview */}
          <Reveal delay={0.25} y={16} className="mx-auto w-full max-w-[900px] xl:self-center">
            <LiveArenaBoard
              weekNo={home?.weekNo}
              deadline={home?.deadline}
              deadlineAt={home?.deadlineAt}
              participantCount={participantTotal}
              points={home?.points}
            />
            <div className="mt-4 text-center">
              <Link href="/arena/showcase" className="text-[13px] font-semibold text-sk-blue transition-colors hover:text-sk-blue-700">
                Lihat karya berperingkat di Sorotan Mingguan
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Available projects: the actual catalog, not a pitch for it. */}
        <div id="proyek" className="mt-20 scroll-mt-24 md:mt-24" data-tour="proyek" data-tour-target>
          <Reveal className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="max-w-xl">
              <Badge variant="slate">{home ? `MINGGU ${home.weekNo}` : 'SEGERA'}</Badge>
              <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[30px]">
                Proyek yang tersedia sekarang.
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-sk-muted">
                {home
                  ? `Pilih satu yang paling menantang buatmu. Batas pengumpulan ${home.deadline}.`
                  : 'Proyek baru dibuka setiap Senin. Sekarang belum ada jadwal yang berjalan.'}
              </p>
            </div>
            {catalog.length > 0 && (
              <Link
                href="/arena/projects"
                className="text-[13.5px] font-semibold text-sk-blue transition-colors hover:text-sk-blue-700"
              >
                Lihat semua proyek →
              </Link>
            )}
          </Reveal>

          {featured.length === 0 ? (
            <p role="status" className="rounded-[var(--radius-sk-2xl)] border border-dashed border-sk-border bg-white px-6 py-10 text-center text-[14px] text-sk-muted">
              Belum ada proyek yang dibuka. Proyek baru biasanya hadir setiap Senin — cek lagi nanti, ya.
            </p>
          ) : (
            <Reveal y={16}>
              <div className="grid gap-[18px] md:grid-cols-2 lg:grid-cols-3">
                {featured.map((project) => (
                  <ProjectCard key={project.slug} project={project} />
                ))}
              </div>
            </Reveal>
          )}

          {catalog.length > featured.length && (
            <div className="mt-8 text-center">
              <ButtonLink href="/arena/projects" variant="ghost" size="md">
                Lihat {catalog.length - featured.length} proyek lainnya
              </ButtonLink>
            </div>
          )}
        </div>

        {/* How it works */}
        <div id="cara-kerja" className="mt-24 scroll-mt-24 md:mt-32" data-tour="cara-kerja" data-tour-target>
          <Reveal className="mb-8 max-w-xl">
            <Badge variant="slate">{home ? `MINGGU ${home.weekNo}` : 'SEGERA'}</Badge>
            <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[30px]">
              Dari pilih proyek sampai lihat hasilnya.
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-sk-muted">
              Pilih tantangannya, kerjakan sesuai brief, lalu lihat penilaian berdasarkan rubrik yang jelas.
            </p>
          </Reveal>
          <HowItWorks />
        </div>

        {/* Reward ladder: what the points from each week's result add up to. */}
        {rewardSteps.length > 0 && (
          <div id="hadiah" className="mt-24 scroll-mt-24 md:mt-28" data-tour="hadiah" data-tour-target>
            <Reveal className="mb-8 max-w-2xl">
              <Badge variant="slate">HADIAH</Badge>
              <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[30px]">
                Kumpulkan poin, tukar dengan hadiah.
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-sk-muted">
                Proyek yang dinilai memberimu poin sesuai skor (0–100). Tiga peringkat teratas juga mendapat bonus
                200, 100, atau 50 poin. Poinmu tidak hangus dan bisa dipakai untuk menukar hadiah.
              </p>
            </Reveal>
            <Reveal y={16}>
              <MilestoneRoadmap steps={rewardSteps} />
            </Reveal>
          </div>
        )}

        {/* Closing CTA */}
        <Reveal className="mt-20" y={16}>
          <div id="mulai" data-tour="mulai" data-tour-target className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-[#0B1933] via-[#1a2f5a] to-sk-blue p-8 text-white md:px-12 md:py-12">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(80,180,255,0.22),transparent_70%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-lg">
                <span className="eyebrow eyebrow-dark">Siap Mulai?</span>
                <h3 className="mt-2 text-[22px] font-extrabold tracking-[-0.02em] md:text-[26px]">
                  Mulai dari satu proyek. Tunjukkan apa yang bisa kamu kerjakan.
                </h3>
              </div>
              <ButtonLink href="/arena/projects" variant="white" size="lg">
                Pilih Proyek
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
      <ArenaTour />
    </div>
  );
}
