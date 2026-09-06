'use client';

import type { CvResult } from '@/types/cv';
import type { CvSaveStatus } from '@/server/cv/history';

/**
 * Browser side of the CV scan.
 *
 * The upload page and the analyzing page are separate routes, and a `File`
 * cannot survive a route change through the demo store (it is not
 * serialisable). So the request is started on the upload page and the
 * in-flight promise is parked here, at module scope, where the next route
 * picks it up. Same JS context, so a soft navigation keeps it; a hard reload
 * loses it, which is exactly when the analyzing page should send the visitor
 * back to choose a file again.
 */

let pending: Promise<CvResult> | null = null;
let lastSave: { analyzedAt: string; save: CvSaveStatus } | null = null;

export function cvSaveStatus(analyzedAt: string): CvSaveStatus | null {
  return lastSave?.analyzedAt === analyzedAt ? lastSave.save : null;
}

export class CvScanError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'CvScanError';
    this.status = status;
  }
}

async function postScan(file: File, saveHistory: boolean): Promise<CvResult> {
  const body = new FormData();
  body.append('file', file);
  if (saveHistory) body.append('saveHistory', 'true');
  let response: Response;
  try {
    response = await fetch('/api/cv-scan', { method: 'POST', body, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new CvScanError('Koneksi terputus saat mengirim CV. Coba lagi.', 0);
  }
  const payload = (await response.json().catch(() => null)) as
    | { data?: { result?: CvResult; save?: CvSaveStatus }; error?: { message?: string } }
    | null;
  if (!response.ok || payload?.error || !payload?.data?.result) {
    throw new CvScanError(payload?.error?.message ?? 'Analisis CV gagal. Coba lagi.', response.status);
  }
  lastSave = { analyzedAt: payload.data.result.analyzedAt, save: payload.data.save ?? { status: 'not_requested' } };
  return payload.data.result;
}

/** Begin a scan and park it for the analyzing route to await. */
export function startCvScan(file: File, saveHistory = false): Promise<CvResult> {
  // Swallow rejection here so parking an eventually-failed promise never
  // surfaces as an unhandled rejection; the awaiting page still sees it.
  lastSave = null;
  const request = postScan(file, saveHistory);
  request.catch(() => undefined);
  pending = request;
  return request;
}

/** The parked scan, if this navigation followed an upload. */
export function pendingCvScan(): Promise<CvResult> | null {
  return pending;
}

export function clearCvScan(): void {
  pending = null;
}
