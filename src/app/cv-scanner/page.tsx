'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ShieldCheck, Lock, Clock } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { UploadPanel } from '@/components/cv-scanner/UploadPanel';
import { JobDescriptionPanel } from '@/components/cv-scanner/JobDescriptionPanel';
import { FileCard } from '@/components/ui/FileCard';
import { ProcessingChecklist, type ProcessingStep } from '@/components/ui/ProcessingChecklist';
import { useCVScanFlow } from '@/features/cv-scan/useCVScanFlow';

const steps: ProcessingStep[] = [
  { id: 's1', label: 'Membaca CV' },
  { id: 's2', label: 'Memahami struktur' },
  { id: 's3', label: 'Kompatibilitas ATS' },
  { id: 's4', label: 'Kekuatan pengalaman' },
  { id: 's5', label: 'Kecocokan keyword' },
  { id: 's6', label: 'Recruiter readiness' },
  { id: 's7', label: 'Menyiapkan rekomendasi' },
];

const tips: Record<string, { title: string; body: string }> = {
  s1: {
    title: 'CV recruiter-friendly',
    body: 'Format yang konsisten dan heading standar (Experience, Education, Skills) jauh lebih mudah dibaca ATS.',
  },
  s2: {
    title: 'Struktur yang jelas',
    body: 'Pengalaman dalam urutan kronologis dan bullet yang ringkas membuat CV mudah di-scan dalam 6–8 detik.',
  },
  s3: {
    title: 'Kompatibilitas ATS',
    body: 'Hindari header/footer, tabel, dan kolom. Pakai plain formatting agar teks bisa di-parse dengan benar.',
  },
  s4: {
    title: 'Pengalaman yang berdampak',
    body: 'Bullet outcome-driven (action + angka + konteks) 3x lebih menarik dibanding bullet task-oriented.',
  },
  s5: {
    title: 'Kecocokan keyword',
    body: 'Sekitar 75% CV disaring ATS berdasarkan keyword. Tambahkan skill spesifik dari Job Description.',
  },
  s6: {
    title: 'Recruiter readiness',
    body: 'Ringkasan profesional di atas, kontak jelas, dan link portfolio yang aktif adalah sinyal kuat.',
  },
  s7: {
    title: 'Rekomendasi personal',
    body: 'Setelah analisis selesai, kamu akan dapat 3 prioritas utama yang paling berdampak untuk CV kamu.',
  },
};

