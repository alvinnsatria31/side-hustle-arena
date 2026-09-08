'use client';

import { useCallback, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/primitives/Button';
import { getParticipantPrivacy, setParticipantShowcaseConsent, deleteParticipantAccount, useParticipantResource } from '@/lib/participant-client';
import { participantDate } from './ParticipantDashboard';

/**
 * The two decisions that are the participant's alone: whether their work may be
 * featured publicly, and whether their account should end.
 *
 * Both are worded plainly rather than as legal boilerplate. Consent that a
 * person cannot understand from the sentence next to the switch is not consent,
 * and deletion that does not say what survives would be a promise this product
 * cannot keep — the points ledger and a finalized week's leaderboard are shared
 * records, so the copy says so instead of implying everything disappears.
 */
export function PrivacyControls() {
  const privacy = useParticipantResource(useCallback(() => getParticipantPrivacy(), []));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const consented = privacy.data?.showcaseConsent ?? false;

  async function toggleConsent() {
    setBusy(true);
    setError(null);
    try {
      const result = await setParticipantShowcaseConsent(!consented);
      setNotice(result.consented
        ? 'Karyamu boleh tampil di Showcase publik. Kamu bisa mencabutnya kapan saja.'
        : 'Izin dicabut. Kamu tidak akan tampil di Showcase pada pemuatan berikutnya.');
      await privacy.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pengaturan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  async function requestDeletion() {
    setBusy(true);
    setError(null);
    try {
      await deleteParticipantAccount(confirmText);
      setNotice('Akun dihapus. Identitasmu sudah dianonimkan dan sesi ini tidak berlaku lagi.');
      await privacy.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Penghapusan akun gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="privasi" className="mt-8 scroll-mt-24">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-sk-navy">
        <ShieldCheck size={20} aria-hidden />Privasi
      </h2>
      {notice && <p role="status" className="mb-4 text-sm text-sk-success">{notice}</p>}
      {error && <p role="alert" className="mb-4 text-sm text-sk-error">{error}</p>}

      <div className="rounded-lg border border-sk-border bg-white p-5">
        <h3 className="font-semibold text-sk-navy">Tampil di Showcase publik</h3>
        <p className="mt-2 text-sm leading-relaxed text-sk-muted">
          Showcase menampilkan nama, avatar, project dan skor kamu ke pengunjung umum. Ini <strong>mati secara default</strong>:
          peringkat bagus saja tidak dianggap sebagai izin. Papan peringkat mingguan adalah halaman terpisah dan tetap publik
          sesuai aturan program.
        </p>
        {privacy.data?.showcaseConsentAt && (
          <p className="mt-2 text-xs text-sk-muted">Diizinkan sejak {participantDate(privacy.data.showcaseConsentAt)} WIB.</p>
        )}
        <Button
          className="mt-4"
          size="sm"
          variant={consented ? 'ghost' : 'primary'}
          disabled={busy || privacy.loading}
          onClick={() => void toggleConsent()}
        >
          {consented ? 'Cabut izin tampil' : 'Izinkan tampil di Showcase'}
        </Button>
      </div>

      <div className="mt-4 rounded-lg border border-sk-border bg-white p-5">
        <h3 className="font-semibold text-sk-navy">Hapus akun</h3>
        <p className="mt-2 text-sm leading-relaxed text-sk-muted">
          Email, nama, avatar, hasil scan CV, notifikasi dan catatan workspace kamu dihapus, dan akunmu tidak bisa dipakai
          masuk lagi. Poin, peringkat minggu yang sudah difinalisasi dan catatan ledger tetap ada dalam bentuk anonim —
          menghapusnya akan mengubah hasil minggu yang sudah diumumkan untuk peserta lain.
        </p>
        {!showDelete ? (
          <Button className="mt-4" size="sm" variant="ghost" onClick={() => setShowDelete(true)} iconLeft={<Trash2 size={15} aria-hidden />}>
            Saya ingin menghapus akun
          </Button>
        ) : (
          <div className="mt-4">
            <label className="text-[12px] font-semibold text-sk-muted" htmlFor="confirm-delete">
              Ketik <code className="rounded bg-sk-blue-wash px-1">HAPUS AKUN</code> untuk mengonfirmasi
              <input
                id="confirm-delete"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="mt-1.5 w-full max-w-xs rounded-[var(--radius-sk-md)] border border-sk-border px-3 py-2 text-sm text-sk-navy"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setShowDelete(false); setConfirmText(''); }}>Batal</Button>
              <Button size="sm" disabled={busy || confirmText !== 'HAPUS AKUN'} onClick={() => void requestDeletion()}>
                Hapus akun permanen
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
