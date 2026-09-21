import { useId } from 'react';
import { cn } from '@/lib/cn';

export type MedalTone = 'gold' | 'silver' | 'bronze';

const TONES: Record<MedalTone, { light: string; mid: string; dark: string; ribbon: string; ribbonDark: string; star: string }> = {
  gold: { light: '#fff0b3', mid: '#f7c73a', dark: '#c98a0c', ribbon: '#f2b21b', ribbonDark: '#c7880a', star: '#fff7d6' },
  silver: { light: '#ffffff', mid: '#cfd6e0', dark: '#8f9bad', ribbon: '#b4bfcd', ribbonDark: '#8a96a8', star: '#ffffff' },
  bronze: { light: '#ffd9b5', mid: '#e39a5f', dark: '#a85a26', ribbon: '#d9834a', ribbonDark: '#a65a28', star: '#ffe6d1' },
};

/** Five-point star path centred on (cx, cy). */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}

/**
 * The rosette that sits on each podium step: a starred medallion on two
 * ribbon tails, shaded so it reads as a solid object rather than a flat icon.
 * Drawn inline so the podium needs no image request and stays sharp at any
 * size; gradient ids are per-instance so three medals never share a fill.
 */
export function Medal({ tone, className }: { tone: MedalTone; className?: string }) {
  const id = useId().replace(/:/g, '');
  const c = TONES[tone];
  return (
    <svg viewBox="0 0 64 76" aria-hidden focusable="false" className={cn('drop-shadow-[0_6px_8px_rgba(120,80,10,0.22)]', className)}>
      <defs>
        <linearGradient id={`${id}-face`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.5" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0.85" y1="0.95" x2="0.15" y2="0.05">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.55" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
      </defs>
      <path d="M21 40 L12 72 L21.5 66.5 L27.5 74 L33 46 Z" fill={c.ribbonDark} />
      <path d="M43 40 L52 72 L42.5 66.5 L36.5 74 L31 46 Z" fill={c.ribbon} />
      <circle cx="32" cy="28" r="23" fill={`url(#${id}-rim)`} />
      <circle cx="32" cy="28" r="17.5" fill={`url(#${id}-face)`} />
      <circle cx="32" cy="28" r="17.5" fill="none" stroke={c.dark} strokeOpacity="0.28" strokeWidth="1.2" />
      <path d={star(32, 28.5, 9.5, 4.2)} fill={c.star} stroke={c.dark} strokeOpacity="0.45" strokeWidth="0.9" strokeLinejoin="round" />
      <ellipse cx="23.5" cy="16" rx="8" ry="4.2" fill="#ffffff" opacity="0.45" transform="rotate(-32 23.5 16)" />
    </svg>
  );
}
