'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, ScanLine } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { UploadPanel } from '@/components/cv-scanner/UploadPanel';
import { JobDescriptionPanel } from '@/components/cv-scanner/JobDescriptionPanel';
import { FileCard } from '@/components/ui/FileCard';
import { ProcessingChecklist, type ProcessingStep } from '@/components/ui/ProcessingChecklist';
import { useCVScanFlow } from '@/features/cv-scan/useCVScanFlow';
import { useEffect, useMemo } from 'react';

const steps: ProcessingStep[] = [
  { id: 's1', label: 'Membaca CV' },
  { id: 's2', label: 'Memahami struktur' },
  { id: 's3', label: 'Kompatibilitas ATS' },
  { id: 's4', label: 'Kekuatan pengalaman' },
  { id: 's5', label: 'Kecocokan keyword' },
  { id: 's6', label: 'Recruiter readiness' },
  { id: 's7', label: 'Menyiapkan rekomendasi' },
];

export default function InAppScannerPage() {
  const router = useRouter();
  const flow = useCVScanFlow();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (flow.stage !== 'processing') return;
    setCurrentStep(0);
    setProgress(0);
    const start = Date.now();
    const total = 3800;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / total);
      setProgress(Math.round(t * 100));
      setCurrentStep(Math.min(steps.length, Math.floor(t * steps.length)));
      if (t >= 1) {
        clearInterval(id);
        setTimeout(() => {
          flow.finishAnalysis();
          router.push('/cv-scanner/result');
        }, 300);
      }
    }, 80);
    return () => clearInterval(id);
  }, [flow.stage, flow, router]);

  const handleStart = () => {
    flow.startAnalysis();
  };

  return (
    <div className="mx-auto max-w-[820px] px-5 lg:px-8 py-8 lg:py-10">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
          <ScanLine className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-[30px] sm:text-[36px] font-bold text-[var(--color-ink-primary)] tracking-[-0.02em]">
          Scan CV kamu
        </h1>
        <p className="mt-2 text-[14.5px] text-[var(--color-ink-secondary)]">
          Unggah CV dan dapatkan analisis struktur, keterbacaan, keyword, dan kesiapan recruiter.
        </p>
      </div>

      {flow.stage === 'idle' || flow.stage === 'done' ? (
        <div className="mt-8 anim-fade-up">
          {flow.file ? (
            <FileCard
              name={flow.file.name}
              sizeBytes={flow.file.size}
              pages={flow.file.pages}
              onReplace={() => flow.setMockFile({ name: 'CV_Riani_Product_Analyst.pdf', size: 2.1 * 1024 * 1024, pages: 2 })}
              onRemove={flow.clearFile}
            />
          ) : (
            <UploadPanel
              hasFile={!!flow.file}
              error={flow.error}
              onFileChosen={(name, size) => flow.setMockFile({ name, size, pages: 2 })}
            />
          )}

          <div className="mt-5">
            <JobDescriptionPanel value={flow.jobDescription} onChange={flow.setJobDescription} />
          </div>

          {flow.file && (
            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="lg" onClick={handleStart}>
                Mulai Analisis
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {flow.stage === 'processing' && (
        <Card padding="xl" className="mt-8 anim-fade-in">
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-600)]">
            Menganalisis CV
          </span>
          <h2 className="mt-3 text-[22px] font-bold text-[var(--color-ink-primary)] tracking-[-0.01em]">
            {flow.file?.name}
          </h2>
          <div className="mt-5">
            <div className="h-2 w-full rounded-full bg-[var(--color-brand-50)] overflow-hidden">
              <div className="h-full bg-[var(--color-brand-500)] transition-all duration-100" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--color-ink-tertiary)] tabular-nums">{progress}%</p>
          </div>
          <div className="mt-6">
            <ProcessingChecklist steps={steps} currentIndex={currentStep} />
          </div>
        </Card>
      )}
    </div>
  );
}
