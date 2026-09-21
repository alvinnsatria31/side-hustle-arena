import {
  Award,
  FileSearch,
  FolderOpen,
  Gift,
  Home,
  LayoutGrid,
  Sparkles,
  Store,
  Trophy,
  UserRound,
  Wrench,
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
  /**
   * An absolute URL on another host. It opens in a new tab and never matches
   * the active-state test, because nothing here is the page it points at.
   */
  external?: boolean;
  /** Promo treatment: the gradient pill and the "BARU" flag. */
  highlight?: boolean;
  /** Sidebar grouping. Links without a section render in the main group. */
  section?: 'arena' | 'lainnya';
}

/**
 * SekolahKarir Tools — the AI CV builder and the rest of the toolbox, live on
 * its own host.
 *
 * It is promoted rather than merely listed because it launched after everyone
 * already learned this navigation, and a new entry slotted quietly among five
 * familiar ones is a new entry nobody clicks. The highlight is a launch
 * decision, not a permanent style: drop `highlight` and it becomes an ordinary
 * link without touching any of the five surfaces that draw it.
 */
export const TOOLS_URL = 'https://tools.sekolahkarir.id';

const TOOLS: NavLink = {
  label: 'Tools',
  href: TOOLS_URL,
  icon: Wrench,
  external: true,
  highlight: true,
};

function enabled(link: NavLink): boolean {
  if (link.flag === 'cv-scanner') return isCvScannerEnabled();
  if (link.flag === 'store') return isStoreEnabled();
  return true;
}

/**
 * Public nav, in the order a first-time visitor needs it: what this is, what
 * is open now, who has won.
 *
 * Every entry is a route. The two landing-page anchors that used to sit here —
 * `/#nilai` and `/#hadiah` — went when the landing page was rebuilt around the
 * live week and those sections stopped existing. A nav link to a hash with
 * nothing behind it does not 404, it silently does nothing, which is the one
 * kind of broken link a visitor blames themselves for.
 */
const PUBLIC_ALL: NavLink[] = [
  { label: 'Cara kerja', href: '/arena', icon: Sparkles },
  { label: 'Proyek', href: '/arena/projects', icon: LayoutGrid },
  { label: 'Sorotan', href: '/arena/showcase', icon: Trophy },
  { label: 'Scan CV', href: '/cv-scanner', icon: FileSearch, flag: 'cv-scanner' },
  { label: 'Toko', href: '/store', icon: Store, flag: 'store' },
  TOOLS,
];

/** Participant app nav — the places someone returns to while a week runs. */
const APP_ALL: NavLink[] = [
  { label: 'Ringkasan', href: '/app/arena', icon: Home, section: 'arena' },
  { label: 'Jelajahi proyek', href: '/app/arena/projects', icon: LayoutGrid, section: 'arena' },
  { label: 'Proyekku', href: '/app/arena/my-projects', icon: FolderOpen, section: 'arena' },
  { label: 'Peringkat', href: '/app/arena/leaderboard', icon: Trophy, section: 'arena' },
  { label: 'Poin & hadiah', href: '/app/profile#rewards', icon: Gift, section: 'lainnya' },
  { ...TOOLS, section: 'lainnya' },
];

/**
 * The bottom bar on mobile. Capped at five: past that the labels truncate and
 * the targets drop under the 44px minimum.
 */
const BOTTOM_ALL: NavLink[] = [
  { label: 'Ringkasan', href: '/app/arena', icon: Home },
  { label: 'Proyek', href: '/app/arena/projects', icon: LayoutGrid },
  { label: 'Proyekku', href: '/app/arena/my-projects', icon: FolderOpen },
  { label: 'Peringkat', href: '/app/arena/leaderboard', icon: Trophy },
  { label: 'Profil', href: '/app/profile', icon: UserRound },
];

export const publicNavLinks = (): NavLink[] => PUBLIC_ALL.filter(enabled);
export const appNavLinks = (): NavLink[] => APP_ALL.filter(enabled);
export const bottomNavLinks = (): NavLink[] => BOTTOM_ALL.filter(enabled).slice(0, 5);

/** Footer columns, built from the same lists so they cannot drift apart. */
export function footerColumns(): Array<{ heading: string; links: NavLink[] }> {
  return [
    {
      heading: 'Arena',
      links: publicNavLinks().filter((l) => l.href.startsWith('/arena') || l.href.startsWith('/#')),
    },
    {
      heading: 'Lainnya',
      links: [
        TOOLS,
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
  // An absolute URL is on another host. Comparing it to a pathname would at
  // best never match and at worst light up on a path that merely looks alike.
  if (/^https?:\/\//.test(href)) return false;
  if (href.startsWith('/#')) return false;
  const target = href.split('#')[0];
  if (target === '/app' || target === '/app/arena' || href.includes('#'))
    return pathname === target;
  return pathname === target || pathname.startsWith(target + '/');
}
