'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/primitives/Button';
import { FileDropzone, type DropzoneError, type SelectedFile } from '@/components/cv-scanner/FileDropzone';
import { useCvOwnerGuard, useDemo } from '@/features/demo/store';
import { isCvScannerEnabled } from '@/lib/cv-scan-limits';
import { CvScannerClosed } from './CvScannerClosed';
import { ANALYZE_COVERAGE } from '@/data/mock/cv';
import { startCvScan } from '@/lib/cv-scan-client';
import { CvHistoryView } from './CvHistoryView';

const TRUST_POINTS = ['Gratis', 'Aman & Terenkripsi', 'Privat — tidak dibagikan'];

/** CV upload screen (public + app variants share the same journey). */
export function CvUploadView({ basePath }: { basePath: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { state, dispatch } = useDemo();
  const ownerId = useCvOwnerGuard();
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [error, setError] = useState<DropzoneError>(null);
  // The File itself, kept out of the store because it cannot be serialised.
  // Absent when the selection was restored from stored state after a reload,
  // which is why the button asks for the file again in that case.
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [saveHistory, setSaveHistory] = useState(false);

  // Sync with the persisted demo state once it hydrates (and on external changes).
  useEffect(() => {
    if (state.cvScan.status === 'file_selected' && state.cvScan.fileName) {
      setFile({ name: state.cvScan.fileName, size: state.cvScan.fileSize ?? 0 });
    } else if (state.cvScan.status === 'idle') {
      setFile(null);
    }
  }, [state.cvScan.status, state.cvScan.fileName, state.cvScan.fileSize]);

  const handlePick = useCallback(
    (picked: SelectedFile, err: DropzoneError, raw: File) => {
      if (err) {
        setError(err);
        setFile(null);
        setRawFile(null);
        dispatch({ type: 'CV_CLEAR_FILE' });
        return;
      }
      setError(null);
      setFile(picked);
      setRawFile(raw);
      dispatch({ type: 'CV_SET_FILE', fileName: picked.name, fileSize: picked.size, ownerId });
    },
    [dispatch, ownerId],
  );

  const handleRemove = () => {
    setFile(null);
    setRawFile(null);
    setError(null);
    dispatch({ type: 'CV_CLEAR_FILE' });
  };

  const startAnalysis = () => {
    if (!rawFile) return;
    // Send the file before navigating: the analyzing route awaits this promise,
    // and a File cannot travel through the store to get there.
    startCvScan(rawFile, saveHistory);
    dispatch({ type: 'CV_START', ownerId });
    router.push(`${basePath}/analyzing`);
  };

  // After every hook: an early return above them would change hook order
  // between renders the moment the flag flips.
  if (!isCvScannerEnabled()) return <CvScannerClosed />;

  return (
    <div>
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }}>
        <span className="eyebrow mt-2">CV Scanner</span>
        <h1 className="mb-3 mt-3 max-w-[640px] text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-sk-navy sm:text-[44px]">
          {file ? 'Siap dianalisis.' : 'Cari tahu seberapa siap CV-mu.'}
        </h1>
        <p className="mb-9 max-w-[560px] text-[14.5px] leading-relaxed text-sk-muted">
          {file
            ? 'Kami akan memeriksa struktur, ATS readiness, impact, dan skill evidence.'
            : 'Dapatkan analisis CV, ATS readiness, impact, dan bukti skill yang masih perlu diperkuat — dalam hitungan detik.'}
        </p>
      </motion.div>

      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}>
        <FileDropzone file={file} error={error} onPick={handlePick} onRemove={handleRemove} />

        <label className="mt-5 flex items-start gap-3 rounded-xl border border-sk-border bg-white p-4 text-[13px] leading-relaxed text-sk-body">
          <input type="checkbox" checked={saveHistory} onChange={(event) => setSaveHistory(event.target.checked)} className="mt-1 h-4 w-4 accent-sk-blue" />
          <span>Saya setuju menyimpan hasil analisis secara privat di akun saya (perlu masuk). Riwayat menyimpan 50 hasil terbaru, termasuk nama file dan cuplikan pada saran perbaikan; hasil lebih lama otomatis dihapus. File CV dan teks lengkapnya tidak disimpan di server.</span>
        </label>

        {file && !error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mt-5 flex flex-wrap gap-3"
          >
            <Button size="lg" onClick={startAnalysis} disabled={!rawFile} className="min-w-[220px]">
              Mulai Analisis
            </Button>
            <Button size="lg" variant="ghost" onClick={handleRemove}>
              Ganti File
            </Button>
          </motion.div>
        )}
        {file && !error && !rawFile && (
          <p role="status" className="mt-3 text-[13px] text-sk-muted">
            Pilih ulang filenya untuk memulai analisis — browser tidak menyimpan isi file setelah halaman dimuat ulang.
          </p>
        )}

        {file && !error && (
          <div className="mt-6 rounded-[var(--radius-sk-lg)] border border-dashed border-sk-blue-tint-border bg-sk-blue-wash px-4 py-4 text-[12.5px] leading-relaxed text-sk-body">
            Analisis butuh sekitar <b>20–30 detik</b>. Kami tidak menyimpan file setelah selesai.
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[12.5px] text-sk-body">
          {TRUST_POINTS.map((point) => (
            <span key={point} className="inline-flex items-center gap-1.5">
              <span className="font-bold text-sk-success" aria-hidden>✓</span>
              {point}
            </span>
          ))}
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {ANALYZE_COVERAGE.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.25 + i * 0.07, ease: 'easeOut' }}
              className="rounded-[var(--radius-sk-lg)] border border-sk-border bg-white p-3.5"
            >
              <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.1em] text-sk-muted">{item.key}</div>
              <div className="text-[13.5px] font-bold text-sk-navy">{item.title}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <CvHistoryView basePath={basePath} />
    </div>
  );
}
