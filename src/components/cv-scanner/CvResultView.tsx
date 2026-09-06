'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Check, TriangleAlert } from 'lucide-react';
import { Breadcrumb } from '@/components/primitives/Breadcrumb';
import { Badge } from '@/components/primitives/Badge';
import { Card, PanelHeading } from '@/components/primitives/Card';
import { CountUp } from '@/components/motion/CountUp';
import { Entrance, StaggerGroup, StaggerItem } from '@/components/motion/Reveal';
import { ProgressBar } from '@/components/primitives/ProgressBar';
import { Tabs } from '@/components/primitives/Tabs';
import { StateBox } from '@/components/primitives/StateBox';
import { EvidenceRow } from '@/components/arena/EvidenceRow';
import { RecommendedCard } from '@/components/arena/RecommendedCard';
import { useDemo } from '@/features/demo/store';
import { isCvScannerEnabled } from '@/lib/cv-scan-limits';
import { CvScannerClosed } from './CvScannerClosed';
import { RECOMMENDED_PROJECT_SLUG, getProject } from '@/data/mock/projects';
import { cn } from '@/lib/cn';

const formatDateID = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

function CheckRow({ item }: { item: { label: string; pass: boolean; note: string } }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md',
          item.pass ? 'bg-sk-success-tint text-sk-success' : 'bg-sk-warning-wash text-sk-warning-ink',
        )}
      >
        {item.pass ? <Check size={12} strokeWidth={3} /> : <TriangleAlert size={11} strokeWidth={2.4} />}
      </span>
      <div>
        <div className="text-[14px] font-semibold text-sk-navy">{item.label}</div>
        <div className="text-[12.5px] leading-relaxed text-sk-muted">{item.note}</div>
      </div>
    </li>
  );
}

function ImpactExample({ example, index }: { example: { before: string; after: string }; index: number }) {
  return (
    <StaggerItem className="rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-5">
      <div className="mb-2 font-mono text-[10px] tracking-[0.12em] text-sk-muted">CONTOH {index + 1} · SEBELUM</div>
      <p className="mb-3 text-[13px] leading-relaxed text-sk-muted line-through decoration-sk-error/50">{example.before}</p>
      <div className="mb-2 font-mono text-[10px] tracking-[0.12em] text-sk-success">SESUDAH</div>
      <p className="text-[13.5px] font-medium leading-relaxed text-sk-navy">{example.after}</p>
    </StaggerItem>
  );
}

