import { extname } from 'node:path';

/** Hints officeparser understands; anything else falls back to auto-detection. */
type OfficeFileType = 'docx' | 'pptx' | 'xlsx' | 'odt' | 'odp' | 'ods' | 'pdf' | 'rtf' | 'md' | 'html' | 'csv' | 'epub';
const EXT_TO_FILE_TYPE: Record<string, OfficeFileType> = {
  pdf: 'pdf',
  docx: 'docx',
  pptx: 'pptx',
  xlsx: 'xlsx',
  odt: 'odt',
  odp: 'odp',
  ods: 'ods',
  rtf: 'rtf',
  md: 'md',
  html: 'html',
  csv: 'csv',
  epub: 'epub',
};

const MIME_TO_FILE_TYPE: Record<string, OfficeFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/html': 'html',
  'text/csv': 'csv',
  'text/markdown': 'md',
};

function inferFileType(filename: string, mime: string): OfficeFileType | undefined {
  const ext = extname(filename).slice(1).toLowerCase();
  if (ext && EXT_TO_FILE_TYPE[ext]) return EXT_TO_FILE_TYPE[ext];
  if (mime && MIME_TO_FILE_TYPE[mime]) return MIME_TO_FILE_TYPE[mime];
  return undefined;
}

export async function extractDocumentText(bytes: Buffer, filename: string, mime: string): Promise<string> {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Invalid document size.');
  if (mime.startsWith('image/')) {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(process.env.ARENA_OCR_LANGUAGE || 'eng');
    const timer = setTimeout(() => { void worker.terminate(); }, 60000);
    try { return (await worker.recognize(bytes)).data.text.trim(); }
    finally { clearTimeout(timer); await worker.terminate(); }
  }
  if (mime === 'text/plain') return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
  const { parseOffice } = await import('officeparser');
  // officeparser auto-detects the format from magic bytes via `file-type`, but
  // that detection fails inside the Next runtime (Turbopack bundle): PDF
  // uploads were rejected while the same bytes extract fine in plain Node.
  // We always know the extension/MIME from the upload, so pass it explicitly.
  const fileType = inferFileType(filename, mime);
  const ast = await parseOffice(bytes, {
    fileType, abortSignal: AbortSignal.timeout(60000), ocr: false,
    decompressionLimits: { maxUncompressedBytes: 80 * 1024 * 1024, maxZipEntries: 3000 },
  });
  const text = ast.toText().trim();
  if (text.length < 12) throw new Error('Document has insufficient readable text; manual inspection is required.');
  return text;
}
