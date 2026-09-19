import Link from 'next/link';
import { ArrowRight, Eye, Gavel, Lock, Play, Trophy } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Badge } from '@/components/primitives/Badge';
import { Card } from '@/components/primitives/Card';
import { Entrance, Reveal } from '@/components/motion/Reveal';
import { HeroTiltPanel } from '@/components/arena/HeroTiltPanel';
import { SprintCountdownPanel } from '@/components/arena/SprintCountdownPanel';
import { StageTabs } from '@/components/arena/StageTabs';
import { LandingFaq } from '@/components/arena/LandingFaq';
import { getPublicArenaHome } from '@/lib/arena-view';
import { getLatestSpotlightWithConsent } from '@/server/finalization/showcase-service';
import { listActiveCatalogItems } from '@/server/rewards/catalog-service';

export const metadata = { title: 'Sekolah Karir — Side Hustle Arena' };
export const dynamic = 'force-dynamic';

/**
 * Appear animation, taken from the live Saasto site rather than estimated.
 *
 * Its pages ship the config inline: every element carries
 * `initial {opacity: 0.001, y: 100}` and animates to `{opacity: 1, y: 0}` on a
 * tween of 0.8s with ease [0.44, 0, 0.56, 1] and — on all 29 of them — a delay
 * of 0. There is no stagger anywhere in that design, so there is none here.
 */
const APPEAR = { y: 100, duration: 0.8, ease: [0.44, 0, 0.56, 1] as [number, number, number, number] };


/**
 * The public pitch.
 *
 * Every number on this page is read from the week that is actually running.
 * The Arena's differentiator is that something is happening right now, so a
 * hardcoded countdown or an invented participant count would be selling the
 * one thing the page cannot then deliver. Where there is no backend source —
 * seat quotas, a platform-wide member count, testimonials — the section is
 * left out rather than filled with a plausible number.
 */
