'use client';

import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';
import { useDemo } from '@/features/demo/store';
import { useRouter } from 'next/navigation';

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
 * "Masuk"/"Daftar Gratis" establish a clearly-mocked local session.
 */
export function LoginModal({ open, onClose, continueTo, onContinue }: LoginModalProps) {
  const { login } = useDemo();
  const router = useRouter();

  const establish = () => {
    login();
    onClose();
    if (onContinue) {
      onContinue();
    } else if (continueTo) {
      router.push(continueTo);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="login-modal-title" className="max-w-2xl">
      <div className="p-8 sm:p-9">
        <span className="eyebrow">Simpan Progress</span>
        <h3 id="login-modal-title" className="mb-2 mt-2.5 text-[24px] font-extrabold tracking-[-0.02em] text-sk-navy">
          Simpan progress project kamu.
        </h3>
        <p className="mb-6 text-[14px] leading-relaxed text-sk-muted">
          Masuk atau buat akun untuk mengambil project minggu ini dan menyimpan progress. Gratis, dan setup-nya kurang dari
          satu menit.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={establish}>Masuk</Button>
          <Button variant="ghost" onClick={establish}>
            Daftar Gratis
          </Button>
          <Button variant="text" onClick={onClose} className="ml-auto">
            Kembali lihat project
          </Button>
        </div>
        <p className="mt-6 rounded-xl border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-3 text-[12px] leading-relaxed text-sk-body">
          Mode demo lokal: tidak ada server, tidak ada password. &ldquo;Masuk&rdquo; hanya membuat sesi frontend di browser kamu.
        </p>
      </div>
    </Modal>
  );
}
