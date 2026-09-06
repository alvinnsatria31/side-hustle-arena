import { avatarFor } from '@/lib/avatars';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'h-8 w-8 text-[16px]',
  md: 'h-10 w-10 text-[20px]',
  lg: 'h-14 w-14 text-[28px]',
} as const;

/**
 * A participant's picked avatar, rendered anywhere they are named.
 *
 * The emoji is decorative — the person's name is always next to it — so it is
 * hidden from assistive tech and the preset's label goes on the container
 * instead, which stops a screen reader announcing "rocket" where a name belongs.
 */
export function AvatarBadge({
  avatarId,
  size = 'md',
  className,
}: {
  avatarId: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const preset = avatarFor(avatarId);
  return (
    <span
      title={preset.label}
      style={{ backgroundColor: preset.tint }}
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full leading-none', SIZES[size], className)}
    >
      <span aria-hidden>{preset.emoji}</span>
    </span>
  );
}