export default async function LandingPage() {
  // Each read is independent: the pitch still stands if the ladder or the
  // spotlight is unavailable, so neither is allowed to take the page down.
  const [home, spotlight, rewards] = await Promise.all([
    getPublicArenaHome().catch(() => null),
    getLatestSpotlightWithConsent()
      .then((result) => result.entries)
      .catch(() => []),
    listActiveCatalogItems().catch(() => []),
  ]);

  const isOpen = Boolean(home?.canSelect);
  const projects = home?.projects.slice(0, 3) ?? [];
  const ladder = spotlight.slice(0, 5);
  const rewardSteps = rewards.slice(0, 4);

  return (
    <div className="relative overflow-hidden bg-sk-bg">
      <div className="ambient" aria-hidden />
      <div className="dot-grid absolute inset-0 opacity-40" aria-hidden />

      {/* ─── HERO ────────────────────────────────────────────────────────
          Centred, with the live sprint panel standing in for the product
          screenshot a SaaS template puts here. The panel is the real week:
          if the hero is the strongest claim the page makes, it should be the
          one thing on the page that cannot be stale. */}
      <section className="relative px-6 pt-16 md:pt-24">
        {/* Light spill down both edges. Decorative only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[30%] opacity-90 blur-[44px] bg-[linear-gradient(90deg,rgba(36,107,253,0.38),rgba(36,107,253,0.12)_46%,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-[30%] opacity-90 blur-[44px] bg-[linear-gradient(270deg,rgba(80,200,220,0.34),rgba(36,107,253,0.11)_46%,transparent)]"
        />

        <div className="relative mx-auto max-w-[900px] text-center">
          <Entrance {...APPEAR}>
            <span className="inline-flex items-center gap-2 rounded-full border border-sk-blue-tint-border bg-sk-blue-tint px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-sk-blue-700">
              <span
                aria-hidden
                className={isOpen ? 'h-1.5 w-1.5 rounded-full bg-sk-success' : 'h-1.5 w-1.5 rounded-full bg-sk-faint'}
              />
              {home ? home.weekLabel : 'Belum ada sprint terjadwal'}
              {home ? (isOpen ? ' · Pendaftaran dibuka' : ' · Pendaftaran ditutup') : null}
            </span>
          </Entrance>

          <Entrance {...APPEAR}>
            <h1 className="mx-auto mt-7 max-w-[15ch] text-[40px] font-extrabold leading-[1.05] tracking-[-0.038em] text-sk-navy sm:text-[54px] lg:text-[64px]">
              Kompetisi proyek mingguan yang jadi{' '}
              <span className="text-sk-blue">portofoliomu.</span>
            </h1>
          </Entrance>

          <Entrance {...APPEAR}>
            <p className="mx-auto mt-5 max-w-[52ch] text-[15px] leading-relaxed text-sk-muted md:text-[16.5px]">
              Ambil satu brief nyata, kerjakan dalam satu minggu, lalu dinilai per
              kriteria yang sudah kamu lihat sejak awal.
            </p>
          </Entrance>

          <Entrance {...APPEAR}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink
                href="/arena/projects"
                size="lg"
                className="rounded-full"
                iconRight={<ArrowRight size={16} strokeWidth={2.4} aria-hidden />}
              >
                Lihat proyek minggu ini
              </ButtonLink>
              <ButtonLink
                href="/arena"
                variant="ghost"
                size="lg"
                className="rounded-full"
                iconRight={<Play size={14} strokeWidth={2.4} aria-hidden />}
              >
                Pelajari Arena
              </ButtonLink>
            </div>
          </Entrance>
        </div>

        {/* Live sprint panel — the hero's "product shot". */}
        <HeroTiltPanel className="relative mx-auto mt-16 max-w-6xl">
          <Card className="overflow-hidden shadow-sk-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sk-border bg-sk-bg px-5 py-3.5">
              <span className="inline-flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="grid h-6 w-6 place-items-center rounded-[8px] bg-sk-blue text-white"
                >
                  <Trophy size={13} strokeWidth={2.4} />
                </span>
                <span className="text-[14px] font-extrabold tracking-[-0.025em] text-sk-navy">
                  {home ? home.weekLabel : 'Arena'}
                </span>
              </span>
              <Badge variant={isOpen ? 'mint' : 'slate'}>{isOpen ? 'BUKA' : 'TUTUP'}</Badge>
            </div>

            {home ? (
              <div className="p-5 md:p-7">
                <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
                  <SprintCountdownPanel
                    deadlineAt={home.deadlineAt}
                    deadlineLabel={home.deadline}
                    isOpen={isOpen}
                  />

                  <dl className="grid grid-cols-2 gap-4">
                    <div className="rounded-[var(--radius-sk-xl)] border border-sk-border bg-sk-bg p-5">
                      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
                        Proyek dibuka
                      </dt>
                      <dd className="mt-2 font-mono text-[30px] font-bold leading-none tracking-[-0.035em] text-sk-navy">
                        {home.projectCount}
                      </dd>
                    </div>
                    <div className="rounded-[var(--radius-sk-xl)] border border-sk-border bg-sk-bg p-5">
                      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
                        Divisi
                      </dt>
                      <dd className="mt-2 font-mono text-[30px] font-bold leading-none tracking-[-0.035em] text-sk-navy">
                        {home.divisionCount}
                      </dd>
                    </div>
                  </dl>
                </div>

                {projects.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {projects.map((project) => (
                      <Link
                        key={project.slug}
                        href={`/arena/projects/${project.slug}`}
                        className="group rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-4 transition-colors hover:border-sk-blue-tint-border hover:bg-sk-blue-wash focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
                      >
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-sk-blue-700">
                          {project.category}
                        </span>
                        <p className="mt-1.5 line-clamp-2 text-[13.5px] font-bold leading-snug text-sk-navy">
                          {project.title}
                        </p>
                        <span className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-sk-muted">
                          {project.estimatedTime}
                          <ArrowRight
                            size={13}
                            strokeWidth={2.4}
                            aria-hidden
                            className="ml-auto text-sk-blue transition-transform duration-300 group-hover:translate-x-0.5"
                          />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-6 py-14 text-center">
                <p className="text-[16px] font-bold text-sk-navy">Belum ada sprint terjadwal</p>
                <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-sk-muted">
                  Minggu berikutnya akan muncul di sini begitu dijadwalkan.
                </p>
              </div>
            )}
          </Card>
        </HeroTiltPanel>
      </section>

      <div className="relative mx-auto max-w-6xl px-6 pb-24">

        {/* ─── CARA KERJA ───────────────────────────────────────────────── */}
        <section className="mt-28 md:mt-36">
          <Reveal {...APPEAR}>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Cara kerja</span>
              <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                Tiga langkah, satu minggu.
              </h2>
              <p className="mx-auto mt-3 max-w-[52ch] text-[15px] leading-relaxed text-sk-muted">
                Tidak ada kelas dan tidak ada materi yang menumpuk. Langsung kerja,
                langsung dinilai.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              ['Pilih briefnya', 'Brief disusun dari kebutuhan nyata tiap divisi. Pilih yang paling dekat dengan arah karier yang kamu tuju.'],
              ['Kerjakan bertahap', 'Workspace membimbingmu lewat lima tahap, dari membaca brief sampai mengirim hasil.'],
              ['Dapat skor dan bukti', 'Hasil dinilai per kriteria. Yang terbaik tiap minggu masuk sorotan publik.'],
            ].map(([title, body], i) => (
              <Reveal key={title} {...APPEAR}>
                <Card className="h-full p-8 md:p-10">
                  <span
                    aria-hidden
                    className="grid h-12 w-12 place-items-center rounded-[var(--radius-sk-lg)] border border-sk-blue-tint-border bg-sk-blue-tint font-mono text-[15px] font-bold text-sk-blue-700"
                  >
                    0{i + 1}
                  </span>
                  <h3 className="mt-5 text-[22px] font-bold tracking-[-0.032em] text-sk-navy">{title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-sk-muted">{body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── PENILAIAN ────────────────────────────────────────────────
            The objection every competitor has before entering. The three
            guarantees below are properties of the review pipeline, not
            marketing copy — no criterion weights are quoted here because
            weights are per project and live on the project page. */}
        <section className="mt-28 md:mt-36">
          <Reveal {...APPEAR}>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Penilaian</span>
              <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                Kamu tahu dinilai dari apa, sebelum mulai.
              </h2>
              <p className="mx-auto mt-3 max-w-[54ch] text-[15px] leading-relaxed text-sk-muted">
                Tiap proyek membawa rubriknya sendiri, dan rubrik itu terbuka di
                halaman proyek sejak sebelum kamu menulis baris pertama.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              [Eye, 'Dinilai tanpa identitas', 'Penilai membaca hasil kerjamu tanpa tahu nama, kampus, atau riwayat sprint sebelumnya.'],
              [Gavel, 'Penilai kedua kalau ragu', 'Penilaian dengan keyakinan rendah atau yang tidak sepakat dibaca ulang oleh penilai kedua.'],
              [Lock, 'Skor dihitung di Arena', 'Nilai akhir dihitung di dalam sistem. Tidak ada pihak luar yang bisa menyetorkan skor.'],
            ].map(([Icon, title, body]) => {
              const Ico = Icon as typeof Eye;
              return (
                <Reveal key={title as string} {...APPEAR}>
                  <Card className="h-full p-8 md:p-10">
                    <span
                      aria-hidden
                      className="grid h-12 w-12 place-items-center rounded-[var(--radius-sk-lg)] border border-sk-success-tint bg-sk-success-tint text-sk-success"
                    >
                      <Ico size={22} strokeWidth={2.2} />
                    </span>
                    <h3 className="mt-5 text-[21px] font-bold tracking-[-0.032em] text-sk-navy">
                      {title as string}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-sk-muted">{body as string}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* ─── TAHAPAN ──────────────────────────────────────────────────── */}
        <section className="mt-28 md:mt-36">
          <Reveal {...APPEAR}>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Tahapan</span>
              <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                Lima tahap, tidak ada yang ditebak.
              </h2>
            </div>
          </Reveal>
          <Reveal {...APPEAR}>
            <Card className="mt-12 p-6 md:p-9">
              <StageTabs />
            </Card>
          </Reveal>
        </section>

        {/* ─── PROYEK MINGGU INI ────────────────────────────────────────── */}
        {projects.length > 0 && (
          <section className="mt-28 md:mt-36">
            <Reveal {...APPEAR}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-xl">
                  <span className="eyebrow">Minggu ini</span>
                  <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                    Proyek yang sedang dibuka.
                  </h2>
                </div>
                <Link
                  href="/arena/projects"
                  className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-sk-blue underline-offset-4 hover:underline"
                >
                  Lihat semua {home?.projectCount ?? ''} proyek
                  <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
                </Link>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {projects.map((project) => (
                <Reveal key={project.slug} {...APPEAR}>
                  <Link
                    href={`/arena/projects/${project.slug}`}
                    className="group block h-full rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white p-8 transition-all md:p-10 duration-300 ease-out hover:-translate-y-1 hover:border-sk-blue-tint-border hover:shadow-sk-md focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
                  >
                    <Badge variant="blue">{project.category}</Badge>
                    <h3 className="mt-4 text-[18px] font-bold leading-snug tracking-[-0.03em] text-sk-navy">
                      {project.title}
                    </h3>
                    <p className="mt-2.5 text-[13.5px] leading-relaxed text-sk-muted">
                      {project.deliverable}
                    </p>
                    <div className="mt-5 flex items-center gap-2 border-t border-sk-border pt-4 text-[12.5px] font-semibold text-sk-muted">
                      <span>{project.estimatedTime}</span>
                      <span aria-hidden>·</span>
                      <span>{project.participantCount} peserta</span>
                      <ArrowRight
                        size={15}
                        strokeWidth={2.4}
                        aria-hidden
                        className="ml-auto text-sk-blue transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ─── SOROTAN ──────────────────────────────────────────────────
            Real finalized rankings, and only from participants who consented
            to appear. Nothing renders when the latest week has no entries. */}
        {ladder.length > 0 && (
          <section className="mt-28 md:mt-36">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <Reveal {...APPEAR}>
                <span className="eyebrow">Sorotan</span>
                <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                  Hasil nyata dari sprint yang sudah selesai.
                </h2>
                <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-sk-muted">
                  Peringkat mingguan dihitung dari skor akhir, dan hanya tampil
                  kalau pesertanya mengizinkan. Tiap entri punya halaman sendiri
                  yang bisa dibagikan.
                </p>
                <div className="mt-7">
                  <ButtonLink href="/arena/showcase" variant="ghost">
                    Lihat sorotan lengkap
                  </ButtonLink>
                </div>
              </Reveal>

              <Reveal {...APPEAR}>
                <Card className="p-2.5 shadow-sk-md">
                  <ul>
                    {ladder.map((entry) => (
                      <li key={entry.slug}>
                        <Link
                          href={`/arena/showcase/${entry.slug}`}
                          className="flex items-center gap-3.5 rounded-[var(--radius-sk-lg)] px-4 py-3.5 transition-colors hover:bg-sk-bg focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
                        >
                          <span
                            className={`w-6 text-center font-mono text-[13px] font-bold ${
                              entry.rank <= 3 ? 'text-sk-warning-ink' : 'text-sk-faint'
                            }`}
                          >
                            {entry.rank}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-bold text-sk-navy">
                              {entry.participantName}
                            </span>
                            <span className="block truncate text-[12.5px] text-sk-muted">
                              {entry.divisionName} · {entry.projectTitle}
                            </span>
                          </span>
                          <span className="font-mono text-[14px] font-bold text-sk-blue-700">
                            {Math.round(entry.finalScore)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            </div>
          </section>
        )}

        {/* ─── HADIAH ───────────────────────────────────────────────────── */}
        {rewardSteps.length > 0 && (
          <section className="mt-28 md:mt-36">
            <Reveal {...APPEAR}>
              <div className="mx-auto max-w-2xl text-center">
                <span className="eyebrow">Hadiah</span>
                <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                  Poinnya bisa ditukar.
                </h2>
                <p className="mx-auto mt-3 max-w-[50ch] text-[15px] leading-relaxed text-sk-muted">
                  Tiap tahap yang kamu selesaikan menambah poin. Katalognya terbuka
                  sejak hari pertama.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {rewardSteps.map((item) => (
                <Reveal key={item.slug} {...APPEAR}>
                  <Card className="h-full p-7 md:p-8">
                    <span className="font-mono text-[12px] font-bold text-sk-warning-ink">
                      {item.pointsCost} poin
                    </span>
                    <h3 className="mt-2.5 text-[15.5px] font-bold leading-snug tracking-[-0.03em] text-sk-navy">
                      {item.title}
                    </h3>
                  </Card>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* ─── FAQ ──────────────────────────────────────────────────────── */}
        <section className="mt-28 md:mt-36">
          <Reveal {...APPEAR}>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">FAQ</span>
              <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                Sebelum kamu ikut.
              </h2>
            </div>
          </Reveal>
          <Reveal className="mx-auto mt-12 max-w-[820px]" {...APPEAR}>
            <LandingFaq />
          </Reveal>
        </section>

        {/* ─── PENUTUP ──────────────────────────────────────────────────── */}
        <Reveal className="mt-24" {...APPEAR}>
          <div className="glass-nav relative overflow-hidden rounded-[var(--radius-sk-3xl)] px-7 py-10 md:px-12">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-32 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.18),transparent_65%)]"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-lg">
                <span className="eyebrow">Mulai hari ini</span>
                <h3 className="mt-2 text-[22px] font-extrabold tracking-[-0.025em] text-sk-navy md:text-[27px]">
                  {home && isOpen
                    ? 'Sprint minggu ini masih terbuka.'
                    : 'Mulai bangun bukti dari hasil kerjamu.'}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-sk-muted">
                  {home && isOpen
                    ? `Pilih satu dari ${home.projectCount} proyek yang dibuka, lalu mulai kerjakan.`
                    : 'Lihat proyek yang pernah dibuka dan siapkan langkahmu untuk sprint berikutnya.'}
                </p>
              </div>
              <ButtonLink href="/arena/projects" size="lg">
                Lihat proyek
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
