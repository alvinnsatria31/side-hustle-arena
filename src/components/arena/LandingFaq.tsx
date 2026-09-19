import { Plus } from 'lucide-react';

/**
 * Landing FAQ.
 *
 * Native `<details>` rather than a client accordion: the open/close state, the
 * keyboard handling and the screen-reader announcement all come from the
 * browser, and the section costs no JavaScript on a page whose first job is to
 * load fast for someone who has never been here before.
 */
const ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Ini berbayar atau gratis?',
    a: 'Ikut sprint dan dinilai tidak dipungut biaya. Poin yang kamu kumpulkan bisa ditukar dengan hadiah di katalog, dan sebagian hadiah memang hanya butuh poin.',
  },
  {
    q: 'Saya dinilai berdasarkan apa?',
    a: 'Tiap proyek membawa rubriknya sendiri, dan rubrik itu terbuka di halaman proyek sebelum kamu mulai. Tidak ada kriteria yang baru muncul setelah hasilmu masuk.',
  },
  {
    q: 'Siapa yang menilai hasil kerja saya?',
    a: 'Penilai membaca hasil kerjamu tanpa tahu siapa kamu. Kalau keyakinan penilaian rendah atau ada ketidaksepakatan, penilai kedua ikut membaca. Skor akhir dihitung di dalam Arena, bukan dikirim dari luar.',
  },
  {
    q: 'Perlu pengalaman kerja dulu?',
    a: 'Tidak. Tingkat kesulitan proyek berbeda-beda dan ditandai di tiap kartu, jadi kamu bisa mulai dari yang paling dekat dengan kemampuanmu sekarang.',
  },
  {
    q: 'Bagaimana kalau saya tidak selesai tepat waktu?',
    a: 'Setelah batas pengumpulan lewat, workspace dikunci dan perubahan tidak bisa disimpan. Sprint berikutnya tetap terbuka untukmu.',
  },
  {
    q: 'Hasilnya bisa saya pakai melamar kerja?',
    a: 'Bisa. Hasil yang masuk sorotan mingguan punya halaman sendiri yang bisa kamu bagikan, dan halaman itu hanya tampil kalau kamu mengizinkan.',
  },
];

export function LandingFaq() {
  return (
    <div className="flex flex-col gap-3">
      {ITEMS.map(({ q, a }) => (
        <details
          key={q}
          className="group rounded-[var(--radius-sk-lg)] border border-sk-border bg-white transition-colors open:border-sk-blue-tint-border"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-bold text-sk-navy marker:hidden focus-visible:outline-2 focus-visible:outline-sk-blue focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
            {q}
            <span
              aria-hidden
              className="grid h-6 w-6 flex-none place-items-center rounded-full bg-sk-blue-tint text-sk-blue-700 transition-transform duration-300 ease-out group-open:rotate-45"
            >
              <Plus size={14} strokeWidth={2.5} />
            </span>
          </summary>
          <p className="px-5 pb-5 text-[14px] leading-relaxed text-sk-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
