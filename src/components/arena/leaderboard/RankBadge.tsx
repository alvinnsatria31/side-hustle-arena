import { cn } from '@/lib/cn';

const RING: Record<number, string> = {
  1: 'ring-[#e0a82e] bg-[#fff6d8] text-[#9a6a07]',
  2: 'ring-[#a3afc0] bg-[#f3f5f8] text-[#566377]',
  3: 'ring-[#d08a55] bg-[#fdf0e5] text-[#9a5222]',
};

/** A place number in a ringed disc; the top three wear their medal colour. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[12.5px] font-bold tabular-nums ring-2 ring-inset',
        RING[rank] ?? 'bg-white text-sk-navy ring-sk-border',
        className,
      )}
    >
      <span className="sr-only">#</span>
      {rank}
    </span>
  );
}
