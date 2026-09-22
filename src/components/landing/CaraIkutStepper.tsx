'use client';

import Image from 'next/image';
import { FolderGit2, ImageIcon, Trophy, Upload, type LucideIcon } from 'lucide-react';
import Stepper, { Step } from '@/components/landing/Stepper';

interface StepDefinition {
  icon: LucideIcon;
  title: string;
  body: string;
  /**
   * Illustration for this step, 1200×750 (16:10), in `public/landing/`.
   *
   * `null` until the real artwork exists: a missing `/landing/*.png` would
   * render as a broken image on the live page, so the frame below stands in
   * instead and says what belongs there. The prompts used to generate these
   * are in `public/landing/README.md`.
   */
  image: { src: string; alt: string } | null;
}

/** The three steps, in the order someone actually lives them. */
const STEPS: ReadonlyArray<StepDefinition> = [
  {
    icon: FolderGit2,
    title: 'Pilih proyek',
    body: 'Buka Arena, baca brief-brief yang dibuka minggu ini, lalu ambil satu yang paling dekat dengan arah kariermu.',
    image: {
      src: '/landing/cara-ikut-01.png',
      alt: 'Pilih proyek mingguan di Side Hustle Arena',
    },
  },
  {
    icon: Upload,
    title: 'Kerjakan dan unggah',
    body: 'Workspace-nya memandu dari membaca brief sampai mengunggah hasil, sebelum batas pengumpulan minggu itu.',
    image: {
      src: '/landing/cara-ikut-02.png',
      alt: 'Kerjakan project brief dan unggah hasil proyek di workspace',
    },
  },
  {
    icon: Trophy,
    title: 'Dapat penilaian dan manfaatnya',
    body: 'Hasilmu dinilai per kriteria yang sudah terbuka sejak awal. Skornya jadi poin, hasilnya jadi bukti kerja.',
    image: {
      src: '/landing/cara-ikut-03.png',
      alt: 'Penilaian proyek terperinci, raih poin dan bangun portofolio',
    },
  },
];

/** The 16:10 illustration slot: the artwork if it exists, its outline if not. */
function StepImage({ image, step }: { image: StepDefinition['image']; step: number }) {
  if (image) {
    return (
      <div className="relative mt-6 aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-sk-lg)] border border-sk-border bg-sk-blue-wash shadow-xs">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 768px) 640px, 100vw"
          className="object-cover"
          priority={step === 1}
        />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className="mt-6 grid aspect-[16/10] w-full place-items-center rounded-[var(--radius-sk-lg)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash text-center"
    >
      <div className="px-6 text-sk-faint">
        <ImageIcon size={22} strokeWidth={1.8} className="mx-auto" />
        <p className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">
          Ilustrasi langkah 0{step}
        </p>
        <p className="mt-1 text-[12px]">1200 × 750 · /landing/cara-ikut-0{step}.png</p>
      </div>
    </div>
  );
}

/**
 * "Cara ikut", walked one step at a time.
 *
 * The last step has nothing to complete — it is the end of an explanation, not
 * a form — so the footer disappears there instead of offering a button that
 * would do nothing.
 */
export function CaraIkutStepper() {
  return (
    <Stepper className="mx-auto max-w-2xl" hideCompleteButton nextButtonText="Langkah berikutnya">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <Step key={step.title}>
            <div className="flex items-center gap-3 pt-7">
              <span
                aria-hidden
                className="grid h-11 w-11 flex-none place-items-center rounded-[var(--radius-sk-lg)] border border-sk-blue-tint-border bg-sk-blue-tint text-sk-blue-700"
              >
                <Icon size={19} strokeWidth={2.2} />
              </span>
              <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-sk-faint">0{index + 1}</span>
            </div>
            <h3 className="mt-5 text-[19px] font-bold tracking-[-0.03em] text-sk-navy md:text-[21px]">{step.title}</h3>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-sk-muted">{step.body}</p>
            <StepImage image={step.image} step={index + 1} />
          </Step>
        );
      })}
    </Stepper>
  );
}
