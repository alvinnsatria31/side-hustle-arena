import { FileText } from 'lucide-react';
import { cn } from '@/lib/cn';

/** An illustrative, non-interactive example of entering Arena work into a profile. */
export function PortfolioProofVisual({ className }: { className?: string }) {
  return (
    <figure className={cn('m-0 flex flex-col overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white shadow-sk-md', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sk-border bg-[#f8faff] px-5 py-4">
        <div className="flex items-center gap-2 text-[11px] font-bold text-sk-navy">
          <span className="rounded-full bg-sk-blue-tint px-2.5 py-1 text-sk-blue-700">Hasil Arena</span>
          <span>Projects di LinkedIn</span>
        </div>
        <span className="rounded-full border border-sk-border bg-white px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-sk-muted">Ilustrasi</span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_20%_10%,#e9f1ff,transparent_42%),#f4f7fb] p-4 sm:p-6">
        <div className="w-full max-w-[470px] overflow-hidden rounded-xl border border-[#d7e0ed] bg-white shadow-[0_14px_45px_rgba(19,45,82,0.12)]">
          <div className="flex items-center justify-between border-b border-[#e6eaf0] px-5 py-3.5">
            <div>
              <p className="text-[15px] font-bold text-sk-navy">Add project</p>
              <p className="mt-0.5 text-[10px] text-sk-muted">Contoh pengisian manual</p>
            </div>
            <span aria-hidden className="text-[20px] leading-none text-sk-faint">×</span>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold text-sk-body">Project name <span className="text-sk-blue">*</span></p>
              <div className="mt-1 rounded-md border border-[#b9c7d8] bg-white px-3 py-2 text-[12px] font-semibold text-sk-navy">Sales Insight Brief</div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-sk-body">Description</p>
              <div className="mt-1 rounded-md border border-[#b9c7d8] bg-white px-3 py-2 text-[11px] leading-relaxed text-sk-body">
                Menganalisis data penjualan, menemukan peluang, dan menyusun tiga rekomendasi bisnis yang dapat ditindaklanjuti.
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-sk-body">Skills</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {['Data Analysis', 'Business Insight', 'Presentasi'].map((skill) => <span key={skill} className="rounded-full border border-[#b7d2f7] bg-[#f3f8ff] px-2.5 py-1 text-[10px] font-semibold text-[#225999]">{skill}</span>)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-sk-body">Media</p>
              <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-dashed border-[#b8cbe4] bg-[#f8fbff] px-3 py-2.5">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#e5f0ff] text-sk-blue"><FileText size={17} /></span>
                <span className="min-w-0"><span className="block truncate text-[11px] font-semibold text-sk-navy">Hasil analisis penjualan</span><span className="mt-0.5 block text-[10px] text-sk-muted">Lampiran karya proyek</span></span>
              </div>
            </div>
          </div>
          <div className="flex justify-end border-t border-[#e6eaf0] px-5 py-3">
            <span className="rounded-full bg-[#0a66c2] px-4 py-1.5 text-[11px] font-bold text-white">Save</span>
          </div>
        </div>
      </div>

      <figcaption className="border-t border-sk-border bg-white px-5 py-3 text-[11px] leading-relaxed text-sk-muted">
        Ilustrasi cara memasukkan hasil proyek ke profil. Kamu mengisinya sendiri; Arena tidak terhubung ke LinkedIn.
      </figcaption>
    </figure>
  );
}
