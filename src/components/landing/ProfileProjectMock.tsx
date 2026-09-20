import { cn } from '@/lib/cn';

/**
 * What an Arena result looks like once it is sitting in a profile.
 *
 * Drawn here, and drawn generic on purpose. It is not a screenshot, it carries
 * no LinkedIn mark or wordmark, and the person in it is a placeholder — the
 * claim the section makes is "this is the shape of what you end up with", and
 * a mock wearing somebody else's brand, or a real participant's name, would be
 * claiming something else entirely.
 *
 * It is also not a promise of an integration. Nothing in the Arena posts to
 * LinkedIn or anywhere else; a participant adds the entry themselves, which is
 * what the copy beside this says and why the badge reads "Ilustrasi".
 */
export function ProfileProjectMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-sk-2xl)] border border-sk-border bg-white shadow-sk-md',
        className,
      )}
    >
      <span className="absolute right-4 top-4 z-10 rounded-full border border-sk-border bg-sk-bg px-2.5 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-sk-faint">
        Ilustrasi
      </span>

      {/* Profile header */}
      <div className="border-b border-sk-border bg-[linear-gradient(120deg,#0b1933,#1a2f5a_70%,#246bfd)] px-5 pb-8 pt-6">
        <div className="h-2 w-24 rounded-full bg-white/25" aria-hidden />
      </div>

      <div className="-mt-7 px-5">
        <div className="flex items-end gap-3">
          <div
            aria-hidden
            className="grid h-14 w-14 flex-none place-items-center rounded-full border-[3px] border-white bg-sk-blue-tint text-[15px] font-extrabold text-sk-blue-700"
          >
            SK
          </div>
          <div className="pb-1">
            <div className="h-3 w-28 rounded-full bg-sk-navy/15" aria-hidden />
            <div className="mt-2 h-2.5 w-40 rounded-full bg-sk-navy/8" aria-hidden />
          </div>
        </div>
      </div>

      {/* Projects section */}
      <div className="px-5 pb-5 pt-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sk-faint">Projects</p>

        <div className="mt-3 rounded-[var(--radius-sk-lg)] border border-sk-border p-4">
          <p className="text-[14.5px] font-bold leading-snug tracking-[-0.025em] text-sk-navy">
            Analisis retensi pelanggan ritel
          </p>
          <p className="mt-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sk-blue-700">
            Side Hustle Arena · Sekolah Karir
          </p>

          <p className="mt-2.5 text-[12.5px] leading-relaxed text-sk-muted">
            Membaca data transaksi satu kuartal, menemukan titik pelanggan berhenti belanja, lalu
            menyusun rekomendasi yang bisa langsung dijalankan tim.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {['Data Analysis', 'SQL', 'Insight Writing'].map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-sk-blue-tint-border bg-sk-blue-tint px-2.5 py-1 text-[11px] font-semibold text-sk-blue-700"
              >
                {skill}
              </span>
            ))}
          </div>

          {/* Media attachment */}
          <div className="mt-3.5 flex items-center gap-3 rounded-[var(--radius-sk-md)] border border-sk-border bg-sk-bg p-2.5">
            <svg
              viewBox="0 0 64 40"
              aria-hidden
              focusable="false"
              className="h-10 w-16 flex-none rounded-[6px] border border-sk-border bg-white"
            >
              <polyline
                points="8,30 18,24 28,26 38,16 48,12 56,8"
                fill="none"
                stroke="#246bfd"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="56" cy="8" r="2.4" fill="#246bfd" />
            </svg>
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-sk-body">
                retensi-q3-ringkasan.pdf
              </span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-sk-faint">
                Media
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
