/**
 * Limits for the CV scan, shared by the browser (to warn early) and the API
 * route (which enforces them). The client copy is a courtesy; the server never
 * trusts it.
 *
 * No `server-only` marker: this is plain data with no runtime dependency, so
 * the dropzone can import the same numbers it is validated against.
 */

export const CV_MAX_SIZE_MB = 5;
export const CV_MAX_SIZE_BYTES = CV_MAX_SIZE_MB * 1024 * 1024;

/** Extensions the extractor can turn into text reliably. */
export const CV_ACCEPTED_EXTENSIONS = [".pdf", ".docx"] as const;

/** Browsers disagree about docx; accept the known spellings and fall back to extension. */
export const CV_ACCEPTED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

/**
 * The scanner is hidden until its backend has been exercised against real CVs.
 * One variable flips both the navigation entries and the API route, so the
 * feature cannot be half-launched — a visible link with a dead endpoint, or a
 * live endpoint nobody audited.
 */
export function isCvScannerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CV_SCANNER_ENABLED === "true";
}
