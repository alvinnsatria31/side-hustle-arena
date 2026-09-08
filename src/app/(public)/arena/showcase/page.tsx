import Link from 'next/link';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Entrance, Reveal, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { SkillChip } from '@/components/primitives/SkillChip';
import { Trophy } from 'lucide-react';
import { getLatestSpotlightWithConsent, listSpotlightHistory } from '@/server/finalization/showcase-service';
import { isoWeekNumber, monthDayLabel } from '@/lib/arena-view';

export const metadata = { title: 'Weekly Spotlight' };
export const dynamic = 'force-dynamic';

function weekLabel(opensAt: Date) {
  return `Minggu ${isoWeekNumber(opensAt)} · ${monthDayLabel(opensAt)}`;
}

function scoreBand(score: number) {
  return score >= 86 ? 'EXCELLENT' : score >= 70 ? 'STRONG WORK' : 'SOLID';
}

export default async function ShowcasePage() {
  const [{ entries: spotlight, withheld }, history] = await Promise.all([getLatestSpotlightWithConsent(), listSpotlightHistory()]);
  const featured = spotlight[0];
  const others = spotlight.slice(1);

  return (
    <div className="relative overflow-hidden bg-sk-bg">
      <div className="ambient" aria-hidden />

      <div className="relative z-[2] mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
        <Breadcrumb items={[{ label: 'Arena', href: '/arena' }, { label: 'Weekly Spotlight' }]} />

        <div className="mb-10 mt-7 max-w-[640px]">
          <Entrance>
            <span className="eyebrow">Weekly Spotlight</span>
          </Entrance>
          <Entrance delay={0.1}>
            <h1 className="mb-3 mt-3 text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] text-sk-navy sm:text-[44px]">
              Project terbaik <span className="text-sk-blue">minggu ini</span>.
            </h1>
          </Entrance>
          <Entrance delay={0.2}>
            <p className="text-[14.5px] leading-relaxed text-sk-muted">
              Setiap minggu ditutup dan dinilai, lalu peringkatnya dikunci. Yang tampil di sini adalah hasil final —
              bukan pilihan redaksi, bukan hadiah keberuntungan.
            </p>
          </Entrance>
        </div>

        {!featured ? (
          <Reveal y={16}>
            <Card className="p-10 text-center">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy">
                {withheld > 0 ? 'Belum ada peserta yang mengizinkan karyanya tampil.' : 'Belum ada minggu yang difinalisasi.'}
              </h2>
              {/* An empty Showcase has two very different causes, and saying
                  which one it is matters: "nobody has finished yet" and
                  "everyone declined to be featured" call for opposite actions. */}
              <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-sk-muted">
                {withheld > 0
                  ? `Minggu terakhir sudah difinalisasi, tetapi ${withheld} peserta berperingkat teratas belum mengizinkan karyanya ditampilkan publik. Showcase hanya menampilkan peserta yang menyetujuinya lewat halaman profil.`
                  : 'Spotlight terbit setelah satu minggu ditutup dan seluruh review-nya selesai. Minggu pertama yang selesai akan muncul di sini dengan sendirinya.'}
              </p>
              <ButtonLink href="/arena/projects" size="lg" className="mt-6">
                Lihat Project Minggu Ini
              </ButtonLink>
            </Card>
          </Reveal>
        ) : (
          <>
            <Reveal y={16}>
              <Link href={`/arena/showcase/${featured.slug}`} className="group block">
                <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#0B1933] via-[#1a2f5a] to-sk-blue p-8 text-white transition-shadow duration-300 group-hover:shadow-sk-lg sm:p-10">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-24 -top-40 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_70%)]"
                  />
                  <div className="relative z-[1] grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
                    <div>
                      <span className="eyebrow eyebrow-dark">
                        <Trophy size={12} className="mr-1.5 inline" aria-hidden />
                        Peringkat 1 · {weekLabel(featured.weekOpensAt)}
                      </span>
                      <h2 className="mb-2.5 mt-3 text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[34px]">
                        {featured.projectTitle}
                      </h2>
                      {featured.projectShortDescription && (
                        <p className="mb-5 max-w-[480px] text-[13.5px] leading-relaxed text-white/85">
                          {featured.projectShortDescription}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="dark">{featured.participantName}</Badge>
                        <Badge variant="dark">{featured.divisionName}</Badge>
                        {featured.skillsProven.slice(0, 3).map((skill) => (
                          <span key={skill} className="rounded-full border border-white/35 px-2 py-0.5 text-[10.5px]">
                            {skill}
                          </span>
                        ))}
                      </div>
                      <span className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-white">
                        Lihat detail hasil
                      </span>
                    </div>
                    <div className="rounded-[var(--radius-sk-2xl)] border border-white/15 bg-white/10 p-6 text-center backdrop-blur-md">
                      <div className="font-mono text-[10px] tracking-[0.15em] text-white/65">FINAL SCORE</div>
                      <div className="my-1.5 text-[64px] font-extrabold leading-none tracking-[-0.04em]">
                        <CountUp to={featured.finalScore} />
                      </div>
                      <div className="font-mono text-[11px] text-[#5ae0a0]">{scoreBand(featured.finalScore)}</div>
                      <div className="mt-3 border-t border-white/15 pt-3 font-mono text-[10.5px] text-white/70">
                        +{featured.pointsAwarded} poin
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </Reveal>

            {others.length > 0 && (
              <>
                <Reveal className="mb-6 mt-14" y={16}>
                  <h3 className="text-[22px] font-extrabold tracking-[-0.02em] text-sk-navy">Peringkat berikutnya</h3>
                  <p className="mt-1.5 text-[13.5px] text-sk-muted">Dari minggu yang sama, urut berdasarkan skor final.</p>
                </Reveal>

                <StaggerGroup className="grid gap-4 md:grid-cols-3">
                  {others.map((entry) => (
                    <StaggerItem key={entry.slug}>
                      <Link href={`/arena/showcase/${entry.slug}`} className="group block h-full">
                        <Card className="flex h-full flex-col p-6 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-sk-blue/40 group-hover:shadow-sk-md">
                          <div className="mb-3 flex items-center justify-between">
                            <Badge variant="slate">{entry.divisionName}</Badge>
                            <span className="font-mono text-[18px] font-extrabold text-sk-blue">{entry.finalScore}</span>
                          </div>
                          <h4 className="mb-1.5 text-[16px] font-bold leading-snug tracking-[-0.01em] text-sk-navy">
                            {entry.projectTitle}
                          </h4>
                          {entry.projectShortDescription && (
                            <p className="mb-4 line-clamp-2 text-[12.5px] leading-relaxed text-sk-muted">
                              {entry.projectShortDescription}
                            </p>
                          )}
                          <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-dashed border-sk-border pt-3.5">
                            <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-sk-muted">
                              #{entry.rank} · {entry.participantName}
                            </span>
                          </div>
                          {entry.skillsProven.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {entry.skillsProven.map((skill) => (
                                <SkillChip key={skill}>{skill}</SkillChip>
                              ))}
                            </div>
                          )}
                        </Card>
                      </Link>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </>
            )}
          </>
        )}

        {history.length > 0 && (
          <Reveal className="mt-14" y={16}>
            <Card className="p-7">
              <h3 className="mb-4 font-mono text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sk-muted">
                Riwayat Mingguan
              </h3>
              <ul className="divide-y divide-dashed divide-sk-border">
                {history.map((row) => (
                  <li key={row.weekCode} className="grid grid-cols-[80px_1fr_auto] items-center gap-4 py-3.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-sk-muted">
                      Minggu {isoWeekNumber(row.opensAt)}
                    </span>
                    <Link
                      href={`/arena/showcase/${row.slug}`}
                      className="text-[13.5px] font-semibold text-sk-navy transition-colors hover:text-sk-blue"
                    >
                      {row.winnerProject} · <span className="font-normal text-sk-muted">{row.winnerName}</span>
                    </Link>
                    <span className="font-mono text-[13px] font-bold text-sk-blue">{row.finalScore}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        )}

        <Reveal className="mt-14" y={16}>
          <div className="glass-nav flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-sk-3xl)] p-8 md:px-12">
            <div className="max-w-md">
              <span className="eyebrow">Ikut Serta</span>
              <h3 className="mt-2 text-[20px] font-extrabold tracking-[-0.02em] text-sk-navy md:text-[24px]">
                Minggu depan, nama kamu yang ada di sini.
              </h3>
            </div>
            <ButtonLink href="/arena/projects" size="lg">
              Ikut Project Minggu Ini
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
