import {
  Award,
  FileSearch,
  Gift,
  Home,
  LayoutGrid,
  ScrollText,
  Sparkles,
  Store,
  Target,
  Trophy,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { isCvScannerEnabled } from '@/lib/cv-scan-limits';
import { isStoreEnabled } from '@/lib/store-flags';

/**
 * Every navigation surface reads its links from here.
 *
 * Four components used to keep four private lists, which is how the site ended
 * up advertising a route on one surface and hiding it on another. One list per
 * audience, filtered once, means a feature appears everywhere or nowhere.
 *
 * Two features stay out of navigation until their backends are switched on. A
 * link to a route that 404s is worse than no link: it reads as a broken site
 * rather than as a feature that has not launched.
 */
export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Set when the entry is only valid while a launch flag is on. */
  flag?: 'cv-scanner' | 'store';
}

function enabled(link: NavLink): boolean {
  if (link.flag === 'cv-scanner') return isCvScannerEnabled();
  if (link.flag === 'store') return isStoreEnabled();
  return true;
}

/**
 * Public nav, in the order a first-time visitor needs it: what this is, how it
 * is judged, what is open now, who has won, what it pays.
 *
 * Judging sits second on purpose. It is the objection that stops people
 * entering a competition, so it gets a nav slot rather than only a section
 * someone has to scroll far enough to find.
 */
const PUBLIC_ALL: NavLink[] = [
  { label: 'Cara kerja', href: '/arena', icon: Sparkles },
  { label: 'Penilaian', href: '/#nilai', icon: ScrollText },
  { label: 'Proyek', href: '/arena/projects', icon: LayoutGrid },
  { label: 'Sorotan', href: '/arena/showcase', icon: Trophy },
  { label: 'Hadiah', href: '/#hadiah', icon: Gift },
  { label: 'Scan CV', href: '/cv-scanner', icon: FileSearch, flag: 'cv-scanner' },
  { label: 'Toko', href: '/store', icon: Store, flag: 'store' },
];

/** Participant app nav — the places someone returns to while a week runs. */
const APP_ALL: NavLink[] = [
  { label: 'Beranda', href: '/app', icon: Home },
  { label: 'Arena', href: '/app/arena', icon: Zap },
  { label: 'Peringkat', href: '/app/arena/leaderboard', icon: Trophy },
  { label: 'Career Report', href: '/app/career-report', icon: Award },
  { label: 'Scan CV', href: '/app/cv-scanner', icon: FileSearch, flag: 'cv-scanner' },
  { label: 'Lowongan', href: '/app/jobs', icon: Target },
  { label: 'Toko', href: '/app/store', icon: Store, flag: 'store' },
];

/**
 * The bottom bar on mobile. Capped at five: past that the labels truncate and
 * the targets drop under the 44px minimum.
 */
const BOTTOM_ALL: NavLink[] = [
  { label: 'Beranda', href: '/app', icon: Home },
  { label: 'Arena', href: '/app/arena', icon: Zap },
  { label: 'Peringkat', href: '/app/arena/leaderboard', icon: Trophy },
  { label: 'Scan CV', href: '/app/cv-scanner', icon: FileSearch, flag: 'cv-scanner' },
  { label: 'Profil', href: '/app/profile', icon: UserRound },
];

export const publicNavLinks = (): NavLink[] => PUBLIC_ALL.filter(enabled);
export const appNavLinks = (): NavLink[] => APP_ALL.filter(enabled);
export const bottomNavLinks = (): NavLink[] => BOTTOM_ALL.filter(enabled).slice(0, 5);

/** Footer columns, built from the same lists so they cannot drift apart. */
export function footerColumns(): Array<{ heading: string; links: NavLink[] }> {
  return [
    { heading: 'Arena', links: publicNavLinks().filter((l) => l.href.startsWith('/arena') || l.href.startsWith('/#')) },
    {
      heading: 'Lainnya',
      links: [
        ...PUBLIC_ALL.filter((l) => l.flag).filter(enabled),
        { label: 'Career Report', href: '/app/career-report', icon: Award },
        { label: 'Masuk', href: '/login', icon: UserRound },
      ],
    },
  ];
}

/**
 * Active-state test shared by every surface.
 *
 * Hash links never match: they point at a section of the landing page, so
 * treating `/` as their route would light one of them up on every page.
 */
export function isNavActive(href: string, pathname: string): boolean {
  if (href.startsWith('/#')) return false;
  if (href === '/app') return pathname === '/app';
  return pathname === href || pathname.startsWith(href + '/');
}
