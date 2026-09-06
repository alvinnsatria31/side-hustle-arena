/**
 * Builds the CV Scanner end-to-end fixtures in qa-files/:
 *
 *   cv-sample.pdf   a one-page, text-bearing PDF (Helvetica, real /Contents)
 *   cv-sample.docx  a minimal but valid WordprocessingML document
 *
 * Neither file is a screenshot or an empty page: both carry the same CV text,
 * so the extractor has something real to pull and the analyzer has something
 * real to judge. The CV itself is written with deliberate, catchable flaws
 * (a skill that never appears in the experience section, an ambiguous date
 * range, achievements stated as duties) so a live analysis has findings to
 * report rather than a bland pass.
 *
 * Run:  node scripts/cv-fixtures.mjs
 * The two outputs are committed; re-run only when the sample text changes.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { zipSync, strToU8 } from "fflate";

const QA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "qa-files");

/** The sample CV, as ordered lines. Kept ASCII so PDF WinAnsi is a non-issue. */
const CV_LINES = [
  "RANGGA WIJAYA",
  "Data Analyst (Junior)",
  "Bandung, Indonesia  |  rangga.wijaya.data@gmail.com  |  +62 812-3456-7890",
  "LinkedIn: linkedin.com/in/ranggawijaya  |  Portofolio: ranggawijaya.github.io",
  "",
  "RINGKASAN",
  "Lulusan Statistika yang fokus pada analisis data produk dan pelaporan bisnis.",
  "Terbiasa bekerja dengan SQL dan Python untuk membersihkan serta memodelkan data,",
  "dan membangun dashboard yang dipakai tim non-teknis untuk mengambil keputusan.",
  "",
  "PENGALAMAN",
  "Data Analyst Intern - PT Niaga Digital Nusantara",
  "Januari 2024 - Sekarang",
  "- Membangun pipeline pembersihan data transaksi harian memakai Python dan SQL,",
  "  menurunkan waktu penyusunan laporan mingguan dari 6 jam menjadi 1 jam (-83%).",
  "- Membuat dashboard penjualan untuk tim marketing dan operasional.",
  "- Menyiapkan analisis kohort retensi yang dipakai pada rapat bulanan manajemen.",
  "",
  "Asisten Riset - Laboratorium Statistika Terapan, Universitas Padjadjaran",
  "2022 - 2023",
  "- Mengolah data survei 1.200 responden dengan R dan SPSS.",
  "- Menulis dokumentasi metodologi untuk tiga proyek dosen.",
  "",
  "PENDIDIKAN",
  "S1 Statistika - Universitas Padjadjaran",
  "2020 - 2024  |  IPK 3.42 / 4.00",
  "Skripsi: prediksi churn pelanggan e-commerce dengan gradient boosting.",
  "",
  "KEAHLIAN",
  "SQL, Python (pandas, scikit-learn), R, Microsoft Excel, Tableau, Power BI, Git",
  "",
  "SERTIFIKASI",
  "Google Data Analytics Professional Certificate - 2023",
  "Kredensial: coursera.org/verify/XXXXXXX",
  "",
  "ORGANISASI",
  "Anggota Himpunan Mahasiswa Statistika - Divisi Riset dan Keilmuan (2021 - 2022)",
].map((line) => line.replace(/[^\x20-\x7E]/g, "-")); // keep it strictly Latin-1 printable

const CV_PLAINTEXT = CV_LINES.join("\n");

// --------------------------------------------------------------------------
// PDF: hand-built so it does not depend on a headless browser. One page, one
// Helvetica font, one uncompressed content stream, a correct xref table.
// --------------------------------------------------------------------------

function pdfEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(lines) {
  const leading = 15;
  const top = 780;
  const left = 54;

  const streamParts = ["BT", `/F1 10.5 Tf`, `${leading} TL`, `${left} ${top} Td`];
  lines.forEach((line, index) => {
    if (index > 0) streamParts.push("T*");
    streamParts.push(`(${pdfEscape(line)}) Tj`);
  });
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

// --------------------------------------------------------------------------
// DOCX: a real .docx is a zip of OOXML parts. Built with fflate so the bytes
// are ours, not round-tripped through the same library that reads them back.
// --------------------------------------------------------------------------

function xmlEscape(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDocx(lines) {
  const paragraphs = lines
    .map((line) =>
      line === ""
        ? "<w:p/>"
        : `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`,
    )
    .join("");

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paragraphs}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const zipped = zipSync(
    {
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(rootRels),
      "word/document.xml": strToU8(documentXml),
    },
    { level: 6 },
  );
  return Buffer.from(zipped);
}

// deflateRawSync is imported to prove zlib is available for a hand-rolled zip
// fallback; fflate is the path actually used. Keep the import referenced.
void deflateRawSync;

const pdf = buildPdf(CV_LINES);
const docx = buildDocx(CV_LINES);

writeFileSync(join(QA_DIR, "cv-sample.pdf"), pdf);
writeFileSync(join(QA_DIR, "cv-sample.docx"), docx);
writeFileSync(join(QA_DIR, "cv-sample.txt"), CV_PLAINTEXT + "\n");

console.log(`cv-sample.pdf   ${pdf.length} bytes`);
console.log(`cv-sample.docx  ${docx.length} bytes`);
console.log(`cv-sample.txt   ${Buffer.byteLength(CV_PLAINTEXT) + 1} bytes (reference plaintext)`);
