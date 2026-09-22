import { ArrowUpRight, ChevronDown, Gift, PenLine, Sparkles } from 'lucide-react';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Entrance, Reveal } from '@/components/motion/Reveal';
import { LandingFaq } from '@/components/arena/LandingFaq';
import { LandingProjectRail } from '@/components/landing/LandingProjectRail';
import { SprintStatusStrip } from '@/components/landing/SprintStatusStrip';
import { PortfolioProofVisual } from '@/components/landing/PortfolioProofVisual';
import { BriefToPortfolioFlow } from '@/components/landing/BriefToPortfolioFlow';
import { CaraIkutStepper } from '@/components/landing/CaraIkutStepper';
import { ARENA_ENTRY_LABEL, arenaEntryHref } from '@/components/landing/arena-entry';
import { getPublicArenaHome } from '@/lib/arena-view';
import { getCurrentUser } from '@/server/auth';
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
 *
 * The page is a hook, not a second product. It answers four things in order —
 * what is running now, how to join, what you get out of it, and the questions
 * that stop people entering — and then gets out of the way. Everything that
 * belongs to a participant (browsing every brief, the judging pipeline, the
 * showcase ladder) lives behind the one door this page points at.
 */
export default async function LandingPage() {
  // Each read is independent: the pitch still stands if the reward catalogue
  // or the session is unavailable, so neither is allowed to take the page down.
  const [home, rewards, user] = await Promise.all([
    getPublicArenaHome().catch(() => null),
    listActiveCatalogItems().catch(() => []),
    getCurrentUser().catch(() => null),
  ]);

  const isOpen = Boolean(home?.canSelect);
  const projects = home?.projects.slice(0, 3) ?? [];
  const points = home?.points ?? null;
  const rewardPicks = rewards.slice(0, 3);
  const entryHref = arenaEntryHref(user !== null);

  return (
    <div className="relative overflow-hidden bg-sk-bg">
      <div className="ambient" aria-hidden />
      <div className="dot-grid absolute inset-0 opacity-40" aria-hidden />

      {/* ─── HERO ────────────────────────────────────────────────────────
          Kept as it was: centred, the same light spill down both edges, the
          same headline in the same place. The one change below the buttons is
          what the page proves itself with — three live briefs instead of a
          panel of counts. */}
      <section className="relative px-6 pt-28 md:pt-32">
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
                href={entryHref}
                size="lg"
                className="rounded-full"
                iconRight={<ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />}
              >
                {ARENA_ENTRY_LABEL}
              </ButtonLink>
              <ButtonLink
                href="#cara-ikut"
                variant="ghost"
                size="lg"
                className="rounded-full"
                iconRight={<ChevronDown size={14} strokeWidth={2.4} aria-hidden />}
              >
                Lihat cara kerja
              </ButtonLink>
            </div>
          </Entrance>

          {home && (
            <Entrance {...APPEAR}>
              <div className="mt-8">
                <SprintStatusStrip
                  deadlineAt={home.deadlineAt}
                  deadlineLabel={home.deadline}
                  projectCount={home.projectCount}
                  divisionCount={home.divisionCount}
                  isOpen={isOpen}
                />
              </div>
            </Entrance>
          )}
        </div>
      </section>

      <div className="relative mx-auto max-w-6xl px-6 pb-24">
        {/* ─── PROYEK AKTIF ──────────────────────────────────────────────
            The hero's product shot, and the page's only real evidence. */}
        <section className="mt-14 md:mt-16" aria-labelledby="proyek-aktif">
          <LandingProjectRail
            projects={projects}
            entryHref={entryHref}
            deadline={home?.deadline ?? null}
            completionPoints={points?.completion ?? null}
            projectCount={home?.projectCount ?? 0}
          />
        </section>

        {/* ─── CARA IKUT ─────────────────────────────────────────────────
            Target of the hero's second button, so it has to answer the whole
            question in one screen. Three steps, walked one at a time. */}
        <section id="cara-ikut" className="scroll-mt-28 mt-28 md:mt-36">
          <Reveal {...APPEAR}>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Cara ikut</span>
              <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                Tiga langkah, satu minggu.
              </h2>
              <p className="mx-auto mt-3 max-w-[50ch] text-[15px] leading-relaxed text-sk-muted">
                Tidak ada kelas dan tidak ada materi yang menumpuk. Langsung kerja,
                langsung dinilai.
              </p>
            </div>
          </Reveal>

          <Reveal className="mt-12" {...APPEAR}>
            <CaraIkutStepper />
          </Reveal>
        </section>

        {/* ─── MANFAAT ───────────────────────────────────────────────────
            What is left after the week ends. Two things are true and both are
            shown: the work itself becomes something you can put in front of an
            employer, and the score becomes points you can spend. Neither claim
            goes past what the product does — the profile entry is added by the
            participant, by hand, and the illustration says so. */}
        <section className="mt-28 md:mt-36">
          <Reveal {...APPEAR}>
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Yang kamu bawa pulang</span>
              <h2 className="mt-3 text-[30px] font-extrabold tracking-[-0.028em] text-sk-navy md:text-[38px]">
                Satu minggu kerja, dua bukti.
              </h2>
              <p className="mx-auto mt-3 max-w-[54ch] text-[15px] leading-relaxed text-sk-muted">
                Hasil yang bisa kamu tunjukkan ke perekrut, dan poin yang bisa kamu
                tukar di katalog hadiah.
              </p>
            </div>
          </Reveal>

          <Reveal className="mt-12" {...APPEAR}>
            <BriefToPortfolioFlow />
          </Reveal>

          <div id="linkedin" className="mt-6 grid scroll-mt-28 items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
            <Reveal className="h-full" {...APPEAR}>
              <Card className="flex h-full flex-col p-7 md:p-9">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sk-success-tint bg-sk-success-tint px-3 py-1 text-[11.5px] font-bold text-sk-success">
                  <PenLine size={12} strokeWidth={2.6} aria-hidden />
                  Bukti kerja
                </span>
                <h3 className="mt-4 text-[22px] font-bold leading-snug tracking-[-0.03em] text-sk-navy md:text-[25px]">
                  Hasil project-mu bisa masuk LinkedIn.
                </h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-sk-muted">
                  Setelah menyelesaikan project di Arena, kamu punya hasil kerja nyata
                  untuk ditunjukkan ke perekrut. Kamu bisa tambahkan sendiri ke bagian Projects di LinkedIn:
                  tulis judul dan deskripsinya, pilih skill yang dipakai, lalu sertakan media hasil kerjamu.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-sk-faint">
                  Arena tidak mengunggah otomatis ke LinkedIn. Gambar di samping adalah
                  ilustrasi cara mengisi project—bukan screenshot LinkedIn atau profil peserta.
                </p>
              </Card>
            </Reveal>

            <Reveal className="h-full" {...APPEAR}>
              <PortfolioProofVisual className="h-full" />
            </Reveal>
          </div>

          {(points || rewardPicks.length > 0) && (
            <Reveal className="mt-6" {...APPEAR}>
              <Card className="overflow-hidden">
                <div className="grid gap-px bg-sk-border md:grid-cols-2">
                  {points && (
                    <div className="bg-white p-7 md:p-9">
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sk-warning-tint bg-sk-warning-tint px-3 py-1 text-[11.5px] font-bold text-sk-warning-ink">
                        <Sparkles size={12} strokeWidth={2.6} aria-hidden />
                        Poin Arena
                      </span>
                      <h3 className="mt-4 text-[20px] font-bold tracking-[-0.03em] text-sk-navy">
                        Poin yang berlaku minggu ini.
                      </h3>
                      {home && (
                        <p className="mt-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sk-faint">
                          {home.weekLabel}
                        </p>
                      )}
                      <dl className="mt-5 grid grid-cols-2 gap-2.5">
                        {[
                          ['Selesai dinilai', points.completion],
                          ['Peringkat 1', points.rank1],
                          ['Peringkat 2', points.rank2],
                          ['Peringkat 3', points.rank3],
                        ].map(([label, value]) => (
                          <div
                            key={label as string}
                            className="rounded-[var(--radius-sk-md)] border border-sk-border bg-sk-bg px-4 py-3"
                          >
                            <dt className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
                              {label as string}
                            </dt>
                            <dd className="mt-1.5 font-mono text-[20px] font-bold leading-none tracking-[-0.03em] text-sk-navy">
                              +{value as number}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {rewardPicks.length > 0 && (
                    <div className="bg-white p-7 md:p-9">
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sk-blue-tint-border bg-sk-blue-tint px-3 py-1 text-[11.5px] font-bold text-sk-blue-700">
                        <Gift size={12} strokeWidth={2.6} aria-hidden />
                        Katalog hadiah
                      </span>
                      <h3 className="mt-4 text-[20px] font-bold tracking-[-0.03em] text-sk-navy">
                        Poinnya bisa ditukar.
                      </h3>
                      <ul className="mt-5 flex flex-col gap-2.5">
                        {rewardPicks.map((item) => (
                          <li
                            key={item.slug}
                            className="flex items-center gap-3 rounded-[var(--radius-sk-md)] border border-sk-border bg-sk-bg px-4 py-3"
                          >
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-sk-body">
                              {item.title}
                            </span>
                            <span className="flex-none font-mono text-[12px] font-bold text-sk-warning-ink">
                              {item.pointsCost} poin
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            </Reveal>
          )}
        </section>

        {/* ─── FAQ ───────────────────────────────────────────────────────
            Unchanged. Native <details>, no JavaScript, same six answers. */}
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

          <Reveal className="mx-auto mt-8 max-w-[820px]" {...APPEAR}>
            <div className="glass-nav relative overflow-hidden rounded-[var(--radius-sk-2xl)] px-6 py-6 md:px-8">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-28 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.18),transparent_65%)]"
              />
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-md">
                  <h3 className="text-[18px] font-extrabold tracking-[-0.025em] text-sk-navy md:text-[20px]">
                    {isOpen ? 'Sprint minggu ini masih terbuka.' : 'Siapkan langkahmu untuk sprint berikutnya.'}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-sk-muted">
                    Masih ada yang mau ditanya?{' '}
                    <a href="#kontak" className="font-semibold text-sk-blue hover:underline">
                      Hubungi kami
                    </a>
                    .
                  </p>
                </div>
                <ButtonLink
                  href={entryHref}
                  size="lg"
                  className="rounded-full"
                  iconRight={<ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />}
                >
                  {ARENA_ENTRY_LABEL}
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  );
}
