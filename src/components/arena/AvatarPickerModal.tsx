'use client';

import { useState } from 'react';
import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';
import { useParticipant, useParticipantAvatar } from '@/features/arena/participant';
import { setParticipantAvatar } from '@/lib/participant-client';
import { AvatarChoices } from '@/components/arena/AvatarChoices';
import { DEFAULT_AVATAR_ID } from '@/lib/avatars';

/**
 * The one thing a participant does on arrival.
 *
 * Someone who signed in on the main site is already authenticated here — the
 * session is shared — so there is nothing to log in to and nothing to fill in.
 * All that is missing is the face the leaderboard shows, and this asks for it
 * once. It raises itself whenever the picked avatar is still null and closes
 * because that stops being true — which is also what makes it self-healing: a
 * save that never lands simply asks again next time rather than leaving a
 * blank identity behind.
 */
export function AvatarPickerModal() {
  const user = useParticipant();
  const { avatarId, setAvatarId } = useParticipantAvatar();
  const [selected, setSelected] = useState(DEFAULT_AVATAR_ID);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const confirm = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await setParticipantAvatar(selected);
      // Applied locally rather than reloading: the participant is already where
      // they wanted to be, and a reload here would throw away the page they
      // just arrived at to change one emoji.
      setAvatarId(saved.avatarId);
    } catch {
      setError('Avatar belum tersimpan. Coba lagi sebentar.');
    } finally {
      setSaving(false);
    }
  };

  const firstName = user.displayName?.split(' ')[0];

  return (
    <Modal open={avatarId === null && !dismissed} onClose={() => {}} dismissable={false} labelledBy="avatar-picker-title" className="max-w-2xl">
      <div className="p-8 sm:p-9">
        <span className="eyebrow">Satu Langkah Lagi</span>
        <h3 id="avatar-picker-title" className="mb-2 mt-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
          {firstName ? `Halo, ${firstName}! Pilih avatar kamu.` : 'Pilih avatar kamu.'}
        </h3>
        <p className="mb-6 text-[14px] leading-relaxed text-sk-muted">
          Kamu sudah masuk lewat akun Sekolah Karir. Tinggal pilih avatar yang dipakai di leaderboard dan profil — bisa diganti kapan saja.
        </p>

        <AvatarChoices value={selected} onChange={setSelected} disabled={saving} label="Pilihan avatar" />

        {error ? (
          <p role="alert" className="mt-5 border-l-2 border-sk-error bg-sk-error-wash px-4 py-3 text-[12.5px] leading-relaxed text-sk-error">
            {error}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          <Button onClick={() => void confirm()} loading={saving} disabled={saving}>
            Masuk Arena
          </Button>
          {/* Only offered once a save has actually failed. A required step that
              cannot be completed because the server is down must not become a
              locked door, but nothing is gained by inviting people past it. */}
          {error ? (
            <Button variant="text" onClick={() => setDismissed(true)} className="ml-auto">
              Lewati dulu
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
