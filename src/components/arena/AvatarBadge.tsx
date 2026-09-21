import Image from 'next/image';
import { avatarFor } from '@/lib/avatars';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
  '2xl': 88,
} as const;

/**
 * A participant's portrait, rendered anywhere they are named.
 *
 * The person's name is always next to it, so the image is decorative: `alt=""`
 * keeps a screen reader from announcing "Avatar 12" where a name belongs. The
 * portrait's own background colour fills the circle while the file loads, so a
 * slow network shows a soft disc instead of an empty hole.
 *
 * `seed` (a display name) gives an account that never picked a portrait one of
 * its own, rather than everyone sharing the default face.
 */
export function AvatarBadge({
  avatarId,
  seed,
  size = 'md',
  className,
}: {
  avatarId: string | null | undefined;
  seed?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const preset = avatarFor(avatarId, seed);
  const px = SIZES[size];
  return (
    <span
      style={{ backgroundColor: preset.tint, width: px, height: px }}
      className={cn('relative inline-flex shrink-0 select-none overflow-hidden rounded-full', className)}
    >
      <Image src={preset.image} alt="" width={px} height={px} unoptimized draggable={false} className="h-full w-full object-cover" />
    </span>
  );
}
