'use client';

import { useState } from 'react';
import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';
import { AvatarBadge } from '@/components/arena/AvatarBadge';
import { AvatarChoices } from '@/components/arena/AvatarChoices';
import { useParticipantAvatar } from '@/features/arena/participant';
import { setParticipantAvatar } from '@/lib/participant-client';
import { DEFAULT_AVATAR_ID } from '@/lib/avatars';

/**
 * Change the avatar picked on arrival.
 *
 * Dismissable, unlike the arrival picker: by the time someone reaches their
 * profile they already have an avatar, so closing this leaves them with the one
 * they had rather than with nothing.
 */
export function AvatarChooser() {
  const { avatarId, setAvatarId } = useParticipantAvatar();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(avatarId ?? DEFAULT_AVATAR_ID);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const start = () => {
    setSelected(avatarId ?? DEFAULT_AVATAR_ID);
    setError('');
    setOpen(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await setParticipantAvatar(selected);
      setAvatarId(saved.avatarId);
      setOpen(false);
    } catch {
      setError('Avatar belum tersimpan. Coba lagi sebentar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="group flex shrink-0 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2"
        aria-label="Ganti avatar"
      >
        <AvatarBadge avatarId={avatarId} size="lg" className="transition-transform group-hover:scale-105" />
        <span className="text-[12.5px] font-semibold text-sk-blue group-hover:underline">Ganti</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="avatar-chooser-title" className="max-w-2xl">
        <div className="p-8 sm:p-9">
          <span className="eyebrow">Avatar</span>
          <h3 id="avatar-chooser-title" className="mb-2 mt-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
            Ganti avatar kamu.
          </h3>
          <p className="mb-6 text-[14px] leading-relaxed text-sk-muted">
            Avatar ini yang muncul di leaderboard dan profil kamu.
          </p>

          <AvatarChoices value={selected} onChange={setSelected} disabled={saving} label="Pilihan avatar" />

          {error ? (
            <p role="alert" className="mt-5 border-l-2 border-sk-error bg-sk-error-wash px-4 py-3 text-[12.5px] leading-relaxed text-sk-error">
              {error}
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button onClick={() => void save()} loading={saving} disabled={saving}>
              Simpan avatar
            </Button>
            <Button variant="text" onClick={() => setOpen(false)} className="ml-auto">
              Batal
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
