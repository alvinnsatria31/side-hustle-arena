'use client';

import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';
import { useSignIn } from '@/features/auth/sign-in';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** Where to continue once the session exists. Must be an `/app` path. */
  continueTo?: string;
}

/**
 * Approved login-required modal: fade + 8px lift, no scale.
 *
 * Signing in runs the Sekolah Karir gate in a popup window rather than handing
 * the tab to it, so this page survives the round trip: the participant returns
 * to the project they were reading, not to a generic landing. The reload only
 * happens once a session actually exists, and lands on `continueTo`.
 */
export function LoginModal({ open, onClose, continueTo }: LoginModalProps) {
  const { signIn, pending, message } = useSignIn(continueTo);

  return (
    <Modal open={open} onClose={onClose} labelledBy="login-modal-title" className="max-w-2xl">
      <div className="p-8 sm:p-9">
        <span className="eyebrow">Lanjutkan proyekmu</span>
        <h3 id="login-modal-title" className="mb-2 mt-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
          Masuk untuk mulai mengerjakan.
        </h3>
        <p className="mb-6 text-[14px] leading-relaxed text-sk-muted">
          Gunakan akun Sekolah Karir untuk memilih proyek dan menyimpan progresmu.
        </p>
        {message ? (
          <p role="alert" className="mb-5 border-l-2 border-sk-error bg-sk-error-wash px-4 py-3 text-[12.5px] leading-relaxed text-sk-error">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={() => void signIn()} loading={pending} disabled={pending}>
            {pending ? 'Menunggu jendela masuk…' : 'Masuk dengan Sekolah Karir'}
          </Button>
          <Button variant="text" onClick={onClose} className="ml-auto">
            Kembali lihat proyek
          </Button>
        </div>
        <p className="mt-6 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12px] leading-relaxed text-sk-body">
          Proses masuk dilakukan lewat Sekolah Karir. Setelah selesai, kamu bisa melanjutkan dari halaman ini.
        </p>
      </div>
    </Modal>
  );
}