export default function CVScannerPage() {
  const router = useRouter();
  const {
    file,
    setMockFile,
    clearFile,
    jobDescription,
    setJobDescription,
    stage,
    error,
    startAnalysis,
    finishAnalysis,
  } = useCVScanFlow();

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Drive the processing animation
  useEffect(() => {
    if (stage !== 'processing') return;
    setCurrentStep(0);
    setProgress(0);

    const start = Date.now();
    const totalDuration = 4200; // 4.2s

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / totalDuration);
      setProgress(Math.round(t * 100));
      const step = Math.min(steps.length, Math.floor(t * steps.length) + (t < 1 ? 0 : 1));
      setCurrentStep(step);
      if (t >= 1) {
        clearInterval(interval);
        // small delay to let final state settle
        setTimeout(() => {
          finishAnalysis();
          router.push('/cv-scanner/result');
        }, 350);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [stage, finishAnalysis, router]);

  const currentTip = useMemo(() => {
    const key = currentStep > 0 && currentStep <= steps.length ? steps[currentStep - 1]?.id : 's1';
    return tips[key] ?? tips.s1;
  }, [currentStep]);

  const handleStart = () => {
    const ok = startAnalysis();
    if (!ok) return;
  };

  return (
    <div className="bg-[var(--color-surface-base)]">
      {/* Breadcrumb */}
      <div className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-8 h-12 flex items-center gap-2 text-[12.5px] text-[var(--color-ink-tertiary)]">
          <Link href="/" className="hover:text-[var(--color-ink-primary)]">
            <BrandLogo size="sm" />
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Career Tools</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[var(--color-ink-primary)] font-semibold">CV ATS Scanner</span>
        </div>
      </div>

      <div className="mx-auto max-w-[920px] px-5 lg:px-8 py-12 lg:py-16">
        {stage === 'idle' || stage === 'done' ? (
          <div className="anim-fade-up">
            {/* Hero */}
            <div className="text-center max-w-2xl mx-auto">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-600)]">
                Career Tools · ATS Scanner
              </span>
              <h1 className="mt-4 text-[36px] sm:text-[44px] lg:text-[52px] leading-[1.05] font-bold tracking-[-0.03em] text-[var(--color-ink-primary)]">
                Cek CV kamu lolos ATS atau tidak.
              </h1>
              <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-ink-secondary)]">
                Unggah CV dan dapatkan analisis struktur, keterbacaan, keyword, dan kesiapan recruiter dalam
                beberapa detik.
              </p>
            </div>

            {/* Upload */}
            <div className="mt-10">
              {file ? (
                <FileCard
                  name={file.name}
                  sizeBytes={file.size}
                  pages={file.pages}
                  onReplace={() => {
                    // simulate re-pick by generating a new mock name
                    setMockFile({
                      name: 'CV_Riani_Product_Analyst.pdf',
                      size: 2.1 * 1024 * 1024,
                      pages: 2,
                    });
                  }}
                  onRemove={clearFile}
                />
              ) : (
                <UploadPanel
                  hasFile={!!file}
                  error={error}
                  onFileChosen={(name, size) => {
                    // Convert to a 2-page mock; ignore real size for the mock display
                    const pages = name.toLowerCase().includes('cv') ? 2 : 2;
                    setMockFile({ name, size, pages });
                  }}
                />
              )}
            </div>

            {/* Job Description */}
            <div className="mt-5">
              <JobDescriptionPanel value={jobDescription} onChange={setJobDescription} />
            </div>

            {/* CTA */}
            {file && (
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <p className="text-[12.5px] text-[var(--color-ink-tertiary)]">
                  Hasil analisis mencakup skor, rekomendasi, dan contoh perbaikan.
                </p>
                <Button variant="primary" size="lg" onClick={handleStart}>
                  Mulai Analisis
                </Button>
              </div>
            )}

            {/* Trust footer */}
            <div className="mt-10 grid gap-3 sm:grid-cols-3 text-[12.5px] text-[var(--color-ink-tertiary)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />
                Gratis, tanpa login
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[var(--color-success)]" />
                File tidak dibagikan
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-success)]" />
                Hasil keluar dalam hitungan detik
              </div>
            </div>
          </div>
        ) : null}

        {stage === 'processing' && (
          <div className="anim-fade-in max-w-3xl mx-auto">
            <Card padding="xl" className="overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-[var(--color-brand-500)] anim-pulse-ring" />
                <span className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-600)]">
                  Sedang Menganalisis
                </span>
              </div>
              <h2 className="mt-4 text-[26px] sm:text-[30px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em]">
                Menganalisis CV kamu
              </h2>
              <p className="mt-2 text-[14px] text-[var(--color-ink-tertiary)]">
                {file?.name} · {file?.pages ?? 2} halaman
              </p>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-[12px] text-[var(--color-ink-tertiary)] mb-2">
                  <span>Progress</span>
                  <span className="font-semibold text-[var(--color-ink-primary)] tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--color-brand-50)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-brand-500)] transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
                <ProcessingChecklist steps={steps} currentIndex={currentStep} />

                <div className="rounded-[var(--radius-md)] border border-[var(--color-brand-100)] bg-[var(--color-brand-50)] p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
                    Tahukah kamu
                  </span>
                  <h4 className="mt-3 text-[15px] font-semibold text-[var(--color-ink-primary)]">
                    {currentTip.title}
                  </h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-secondary)]">
                    {currentTip.body}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
