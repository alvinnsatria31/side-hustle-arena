'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, UserRound } from 'lucide-react';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { appNavLinks, isNavActive, type NavLink } from '@/components/layout/nav-links';
import { WHATSAPP_SUPPORT_URL } from '@/components/layout/FloatingWhatsApp';
import { ExternalMark, NavAnchor, NewBadge, PROMO_PILL } from '@/components/layout/NavPromo';
import { useParticipant } from '@/features/arena/participant';
import { cn } from '@/lib/cn';

function SidebarLink({ link, pathname }: { link: NavLink; pathname: string }) {
  const Icon = link.icon;
  const active = isNavActive(link.href, pathname);
  return (
    <NavAnchor
      link={link}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        link.highlight
          ? cn('duration-200', PROMO_PILL)
          : 'text-[#b9cbe3] hover:bg-white/10 hover:text-white',
        !link.highlight &&
          active &&
          'bg-[#2a6bea] text-white shadow-[0_8px_22px_rgba(12,69,157,0.28)] hover:bg-[#2a6bea]',
      )}
    >
      <Icon size={18} strokeWidth={active || link.highlight ? 2.3 : 2} aria-hidden />
      {link.label}
      {link.highlight && <NewBadge className="ml-auto" />}
      {link.external && <ExternalMark />}
    </NavAnchor>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const user = useParticipant();
  const name = user.displayName ?? 'Peserta';

  return (
    <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col bg-[#102544] px-4 py-6 text-white lg:flex xl:w-[260px]">
      <Link
        href="/app/arena"
        className="flex min-h-12 items-center gap-3 rounded-xl px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Image
          src="/logo-mark.png"
          alt="SekolahKarir Arena"
          width={34}
          height={34}
          className="h-[34px] w-[34px] rounded-lg bg-white object-contain p-0.5"
          unoptimized
        />
        <span className="min-w-0 leading-tight">
          <span className="block text-[13px] font-extrabold tracking-[-0.02em]">Sekolah Karir</span>
          <span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#93baff]">
            Side Hustle Arena
          </span>
        </span>
      </Link>

      <nav aria-label="Navigasi Arena" className="space-y-6">
        <div>
          <p className="mb-3 mt-11 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.17em] text-[#7d9abf]">
            Ruang kerja
          </p>
          <div className="space-y-1">
            {appNavLinks()
              .filter((link) => link.section !== 'lainnya')
              .map((link) => (
                <SidebarLink key={link.href} link={link} pathname={pathname} />
              ))}
          </div>
        </div>
        <div>
          <p className="mb-3 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.17em] text-[#7d9abf]">
            Lainnya
          </p>
          <div className="space-y-1">
            {appNavLinks()
              .filter((link) => link.section === 'lainnya')
              .map((link) => (
                <SidebarLink key={link.href} link={link} pathname={pathname} />
              ))}
          </div>
        </div>
      </nav>

      <div className="mt-auto border-t border-white/10 pt-5">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {user.avatarId ? (
            <AvatarBadge avatarId={user.avatarId} size="sm" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[14px] font-bold text-white">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-white">{name}</p>
            <p className="truncate font-mono text-[10.5px] text-[#7d9abf]">{user.email}</p>
          </div>
        </div>
        <div className="mt-1 space-y-1">
          <Link
            href="/app/profile"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#b9cbe3] transition-colors hover:bg-white/10 hover:text-white"
          >
            <UserRound size={18} aria-hidden /> Profil
          </Link>
          <a
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold text-[#b9cbe3] transition-colors hover:bg-white/10 hover:text-white"
          >
            <CircleHelp size={18} aria-hidden /> Bantuan
          </a>
        </div>
      </div>
    </aside>
  );
}
