import { extname } from 'node:path';

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
  const ext = extname(filename).slice(1).toLowerCase();
  const fileType = mime === 'text/html' ? 'html' : mime === 'text/csv' || ext === 'csv' ? 'csv' : undefined;
  const ast = await parseOffice(bytes, {
    fileType, abortSignal: AbortSignal.timeout(60000), ocr: false,
    decompressionLimits: { maxUncompressedBytes: 80 * 1024 * 1024, maxZipEntries: 3000 },
  });
  const text = ast.toText().trim();
  if (text.length < 12) throw new Error('Document has insufficient readable text; manual inspection is required.');
  return text;
}
