'use client';

import { AVATARS } from '@/lib/avatars';
import { cn } from '@/lib/cn';

/**
 * The preset grid, shared by the arrival picker and the profile's change
 * control so the two can never drift into offering different avatars.
 *
 * A radiogroup rather than a row of buttons: picking one deselects the rest,
 * which is what arrow-key navigation and `aria-checked` already mean to a
 * screen reader, and the emoji is labelled by the preset's Indonesian name.
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
    <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2.5 sm:grid-cols-8">
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
              'flex aspect-square items-center justify-center rounded-[var(--radius-sk-md)] text-[26px] leading-none transition-all duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
              active ? 'ring-2 ring-sk-blue ring-offset-2' : 'ring-1 ring-inset ring-black/5',
            )}
          >
            <span aria-hidden>{avatar.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
