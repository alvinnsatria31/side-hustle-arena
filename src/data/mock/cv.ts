import type { AnalyzeStep, CvMetric, SkillEvidence } from '@/types/cv';

/** Static analysis output for the local demo scan. */
export const MOCK_CV_SCORE = 72;
export const MOCK_CV_STATUS = 'GOOD FOUNDATION';
export const MOCK_CV_FILE_NAME = 'Alvin_Pratama_CV_2026.pdf';

export const MOCK_CV_METRICS: CvMetric[] = [
  { key: 'quality', label: 'CV Quality', score: 82 },
  { key: 'ats', label: 'ATS Readiness', score: 78 },
  { key: 'impact', label: 'Impact', score: 66 },
  { key: 'evidence', label: 'Career Evidence', score: 48, weak: true },
];

export const MOCK_CV_STRENGTHS = [
  'Struktur CV jelas dan mudah dipindai oleh recruiter.',
  'Experience relevan dengan role Data Analyst yang dituju.',
  'Format konsisten, tanpa error typografi mayor.',
];

export const MOCK_CV_IMPROVEMENTS = [
  'Impact belum menggunakan angka. Tambahkan metrik (persentase, jumlah, waktu).',
  'Portfolio evidence masih minim — tidak ada link project.',
  'Data Analysis disebut tetapi belum memiliki project evidence.',
];

export const MOCK_CV_EVIDENCE: SkillEvidence[] = [
  { skill: 'Data Analysis', level: 'kurang', note: 'Disebut di CV, belum ada bukti project.' },
  { skill: 'Excel', level: 'cukup', note: 'Ada pengalaman kerja, belum ada output yang bisa ditunjukkan.' },
  { skill: 'Dashboard Creation', level: 'belum', note: 'Belum ada evidence sama sekali.' },
  { skill: 'Problem Solving', level: 'kuat', note: 'Terdukung pencapaian di pengalaman kerja.' },
  { skill: 'Communication', level: 'cukup', note: 'Ada, tapi belum terkuantifikasi.' },
];

export const MOCK_ANALYZE_STEPS: AnalyzeStep[] = [
  { label: 'Membaca informasi dasar' },
  { label: 'Memahami pengalaman kerja' },
  { label: 'Memeriksa struktur CV' },
  { label: 'Menganalisis skill & kompetensi' },
  { label: 'Membandingkan dengan standar industri' },
  { label: 'Menyiapkan rekomendasi project' },
];

export const ANALYZE_COVERAGE = [
  { key: '01 · STRUKTUR', title: 'CV Structure' },
  { key: '02 · READY', title: 'ATS Readiness' },
  { key: '03 · IMPACT', title: 'Quantified Impact' },
  { key: '04 · EVIDENCE', title: 'Career Evidence' },
];

export interface CheckItem {
  label: string;
  pass: boolean;
  note: string;
}

export const MOCK_QUALITY_CHECKS: CheckItem[] = [
  { label: 'Struktur & hierarki', pass: true, note: 'Section jelas: summary, experience, skills, education.' },
  { label: 'Konsistensi format', pass: true, note: 'Font, bullet, dan tanggal konsisten di seluruh dokumen.' },
  { label: 'Panjang CV', pass: true, note: '1–2 halaman — ideal untuk level junior.' },
  { label: 'Kontak & link', pass: false, note: 'Belum ada link portfolio atau LinkedIn yang bisa diklik.' },
];

export const MOCK_ATS_CHECKS: CheckItem[] = [
  { label: 'Format dapat dibaca mesin', pass: true, note: 'Tidak ada tabel kompleks atau header/footer tersembunyi.' },
  { label: 'Kata kunci role', pass: true, note: 'Menyebut "data analysis", "excel", "reporting".' },
  { label: 'Judul posisi jelas', pass: true, note: 'Title profesional terbaca di bagian atas.' },
  { label: 'Kata kunci tools modern', pass: false, note: 'SQL, Looker Studio, dan dashboard belum disebut.' },
];

export const MOCK_IMPACT_EXAMPLES = [
  {
    before: 'Membuat laporan penjualan bulanan untuk tim marketing.',
    after: 'Membangun laporan penjualan bulanan yang dipakai 3 tim dan memotong waktu rekap manual 6 jam menjadi 45 menit.',
  },
  {
    before: 'Membantu input data dan administrasi.',
    after: 'Mengelola 2.400+ baris data penjualan dengan error rate di bawah 1% selama 8 bulan.',
  },
  {
    before: 'Terlibat dalam penyusunan dashboard.',
    after: 'Menyusun dashboard penjualan yang dipakai founder untuk weekly review, dengan 5 KPI utama.',
  },
];

export const CV_ACCEPTED_TYPES = ['.pdf', '.docx'];
export const CV_MAX_SIZE_MB = 5;
