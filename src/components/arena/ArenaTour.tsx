'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button, ButtonLink } from '@/components/primitives/Button';

interface TourStep {
  /** Matches the `data-tour` attribute on the section it teaches. */
  id: string;
  title: string;
  body: string;
}

/**
 * The guided "Pelajari Arena" tour, walked on top of the real /arena page.
 *
 * Each step spotlights one section that already exists — hero, project
 * catalog, how-it-works, rewards, closing CTA — while the rest of the page
 * is blurred and made inert. Steps whose section is not rendered (the reward
 * ladder hides itself when the catalog is empty) are skipped, so the tour
 * never points at nothing.
 *
 * State lives in the URL (`?tur=1&langkah=2`): a step link can be shared and
 * a refresh resumes where the visitor was. Nothing is auto-shown — the tour
 * only runs when the visitor opens it by hand.
 */
const STEPS: ReadonlyArray<TourStep> = [
  {
    id: 'hero',
    title: 'Satu minggu, satu brief, satu bukti.',
    body: 'Panel ini live dari minggu yang sedang berjalan: sisa waktu pengumpulan, berapa peserta yang sudah ambil proyek, dan poin pekan ini. Kalau belum ada sprint terjadwal, halaman bilang terus terang.',
  },
  {
    id: 'proyek',
    title: 'Pilih brief yang dekat dengan arah kariermu.',
    body: 'Ini katalog asli minggu ini, bukan contoh. Buka satu kartu untuk baca brief lengkapnya — ambil satu, bukan semuanya.',
  },
  {
    id: 'cara-kerja',
    title: 'Lima tahap, dari pilih sampai dinilai.',
    body: 'Pilih proyek, kerjakan, kirim hasil, lihat penilaian per kriteria, lalu hasilnya tercatat di Career Report. Rubriknya terbuka sejak awal, sebelum kamu menulis apa pun.',
  },
  {
    id: 'hadiah',
    title: 'Skormu jadi poin, poinnya bisa ditukar.',
    body: 'Skor 0–100 jadi poin, tiga peringkat teratas dapat bonus. Katalog hadiahnya terbuka sejak hari pertama dan poinmu tidak hangus.',
  },
  {
    id: 'mulai',
    title: 'Udah paham alurnya.',
    body: 'Tinggal pilih satu proyek minggu ini dan mulai kerjakan. Tur ini bisa dibuka lagi kapan pun dari halaman ini.',
  },
];

const TOUR_PARAM = 'tur';
const STEP_PARAM = 'langkah';
const SEEN_KEY = 'arena-tur-seen';

function targetFor(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
}

function clearSpotlight() {
  document.body.classList.remove('tour-active');
  for (const el of document.querySelectorAll('[data-tour-target]')) {
    el.classList.remove('tour-spotlight');
  }
}

function ArenaTourInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const active = searchParams.get(TOUR_PARAM) === '1';
  // Ids of steps whose section actually rendered on this visit.
  const [stepIds, setStepIds] = useState<ReadonlyArray<string>>([]);
  const [index, setIndex] = useState(0);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const exit = useCallback(() => {
    clearSpotlight();
    replaceParams((params) => {
      params.delete(TOUR_PARAM);
      params.delete(STEP_PARAM);
    });
    // Hand focus back to the door the visitor came through.
    document.querySelector<HTMLElement>('[data-tour-trigger]')?.focus();
  }, [replaceParams]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // Private mode or blocked storage: the tour still closes normally.
    }
    exit();
  }, [exit]);

  // Opening the tour: keep only the steps whose section exists, then resume
  // the step the URL names (shared links land mid-tour on purpose).
  useEffect(() => {
    if (!active) {
      setStepIds((prev) => (prev.length > 0 ? [] : prev));
      setIndex((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const available = STEPS.filter((step) => targetFor(step.id) !== null).map((step) => step.id);
    setStepIds(available);
    const asked = Number.parseInt(searchParams.get(STEP_PARAM) ?? '1', 10);
    setIndex(Number.isFinite(asked) ? Math.min(Math.max(asked - 1, 0), Math.max(available.length - 1, 0)) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), stepIds.length - 1);
      setIndex(clamped);
      replaceParams((params) => {
        params.set(TOUR_PARAM, '1');
        params.set(STEP_PARAM, String(clamped + 1));
      });
    },
    [replaceParams, stepIds.length],
  );

  // Spotlight the current section: everything else blurs and goes inert,
  // the current one gets the ring, then it scrolls into view and the
  // callout heading takes focus for screen-reader visitors.
  useEffect(() => {
    if (!active || stepIds.length === 0) return;
    const current = stepIds[index];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.add('tour-active');
    for (const el of document.querySelectorAll('[data-tour-target]')) {
      el.classList.toggle('tour-spotlight', el.getAttribute('data-tour') === current);
    }
    targetFor(current)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    headingRef.current?.focus({ preventScroll: true });
  }, [active, index, stepIds]);

  // Panah kanan/kiri pindah langkah, Esc keluar. Kembali fokus ke pemicu.
  useEffect(() => {
    if (!active || stepIds.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        exit();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (index < stepIds.length - 1) goTo(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (index > 0) goTo(index - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, index, stepIds.length, goTo, exit]);

  // Leaving the page mid-tour must not leave the page blurred behind.
  useEffect(() => clearSpotlight, []);

  if (!active || stepIds.length === 0) return null;
  const step = STEPS.find((candidate) => candidate.id === stepIds[index]);
  if (!step) return null;
  const last = index === stepIds.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:bottom-6 sm:left-1/2 sm:right-auto sm:w-[min(560px,calc(100vw-2rem))] sm:translate-x-[-50%] sm:px-0 sm:pb-0">
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="arena-tour-title"
        className="rounded-[var(--radius-sk-2xl)] border border-sk-blue-tint-border bg-white p-5 shadow-[0_26px_70px_rgba(7,21,45,0.35)] sm:p-6"
      >
        <div className="flex items-center gap-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.13em] text-sk-blue-700">
            Pelajari Arena · {index + 1}/{stepIds.length}
          </p>
          <span className="flex-1" aria-hidden />
          <button
            type="button"
            onClick={finish}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sk-md)] px-2.5 text-[12.5px] font-semibold text-sk-muted transition-colors hover:text-sk-navy focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
          >
            <X size={14} strokeWidth={2.4} aria-hidden />
            Lewati
          </button>
        </div>

        <h2
          id="arena-tour-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-[19px] font-extrabold tracking-[-0.025em] text-sk-navy focus-visible:outline-none sm:text-[21px]"
        >
          {step.title}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-sk-muted">{step.body}</p>

        <div className="mt-5 flex items-center gap-2.5">
          {index > 0 ? (
            <Button variant="ghost" size="md" onClick={() => goTo(index - 1)} iconLeft={<ArrowLeft size={15} strokeWidth={2.4} aria-hidden />}>
              Kembali
            </Button>
          ) : (
            <span className="flex-1" aria-hidden />
          )}
          <span className="flex items-center gap-1.5" role="group" aria-label="Langkah tur">
            {stepIds.map((id, dot) => (
              <button
                key={id}
                type="button"
                onClick={() => goTo(dot)}
                aria-label={`Ke langkah ${dot + 1}: ${STEPS.find((candidate) => candidate.id === id)?.title ?? ''}`}
                aria-current={dot === index ? 'step' : undefined}
                className="grid min-h-11 min-w-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
              >
                <span
                  aria-hidden
                  className={
                    dot === index
                      ? 'h-1.5 w-6 rounded-full bg-sk-blue'
                      : 'h-1.5 w-1.5 rounded-full bg-sk-blue-tint-border'
                  }
                />
              </button>
            ))}
          </span>
          <span className="flex-1" aria-hidden />
          {last ? (
            <ButtonLink href="/app/arena" size="md" iconRight={<ArrowRight size={15} strokeWidth={2.4} aria-hidden />} onClick={finish}>
              Pilih proyek
            </ButtonLink>
          ) : (
            <Button size="md" onClick={() => goTo(index + 1)} iconRight={<ArrowRight size={15} strokeWidth={2.4} aria-hidden />}>
              Lanjut
            </Button>
          )}
        </div>

        {last && (
          <button
            type="button"
            onClick={() => goTo(0)}
            className="mt-3 inline-flex min-h-11 items-center text-[12.5px] font-semibold text-sk-blue underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
          >
            Ulangi tur dari awal
          </button>
        )}
      </div>
    </div>
  );
}

export function ArenaTour() {
  return (
    <Suspense fallback={null}>
      <ArenaTourInner />
    </Suspense>
  );
}
