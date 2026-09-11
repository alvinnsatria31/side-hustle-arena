/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Self-hosted deployment (Sekolah Karir VPS, Docker). `next build` emits
   * `.next/standalone` with a minimal `server.js` and only the traced
   * `node_modules`, so the runtime image needs no `npm install`. See
   * docs/backend/DEPLOY_SK_VPS.md. Vercel ignores this key, so it is safe to
   * keep set while both targets exist.
   */
  output: "standalone",
  images: {
    contentDispositionType: 'inline',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },

  /**
   * Ship the packages officeparser reaches for at runtime.
   *
   * officeparser loads `file-type` and `pdfjs-dist` through
   * `require.resolve(String('file-type'))` — a form written specifically to be
   * opaque to bundlers, so neither webpack nor Next's file tracer can see it.
   * The result was invisible: the deployed trace for /api/cv-scan listed 110
   * files and not one of them belonged to pdfjs-dist, so every PDF and DOCX
   * upload died in 53ms without reaching a single byte of the document, while
   * the same file parsed fine locally where node_modules is complete.
   *
   * Keeping officeparser external stops webpack inlining it, so its internal
   * resolution behaves the way it does on a developer machine. The includes
   * below then guarantee the two packages it resolves to actually arrive.
   *
   * Scoped to the routes that extract documents — /api/cv-scan and the review
   * pipeline that reads participant submissions — rather than every function,
   * because these packages are ~49 MB and most routes never touch them.
   */
  serverExternalPackages: ['officeparser'],
  outputFileTracingIncludes: {
    '/api/cv-scan': [
      'node_modules/officeparser/**/*',
      'node_modules/pdfjs-dist/**/*',
      'node_modules/file-type/**/*',
    ],
    '/api/internal/**': [
      'node_modules/officeparser/**/*',
      'node_modules/pdfjs-dist/**/*',
      'node_modules/file-type/**/*',
    ],
    '/api/dev/**': [
      'node_modules/officeparser/**/*',
      'node_modules/pdfjs-dist/**/*',
      'node_modules/file-type/**/*',
    ],
  },
};

export default nextConfig;
