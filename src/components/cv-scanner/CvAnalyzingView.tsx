'use client';


import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Check, CircleDashed } from 'lucide-react';
import { StateBox } from '@/components/primitives/StateBox';
import { useDemo } from '@/features/demo/store';
import { isCvScannerEnabled } from '@/lib/cv-scan-limits';
import { CvScannerClosed } from './CvScannerClosed';
import { MOCK_ANALYZE_STEPS } from '@/data/mock/cv';
import { clearCvScan, pendingCvScan } from '@/lib/cv-scan-client';
import { cn } from '@/lib/cn';

const TOTAL_MS = 5_200; // ~3–6s approved window

const STEP_LABELS = ['MEMBACA DATA', 'MEMBACA PENGALAMAN', 'MEMERIKSA STRUKTUR', 'MENGANALISIS SKILL', 'MEMBANDINGKAN', 'MENYIAPKAN'];

/**
 * Simulated analysis: ring counts 0→100, checklist completes sequentially.
 * No terminal animation, no fake code. Auto-transitions to the result page.
 */
export function CvAnalyzingView({ basePath }: { basePath: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { state, dispatch } = useDemo();
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const startedRef = useRef(false);

  const activeStep = useMemo(() => {
    if (progress >= 100) return MOCK_ANALYZE_STEPS.length - 1;
    return Math.min(MOCK_ANALYZE_STEPS.length - 1, Math.floor((progress / 100) * MOCK_ANALYZE_STEPS.length));
  }, [progress]);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      if (state.cvScan.status === 'file_selected' || state.cvScan.status === 'analyzing') {
        dispatch({ type: 'CV_START' });
      }
    }
    if (state.cvScan.status === 'completed') {
      router.replace(`${basePath}/result`);
      return;
    }
    // A failed scan stays on this page so the error is readable. (Redirecting
    // on 'failed' flashed the error for a split second and bounced the visitor
    // back to upload before they could read why it failed.)
    if (state.cvScan.status === 'failed') {
      setFailed(true);
      return;
    }
    if (state.cvScan.status !== 'file_selected' && state.cvScan.status !== 'analyzing') {
      router.replace(basePath);
      return;
    }

    // QA affordance for the simulated-failure error state (?demo-fail=1).
    const demoFail = new URLSearchParams(window.location.search).get('demo-fail') === '1';
    const scan = pendingCvScan();
    // Reaching this route without a scan in flight means the page was reloaded
    // or opened directly: the File is gone, so the upload step has to happen again.
    if (!scan && !demoFail) {
      router.replace(basePath);
      return;
    }

    let cancelled = false;
    let raf = 0;
    // The ring tracks elapsed time only as far as CEILING; the last stretch
    // belongs to the response, so the bar never claims to be finished before
    // the analysis is.
    const CEILING = 92;
    const duration = reduce ? 1_200 : TOTAL_MS;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.2);
      setProgress(Math.round(eased * CEILING));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const settle = async () => {
      try {
        if (demoFail) throw new Error('Simulasi kegagalan analisis (demo-fail).');
        const result = await scan!;
        if (cancelled) return;
        setProgress(100);
        clearCvScan();
        dispatch({ type: 'CV_COMPLETE', result });
        router.replace(`${basePath}/result`);
      } catch (error) {
        if (cancelled) return;
        clearCvScan();
        setFailed(true);
        dispatch({
          type: 'CV_FAIL',
          message: error instanceof Error ? error.message : 'Analisis CV gagal. Coba lagi.',
        });
      }
    };
    void settle();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cvScan.status]);

  // After every hook: an early return above them would change hook order
  // between renders the moment the flag flips.
  if (!isCvScannerEnabled()) return <CvScannerClosed />;

  if (failed) {
    const reason = state.cvScan.error;
    return (
      <div className="flex min-h-screen items-center justify-center bg-sk-bg px-6 pb-28 pt-24">
        <StateBox
          tone="error"
          title="Analisis gagal diproses."
          description={
            <>
              {reason ?? 'Terjadi kendala saat memproses CV kamu.'} Kalau masih gagal, coba file lain atau format PDF.
            </>
          }
          primaryAction={{ label: 'Coba Lagi', href: basePath }}
          secondaryAction={{ label: 'Kembali ke Beranda', href: '/' }}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sk-bg to-[#EEF3FE]">
      <div className="ambient" aria-hidden />
      <div className="relative z-[2] mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 pb-20 pt-28">
        <div>
          <span className="eyebrow">Analyzing</span>
          <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.02em] text-sk-navy sm:text-[38px]">
            Menganalisis CV kamu…
          </h1>
        </div>

        <div className="mt-10 grid items-center gap-10 md:mt-14 md:grid-cols-2 md:gap-14">
          {/* Ring */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative h-[240px] w-[240px] sm:h-[300px] sm:w-[300px]">
              <svg viewBox="0 0 300 300" className="h-full w-full -rotate-90">
                <circle cx="150" cy="150" r="130" stroke="var(--color-sk-track)" strokeWidth="14" fill="none" />
                <defs>
                  <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#246BFD" />
                    <stop offset="1" stopColor="#5AE0A0" />
                  </linearGradient>
                </defs>
                <motion.circle
                  cx="150"
                  cy="150"
                  r="130"
                  stroke="url(#ring-g)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={2 * Math.PI * 130}
                  animate={{ strokeDashoffset: 2 * Math.PI * 130 * (1 - progress / 100) }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: 'linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[56px] font-extrabold leading-none tracking-[-0.03em] text-sk-navy sm:text-[64px]">
                  {progress}
                  <span className="text-[28px] text-sk-muted">%</span>
                </span>
                <span className="mt-1.5 font-mono text-[10px] tracking-[0.15em] text-sk-muted">
                  {STEP_LABELS[activeStep]}
                </span>
              </div>
            </div>
            <div className="max-w-[360px] text-center">
              <div className="font-mono text-[11px] tracking-[0.1em] text-sk-muted">
                ESTIMASI · {Math.max(1, Math.ceil(((100 - progress) / 100) * (TOTAL_MS / 1000)))} DETIK LAGI
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-sk-body">
                CV kamu tetap aman. Kami tidak menyimpan dokumen setelah analisis selesai.
              </p>
            </div>
          </div>

          {/* Checklist */}
          <ul className="flex flex-col gap-4">
            {MOCK_ANALYZE_STEPS.map((step, i) => {
              const done = i < activeStep || progress >= 100;
              const now = i === activeStep && progress < 100;
              return (
                <li
                  key={step.label}
                  className={cn(
                    'flex items-center gap-3.5 rounded-[var(--radius-sk-lg)] border border-white/90 bg-white/70 px-4 py-3 text-[14.5px] backdrop-blur-sm transition-opacity duration-300',
                    !done && !now && 'opacity-55',
                    now && 'font-bold',
                  )}
                  aria-current={now ? 'step' : undefined}
                >
                  <motion.span
                    key={`${step.label}-${done}`}
                    initial={reduce ? false : done ? { scale: 0.6, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className={cn(
                      'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px]',
                      done && 'bg-sk-success-tint text-sk-success',
                      now && 'border-2 border-sk-blue bg-sk-blue-tint text-sk-blue',
                      !done && !now && 'bg-sk-track text-sk-faint',
                    )}
                    aria-hidden
                  >
                    {done ? <Check size={12} strokeWidth={3.5} /> : now ? '●' : <CircleDashed size={12} aria-hidden />}
                  </motion.span>
                  {step.label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
