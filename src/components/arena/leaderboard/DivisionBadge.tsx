import { BarChart3, Boxes, Code2, Megaphone, Palette, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const DIVISIONS: Array<{ match: RegExp; icon: LucideIcon; tint: string; ink: string }> = [
  { match: /data|analy|analis|sql|riset|research/i, icon: BarChart3, tint: '#e0f2fe', ink: '#0369a1' },
  { match: /design|desain|ux|ui|brand/i, icon: Palette, tint: '#ede9fe', ink: '#6d28d9' },
  { match: /product|produk/i, icon: Boxes, tint: '#fef3c7', ink: '#b45309' },
  { match: /market|growth|sales|konten/i, icon: Megaphone, tint: '#ffe4e6', ink: '#be123c' },
  { match: /hr|people|talent|rekrut/i, icon: Users, tint: '#dcfce7', ink: '#15803d' },
  { match: /dev|engineer|code|software/i, icon: Code2, tint: '#e0e7ff', ink: '#4338ca' },
];

export function divisionStyle(name: string | null | undefined) {
  const found = name ? DIVISIONS.find((entry) => entry.match.test(name)) : undefined;
  return found ?? { icon: Sparkles, tint: '#f1f5f9', ink: '#475569' };
}

/**
 * The small companion disc on a portrait: which track the person competed in.
 * Named in `title` for pointer users; the division is always spelled out in
 * the row itself, so the disc stays decorative for assistive tech.
 */
export function DivisionBadge({ division, size = 20, className }: { division: string | null | undefined; size?: number; className?: string }) {
  const { icon: Icon, tint, ink } = divisionStyle(division);
  return (
    <span
      aria-hidden
      title={division ?? undefined}
      style={{ width: size, height: size, backgroundColor: tint, color: ink }}
      className={cn('inline-grid shrink-0 place-items-center rounded-full ring-2 ring-white', className)}
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2.4} />
    </span>
  );
}