export function CvResultView({ basePath, hrefPrefix = "/arena/projects" }: { basePath: string; hrefPrefix?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { state } = useDemo();
  const [activeTab, setActiveTab] = useState('overview');
  const project = getProject(RECOMMENDED_PROJECT_SLUG)!;

  // Direct visits without a completed demo scan get a calm recovery state.
  useEffect(() => {
    if (state.cvScan.status === 'file_selected' || state.cvScan.status === 'analyzing') {
      router.replace(`${basePath}/analyzing`);
    }
  }, [state.cvScan.status, router]);

  // After every hook: an early return above them would change hook order
  // between renders the moment the flag flips.
  if (!isCvScannerEnabled()) return <CvScannerClosed />;

  // Both conditions matter: a state persisted before the scanner had a backend
  // can be 'completed' with no analysis attached.
  if (state.cvScan.status !== 'completed' || !state.cvScan.result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sk-bg px-6 pb-24 pt-24">
        <StateBox
          tone="empty"
          title="Belum ada hasil analisis."
          description="Upload CV kamu dulu — analisis cuma butuh 20–30 detik dan hasilnya langsung bisa dijelajahi."
          primaryAction={{ label: 'Scan CV Sekarang', href: basePath }}
        />
      </div>
    );
  }

  // Everything below renders the analysis returned by /api/cv-scan. The guard
  // above means a missing result has already sent the visitor back to upload,
  // so nothing here falls back to sample data.
  const result = state.cvScan.result;
  const analyzedAt = result.analyzedAt ?? state.cvScan.completedAt ?? new Date().toISOString();
  const fileName = result.fileName;

  const tabItems = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid gap-5 md:grid-cols-2">
          <Card className="p-6">
            <PanelHeading pin="g">Yang sudah kuat</PanelHeading>
            <ul className="flex flex-col gap-3">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-sk-text">
                  <span aria-hidden className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-sk-success-tint text-sk-success">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <PanelHeading pin="a">Yang perlu diperkuat</PanelHeading>
            <ul className="flex flex-col gap-3">
              {result.improvements.map((s, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-sk-text">
                  <span aria-hidden className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-sk-warning-wash text-sk-warning-ink">
                    <TriangleAlert size={11} strokeWidth={2.4} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ),
    },
    {
      id: 'quality',
      label: 'CV Quality',
      content: (
        <Card className="p-6">
          <PanelHeading pin="b">Pemeriksaan kualitas CV</PanelHeading>
          <ul className="divide-y divide-dashed divide-sk-border">
            {result.qualityChecks.map((item) => (
              <CheckRow key={item.label} item={item} />
            ))}
          </ul>
        </Card>
      ),
    },
    {
      id: 'ats',
      label: 'ATS',
      content: (
        <Card className="p-6">
          <PanelHeading pin="b">Kesiapan ATS (Applicant Tracking System)</PanelHeading>
          <ul className="divide-y divide-dashed divide-sk-border">
            {result.atsChecks.map((item) => (
              <CheckRow key={item.label} item={item} />
            ))}
          </ul>
        </Card>
      ),
    },
    {
      id: 'impact',
      label: 'Impact',
      content: (
        <div>
          {result.impactExamples.length === 0 ? (
            <p role="status" className="max-w-[640px] text-[13.5px] leading-relaxed text-sk-muted">
              Pencapaian di CV kamu sudah terukur — tidak ada baris yang perlu ditulis ulang.
            </p>
          ) : (
            <>
              <p className="mb-5 max-w-[640px] text-[13.5px] leading-relaxed text-sk-muted">
                Baris di bawah diambil dari CV kamu sendiri, lalu ditulis ulang dengan angka yang sudah ada di dokumenmu —
                supaya pencapaiannya terbaca nyata oleh recruiter.
              </p>
              <StaggerGroup className="grid gap-4 lg:grid-cols-3">
                {result.impactExamples.map((example, i) => (
                  <ImpactExample key={i} example={example} index={i} />
                ))}
              </StaggerGroup>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'evidence',
      label: 'Career Evidence',
      content: (
        <Card className="p-6">
          <PanelHeading pin="a">Bukti skill di CV kamu</PanelHeading>
          <div className="divide-y divide-dashed divide-sk-border">
            {result.evidence.map((row) => (
              <EvidenceRow key={row.skill} skill={row.skill} level={row.level} note={row.note} />
            ))}
          </div>
          <p className="mt-5 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12.5px] leading-relaxed text-sk-body">
            Career Evidence diukur dari project nyata yang bisa ditunjukkan — bukan sekadar skill yang ditulis di CV. Cara
            tercepat menaikkannya: kerjakan satu project di Side Hustle Arena.
          </p>
        </Card>
      ),
    },
  ];

  return (
    <div className="relative min-h-screen bg-sk-bg">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-28 md:pt-32">
        <Breadcrumb
          items={[
            { label: 'SekolahKarir', href: '/' },
            { label: 'CV Scanner', href: basePath },
            { label: 'Hasil Analisis' },
          ]}
        />

        {/* Header + score hero */}
        <div className="mb-8 mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[640px]">
            <Entrance>
              <span className="eyebrow">Hasil CV Scanner</span>
            </Entrance>
            <Entrance delay={0.1}>
              <h1 className="mb-2 mt-2.5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em] text-sk-navy sm:text-[38px]">
                CV kamu punya <span className="text-sk-blue">fondasi yang baik</span>. Tapi masih ada yang perlu diperkuat.
              </h1>
            </Entrance>
            <Entrance delay={0.2}>
              <p className="font-mono text-[12px] tracking-[0.05em] text-sk-muted">
                Dianalisis {formatDateID(analyzedAt)} · {fileName}
              </p>
            </Entrance>
          </div>

          <Entrance delay={0.15} className="w-full max-w-[320px] shrink-0 self-start">
            <div className="relative overflow-hidden rounded-[var(--radius-sk-3xl)] bg-gradient-to-br from-[#0B1933] to-[#1a2f5a] p-6 text-white sm:p-7">
              <div className="ambient opacity-50" aria-hidden />
              <div className="relative z-[1]">
                <div className="font-mono text-[10px] tracking-[0.15em] text-white/65">CV SCORE</div>
                <div className="my-2 text-[72px] font-extrabold leading-none tracking-[-0.04em]">
                  <CountUp to={result.score} />
                  <small className="text-[22px] font-semibold text-white/55">/100</small>
                </div>
                <span className="inline-block rounded-full bg-sk-success/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#5ae0a0]">
                  {result.statusLabel}
                </span>
              </div>
            </div>
          </Entrance>
        </div>

        {/* Metrics */}
        <StaggerGroup className="mb-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {result.metrics.map((metric) => (
            <StaggerItem
              key={metric.key}
              className={cn(
                'relative rounded-[var(--radius-sk-lg)] border p-5',
                metric.weak
                  ? 'border-sk-error-border bg-gradient-to-b from-sk-error-wash to-white'
                  : 'border-sk-border bg-white',
              )}
            >
              {metric.weak && (
                <span className="absolute right-4 top-4">
                  <Badge variant="amber">Perlu perhatian</Badge>
                </span>
              )}
              <div className="font-mono text-[10px] tracking-[0.1em] text-sk-muted">{metric.label.toUpperCase()}</div>
              <div
                className={cn(
                  'my-2.5 text-[36px] font-extrabold leading-none tracking-[-0.03em]',
                  metric.weak && 'text-[#c8442a]',
                )}
              >
                <CountUp to={metric.score} />
              </div>
              <ProgressBar
                value={metric.score}
                delay={0.3}
                barClassName={metric.weak ? 'bg-gradient-to-r from-[#e46b52] to-[#f79178]' : undefined}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>

        {/* Tabs */}
        <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.3, ease: 'easeOut' }}>
          <Tabs items={tabItems} activeId={activeTab} onChange={setActiveTab} className="mb-9" scrollable />
        </motion.div>

        {/* Recommendation bridge — CV Scanner never dead-ends */}
        <RecommendedCard project={project} delay={0.1} hrefPrefix={hrefPrefix} />
      </div>
    </div>
  );
}
