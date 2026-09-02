'use client';

import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** Where to continue after the demo session is established. */
  continueTo?: string;
  /** Overrides the default navigation (e.g. to also enroll into the project). */
  onContinue?: () => void;
}

/**
 * Approved login-required modal: fade + 8px lift, no scale.
 * The visual shell remains; authentication starts the server-side SSO flow.
 */
export function LoginModal({ open, onClose, continueTo, onContinue }: LoginModalProps) {
  const establish = () => {
    onClose();
    const returnTo = continueTo?.startsWith('/app') ? continueTo : '/app';
    window.location.assign('/auth/login?returnTo=' + encodeURIComponent(returnTo));
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="login-modal-title" className="max-w-2xl">
      <div className="p-8 sm:p-9">
        <span className="eyebrow">Simpan Progress</span>
        <h3 id="login-modal-title" className="mb-2 mt-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
          Simpan progress project kamu.
        </h3>
        <p className="mb-6 text-[14px] leading-relaxed text-sk-muted">
          Masuk dengan akun Sekolah Karir untuk mengambil project minggu ini dan menyimpan progress.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={establish}>Masuk dengan Sekolah Karir</Button>
          <Button variant="text" onClick={onClose} className="ml-auto">
            Kembali lihat project
          </Button>
        </div>
        <p className="mt-6 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12px] leading-relaxed text-sk-body">
          Arena tidak membuat password atau sesi frontend. &ldquo;Masuk&rdquo; membuka autentikasi Sekolah Karir.
        </p>
      </div>
    </Modal>
  );
}
