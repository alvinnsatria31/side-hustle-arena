import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Entrance, Reveal, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { SkillChip } from '@/components/primitives/SkillChip';
import { getLatestSpotlight, getSpotlightEntry, listSpotlightHistory } from '@/server/finalization/showcase-service';
import { isoWeekNumber, monthDayLabel } from '@/lib/arena-view';

export const dynamic = 'force-dynamic';

function weekLabel(opensAt: Date) {
  return `Minggu ${isoWeekNumber(opensAt)} · ${monthDayLabel(opensAt)}`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getSpotlightEntry(slug);
  return { title: entry ? `${entry.projectTitle} — Weekly Spotlight` : 'Showcase tidak ditemukan' };
}

export default async function ShowcaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await getSpotlightEntry(slug);
  if (!entry) notFound();

  const [latest, history] = await Promise.all([getLatestSpotlight(), listSpotlightHistory()]);
  const others = latest.filter((row) => row.slug !== slug).slice(0, 2);

  // The brief is the project's own public content; only the sections that were
  // actually written are rendered, so an empty field never becomes a blank panel.
  const brief = [
    { key: 'challenge', heading: 'Latar Kasus', pin: 'b' as const, body: entry.caseBackground },
    { key: 'role', heading: 'Peran', pin: 'g' as const, body: entry.roleDescription },
    { key: 'mission', heading: 'Misi', pin: 'b' as const, body: entry.mission },
    { key: 'objective', heading: 'Sasaran', pin: 'g' as const, body: entry.objective },
  ].filter((section) => section.body?.trim());

  return (
    <div className="mx-auto max-w-5xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb
        items={[
          { label: 'Arena', href: '/arena' },
          { label: 'Weekly Spotlight', href: '/arena/showcase' },
          { label: entry.projectTitle },
        ]}
      />

      <Entrance className="mt-6">
        <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-navy-2 via-[#1a2f5a] to-sk-blue-4 p-8 text-white sm:p-10">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.4),transparent_65%)]"
          />
          <div className="relative z-[1] flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[560px]">
              <span className="eyebrow eyebrow-dark">
                Peringkat {entry.rank} · {weekLabel(entry.weekOpensAt)}
              </span>
              <h1 className="mb-3 mt-3 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
                {entry.projectTitle}
              </h1>
              {entry.projectShortDescription && (
                <p className="text-[14px] leading-relaxed text-white/80">{entry.projectShortDescription}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="dark">{entry.divisionName}</Badge>
                {entry.skillsProven.map((skill) => (
                  <Badge key={skill} variant="dark">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="shrink-0 rounded-[var(--radius-sk-2xl)] border border-white/15 bg-white/10 p-6 text-center backdrop-blur-md">
              <div className="font-mono text-[10px] tracking-[0.15em] text-white/65">FINAL SCORE</div>
              <div className="my-1.5 text-[56px] font-extrabold leading-none tracking-[-0.04em]">
                <CountUp to={entry.finalScore} />
              </div>
              <div className="font-mono text-[11px] text-[#5ae0a0]">+{entry.pointsAwarded} poin</div>
              <div className="mt-3 border-t border-white/15 pt-3 text-[12.5px] text-white/80">
                oleh <b className="text-white">{entry.participantName}</b>
              </div>
            </div>
          </div>
        </div>
      </Entrance>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          {brief.map((section, index) => (
            <Reveal key={section.key} delay={index * 0.05}>
              <Card className="p-7">
                <PanelHeading pin={section.pin}>{section.heading}</PanelHeading>
                <p className="whitespace-pre-line text-[14.5px] leading-[1.7] text-sk-text">{section.body}</p>
              </Card>
            </Reveal>
          ))}

          <Reveal delay={0.15}>
            <Card className="p-7">
              <PanelHeading pin="g">Yang dipublikasikan</PanelHeading>
              <p className="text-[14px] leading-relaxed text-sk-body">
                Halaman ini menampilkan hasil final yang sudah dikunci: peringkat, skor, poin, dan skill yang terbukti.
                Berkas submission peserta tidak pernah dipublikasikan, dan catatan reviewer tetap milik peserta.
              </p>
              <ButtonLink href={`/arena/projects/${entry.projectSlug}`} variant="ghost" size="sm" className="mt-4">
                Lihat brief project-nya
              </ButtonLink>
            </Card>
          </Reveal>
        </div>

        <div className="flex flex-col gap-6">
          <Reveal delay={0.1}>
            <Card className="p-6">
              <PanelHeading pin="b">Hasil Akhir</PanelHeading>
              <dl className="flex flex-col gap-2.5 text-[13.5px]">
                <div className="flex items-center justify-between">
                  <dt className="text-sk-muted">Peringkat</dt>
                  <dd className="font-bold text-sk-navy">#{entry.rank}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sk-muted">Skor final</dt>
                  <dd className="font-bold tabular-nums text-sk-navy">{entry.finalScore}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sk-muted">Poin</dt>
                  <dd className="font-bold tabular-nums text-sk-navy">+{entry.pointsAwarded}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sk-muted">Divisi</dt>
                  <dd className="font-semibold text-sk-navy">{entry.divisionName}</dd>
                </div>
              </dl>
            </Card>
          </Reveal>

          {entry.skillsProven.length > 0 && (
            <Reveal delay={0.15}>
              <Card className="p-6">
                <PanelHeading pin="b">Skill yang Terbukti</PanelHeading>
                <div className="flex flex-wrap gap-1.5">
                  {entry.skillsProven.map((skill) => (
                    <SkillChip key={skill}>{skill}</SkillChip>
                  ))}
                </div>
              </Card>
            </Reveal>
          )}

          {others.length > 0 && (
            <Reveal delay={0.2}>
              <Card className="p-6">
                <PanelHeading>Peringkat lain minggu ini</PanelHeading>
                <ul className="flex flex-col gap-3">
                  {others.map((other) => (
                    <li key={other.slug}>
                      <Link
                        href={`/arena/showcase/${other.slug}`}
                        className="group flex items-center gap-3 rounded-xl border border-sk-border p-3 transition-all duration-200 hover:border-sk-blue/40 hover:shadow-sk-xs"
                      >
                        <span className="font-mono text-[16px] font-extrabold text-sk-blue">{other.finalScore}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-sk-navy">{other.projectTitle}</span>
                          <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-sk-muted">
                            #{other.rank} · {other.participantName}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          )}

          <Reveal delay={0.25}>
            <ButtonLink href="/arena/projects" size="lg" fullWidth>
              Lihat Project Minggu Ini
            </ButtonLink>
          </Reveal>
        </div>
      </div>

      {history.length > 0 && (
        <Reveal className="mt-12" y={16}>
          <Card className="p-7">
            <PanelHeading>Riwayat Mingguan</PanelHeading>
            <StaggerGroup className="divide-y divide-dashed divide-sk-border">
              {history.map((row) => (
                <StaggerItem key={row.weekCode}>
                  <div className="grid grid-cols-[70px_1fr_auto] items-center gap-4 py-3.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-sk-muted">
                      Minggu {isoWeekNumber(row.opensAt)}
                    </span>
                    <Link
                      href={`/arena/showcase/${row.slug}`}
                      className="text-[13.5px] font-semibold text-sk-navy transition-colors hover:text-sk-blue"
                    >
                      {row.winnerProject}
                    </Link>
                    <span className="text-right font-mono text-[11px] text-sk-muted">
                      {row.winnerName} · {row.finalScore}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
