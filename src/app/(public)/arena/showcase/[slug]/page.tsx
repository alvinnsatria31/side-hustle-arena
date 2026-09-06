import { notFound } from 'next/navigation';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Badge } from '@/components/primitives/Badge';
import { ButtonLink } from '@/components/primitives/Button';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { Entrance, Reveal, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import { SkillChip } from '@/components/primitives/SkillChip';
import { getSpotlight, mockSpotlight, WEEK_HISTORY } from '@/data/mock/showcase';
import Link from 'next/link';
import { Check } from 'lucide-react';

export function generateStaticParams() {
  return mockSpotlight.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getSpotlight(slug);
  return { title: entry ? `${entry.projectTitle} — Weekly Spotlight` : 'Showcase tidak ditemukan' };
}

export default async function ShowcaseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getSpotlight(slug);
  if (!entry) notFound();

  const others = mockSpotlight.filter((s) => s.slug !== slug).slice(0, 2);

  return (
    <div className="mx-auto max-w-5xl px-6 pb-24 pt-28 md:pt-32">
      <Breadcrumb
        items={[
          { label: 'Arena', href: '/arena' },
          { label: 'Weekly Spotlight', href: '/arena/showcase' },
          { label: entry.projectTitle },
        ]}
      />

      {/* Hero */}
      <Entrance className="mt-6">
        <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-sk-navy-2 via-[#1a2f5a] to-sk-blue-4 p-8 text-white sm:p-10">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.4),transparent_65%)]"
          />
          <div className="relative z-[1] flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[560px]">
              <span className="eyebrow eyebrow-dark">Weekly Spotlight · {entry.weekLabel}</span>
              <h1 className="mb-3 mt-3 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
                {entry.projectTitle}
              </h1>
              <p className="text-[14px] leading-relaxed text-white/80">{entry.reason}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge variant="dark">{entry.role}</Badge>
                {entry.skillsProven.map((s) => (
                  <Badge key={s} variant="dark">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="shrink-0 rounded-[var(--radius-sk-2xl)] border border-white/15 bg-white/10 p-6 text-center backdrop-blur-md">
              <div className="font-mono text-[10px] tracking-[0.15em] text-white/65">REVIEW SCORE</div>
              <div className="my-1.5 text-[56px] font-extrabold leading-none tracking-[-0.04em]">
                <CountUp to={entry.score} />
              </div>
              <div className="font-mono text-[11px] text-[#5ae0a0]">
                {entry.score >= 86 ? 'EXCELLENT' : 'STRONG WORK'}
              </div>
              <div className="mt-3 border-t border-white/15 pt-3 text-[12.5px] text-white/80">
                oleh <b className="text-white">{entry.participant}</b>
              </div>
            </div>
          </div>
        </div>
      </Entrance>

      {/* Case study body */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-6">
          <Reveal>
            <Card className="p-7">
              <PanelHeading pin="b">Challenge</PanelHeading>
              <p className="text-[14.5px] leading-[1.7] text-sk-text">{entry.challenge}</p>
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card className="p-7">
              <PanelHeading pin="b">Process</PanelHeading>
              <ol className="flex flex-col gap-4">
                {entry.process.map((step, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sk-blue-tint font-mono text-[11px] font-bold text-sk-blue">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-[14px] leading-relaxed text-sk-text">{step}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="p-7">
              <PanelHeading pin="g">Deliverables</PanelHeading>
              <ul className="flex flex-col gap-2.5">
                {entry.deliverables.map((d) => (
                  <li key={d} className="flex items-center gap-2.5 text-[14px] text-sk-text">
                    <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-sk-success-tint text-sk-success">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          {/* Output preview mock */}
          <Reveal delay={0.15}>
            <Card className="overflow-hidden p-0">
              <div className="border-b border-sk-border bg-sk-bg px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-sk-muted">
                Output Preview
              </div>
              <div className="p-6">
                <div className="rounded-[var(--radius-sk-lg)] border border-sk-border bg-sk-bg p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-sk-navy">{entry.projectTitle}</span>
                    <Badge variant="blue">{entry.role}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[86, 74, 92].map((w, i) => (
                      <div key={i} className="rounded-lg border border-sk-border bg-white p-3">
                        <div className="mb-2 h-1.5 w-full rounded-full bg-sk-track" aria-hidden>
                          <div className="h-full rounded-full bg-gradient-to-r from-sk-blue to-sk-blue-400" style={{ width: `${w}%` }} />
                        </div>
                        <div className="mb-1.5 h-2 w-3/4 rounded bg-sk-track" aria-hidden />
                        <div className="h-2 w-1/2 rounded bg-sk-track" aria-hidden />
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-sk-faint">
                    Mock preview — file asli submission tidak dipublikasikan untuk melindungi partisipan.
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>
        </div>

        {/* Side: feedback + skills + others */}
        <div className="flex flex-col gap-6">
          <Reveal delay={0.1}>
            <Card className="p-6">
              <PanelHeading pin="g">Feedback Reviewer</PanelHeading>
              <blockquote className="border-l-[3px] border-sk-blue pl-4 text-[13.5px] italic leading-relaxed text-sk-body">
                &ldquo;{entry.feedbackExcerpt}&rdquo;
              </blockquote>
            </Card>
          </Reveal>

          <Reveal delay={0.15}>
            <Card className="p-6">
              <PanelHeading pin="b">Skills Proven</PanelHeading>
              <div className="flex flex-wrap gap-1.5">
                {entry.skillsProven.map((s) => (
                  <SkillChip key={s}>{s}</SkillChip>
                ))}
              </div>
            </Card>
          </Reveal>

          {others.length > 0 && (
            <Reveal delay={0.2}>
              <Card className="p-6">
                <PanelHeading>Top project lainnya</PanelHeading>
                <ul className="flex flex-col gap-3">
                  {others.map((o) => (
                    <li key={o.slug}>
                      <Link
                        href={`/arena/showcase/${o.slug}`}
                        className="group flex items-center gap-3 rounded-xl border border-sk-border p-3 transition-all duration-200 hover:border-sk-blue/40 hover:shadow-sk-xs"
                      >
                        <span className="font-mono text-[16px] font-extrabold text-sk-blue">{o.score}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-sk-navy">{o.projectTitle}</span>
                          <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-sk-muted">
                            {o.participant} · {o.role}
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

      {/* Weekly history */}
      <Reveal className="mt-12" y={16}>
        <Card className="p-7">
          <PanelHeading>Riwayat Mingguan</PanelHeading>
          <StaggerGroup className="divide-y divide-dashed divide-sk-border">
            {WEEK_HISTORY.map((h) => (
              <StaggerItem key={h.week}>
                <div className="grid grid-cols-[70px_1fr_auto] items-center gap-4 py-3.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-sk-muted">{h.label}</span>
                  {h.slug ? (
                    <Link href={`/arena/showcase/${h.slug}`} className="text-[13.5px] font-semibold text-sk-navy transition-colors hover:text-sk-blue">
                      {h.winner}
                    </Link>
                  ) : (
                    <span className="text-[13.5px] font-semibold text-sk-navy">{h.winner}</span>
                  )}
                  <span className="text-right font-mono text-[11px] text-sk-muted">
                    {h.participant} · {h.score}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </Card>
      </Reveal>
    </div>
  );
}
