'use client';

import Image from 'next/image';
import { AVATARS } from '@/lib/avatars';
import { cn } from '@/lib/cn';

/**
 * The preset grid, shared by the arrival picker and the profile's change
 * control so the two can never drift into offering different avatars.
 *
 * A radiogroup rather than a row of buttons: picking one deselects the rest,
 * which is what `aria-checked` already means to a screen reader. There are a
 * hundred-odd portraits, so the grid scrolls inside the dialog instead of
 * pushing its buttons off screen.
 */
export function AvatarChoices({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (avatarId: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="-mx-1 grid max-h-[340px] grid-cols-5 gap-2.5 overflow-y-auto px-1 py-1 sm:grid-cols-8"
    >
      {AVATARS.map((avatar) => {
        const active = avatar.id === value;
        return (
          <button
            key={avatar.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={avatar.label}
            disabled={disabled}
            onClick={() => onChange(avatar.id)}
            style={{ backgroundColor: avatar.tint }}
            className={cn(
              'relative aspect-square overflow-hidden rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
              active ? 'ring-[3px] ring-sk-blue ring-offset-2' : 'ring-1 ring-inset ring-black/5',
            )}
          >
            <Image src={avatar.image} alt="" fill sizes="72px" unoptimized className="object-cover" />
          </button>
        );
      })}
    </div>
  );
}
