import { cn } from '@/lib/cn';

/**
 * The "folder" hover from SekolahKarir Tools' product shelf
 * (sekolah-karir-career `components/store/ProductCard.tsx`), shared so every
 * catalogue card in Arena moves the same way.
 *
 * Two sheets sit stacked behind the card and peek out from under its top edge.
 * On hover they fan open like a folder whose contents are being pulled out,
 * a small tab tilts up like a lid, and the card lifts and tips a degree — the
 * card itself only has to rise, the stack does the rest.
 *
 * Usage: put FOLDER_WRAP on the (positioned) wrapper, render <FolderSheets />
 * first inside it, and put FOLDER_LIFT on the card. The wrapper isolates its
 * own stacking context so the sheets can sit at negative z-index behind the
 * card without disappearing behind a section background. All of it is off for
 * visitors who asked for reduced motion.
 */
export const FOLDER_WRAP = 'group relative isolate mt-2 h-full [perspective:800px]';

export const FOLDER_LIFT =
  'relative h-full transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform motion-safe:group-hover:-translate-y-2 motion-safe:group-hover:rotate-[-1deg] group-hover:shadow-sk-lg';

export function FolderSheets({ tab = true, tone = 'blue' }: { tab?: boolean; tone?: 'blue' | 'violet' | 'amber' }) {
  const front = tone === 'violet' ? 'bg-sk-violet-tint' : tone === 'amber' ? 'bg-sk-warning-tint' : 'bg-sk-blue-tint';
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-x-4 top-1 -z-20 h-full origin-bottom rounded-[var(--radius-sk-2xl)] bg-sk-track/80 transition-all duration-300 ease-out motion-safe:group-hover:-top-3 motion-safe:group-hover:rotate-[4deg]"
      />
      <div
        aria-hidden
        className={cn(
          'absolute inset-x-2 top-0.5 -z-10 h-full origin-bottom rounded-[var(--radius-sk-2xl)] transition-all duration-300 ease-out motion-safe:group-hover:-top-1.5 motion-safe:group-hover:rotate-[-3deg]',
          front,
        )}
      />
      {tab && (
        <div
          aria-hidden
          className="absolute -top-2 left-5 h-3 w-14 origin-bottom rounded-t-md bg-sk-navy/90 transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:-rotate-6"
        />
      )}
    </>
  );
}
