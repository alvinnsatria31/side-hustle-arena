import Link from 'next/link';
import { Bookmark, Gift, MessageCircle, Trophy, type LucideIcon } from 'lucide-react';
import { WHATSAPP_SUPPORT_URL } from '@/components/layout/FloatingWhatsApp';
import { REWARDS_PATH } from '@/components/layout/nav-links';

interface Action {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
}

const actions: Action[] = [
  {
    label: 'Peringkat',
    hint: 'Posisi kamu minggu ini',
    href: '/app/arena/leaderboard',
    icon: Trophy,
  },
  {
    label: 'Poin & hadiah',
    hint: 'Tukar poin yang terkumpul',
    href: REWARDS_PATH,
    icon: Gift,
  },
  {
    label: 'Tersimpan',
    hint: 'Brief yang kamu tandai',
    href: '/app/arena/projects?view=saved',
    icon: Bookmark,
  },
  {
    label: 'Bantuan',
    hint: 'Chat CS via WhatsApp',
    href: WHATSAPP_SUPPORT_URL,
    icon: MessageCircle,
    external: true,
  },
];

/**
 * The secondary destinations, as tiles rather than a button row.
 *
 * They used to be three 36px ghost buttons in a wrapping row under the fold —
 * under the 44px touch minimum, and with no hint as to why anyone would tap
 * them. Same links, given a label, a reason and a real target size.
 */
export function QuickActions() {
  return (
    <nav aria-label="Pintasan" className="mt-10">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map(({ label, hint, href, icon: Icon, external }) => {
          const content = (
            <>
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-sk-md)] bg-sk-blue-tint text-sk-blue transition-colors group-hover:bg-sk-blue group-hover:text-white"
              >
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold text-sk-navy">{label}</span>
                <span className="block text-[11.5px] leading-snug text-sk-faint">{hint}</span>
              </span>
            </>
          );
          const className =
            'card-rise group flex min-h-[60px] items-center gap-3 rounded-[var(--radius-sk-xl)] border border-sk-border bg-white px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-blue';
          return (
            <li key={label}>
              {external ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                  {content}
                </a>
              ) : (
                <Link href={href} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
