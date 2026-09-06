# Submission Storage Operations

## Implementation status

- Completed byte-bounded `downloadObjectBytes` helper, actual content signature checks, and immutable snapshot writer with SHA-256 destination verification.
- Completed injected cleanup decision engine: dry-run by default, environment scope, 24-hour expiry grace, consumed-intent and reference protection, reference recheck before delete.
- Actual check: `node --import ./scripts/node-test-hooks.mjs --test scripts/storage-integrity.test.mjs` passed 6/6 tests on 2026-09-05. Node emitted the existing module-type warning.
- Pending: submission integration, authenticated cleanup route, historical download ownership tests, final type/lint checks.
- No live bucket calls, migration writes, or credential values were used in these tests.

## Extraction helper contract

Import `downloadObjectBytes` from `@/server/storage` and call
`downloadObjectBytes(storageKey, { maxBytes?, expectedSizeBytes?, expectedChecksum? })`.
The result is `{ bytes: Buffer, checksum: string, sizeBytes: number, mimeType: string | null }`.
The checksum is lowercase SHA-256 hex. Reads have a hard 20 MiB ceiling and a
30-second abort signal. Pass the version item's checksum and size for extraction.
Authorization is the caller's responsibility; this is a trusted server helper,
not an endpoint that accepts arbitrary object keys from users.

The parent owns dependency declarations. `fflate` is used directly for bounded
Office ZIP manifest inspection and must be declared directly by the parent.
