# Submission Storage Operations

## Implementation status

- Completed byte-bounded `downloadObjectBytes` helper, actual content signature checks, and immutable snapshot writer with SHA-256 destination verification.
- Completed injected cleanup decision engine: dry-run by default, environment scope, 24-hour expiry grace, consumed-intent and reference protection, reference recheck before delete.
- **Integrated into the submission flow on 2026-09-08** (audit finding A01).
  `finalizeArenaUpload` records the SHA-256 of the bytes it read;
  `submitArenaSubmission` freezes every draft file into a write-once
  `snapshots/` object before allocating a review attempt, and the version row
  references the snapshot key and checksum. The reviewer verifies identity, not
  size. See [`REMEDIATION_2026-09-08.md`](./REMEDIATION_2026-09-08.md).
- Cleanup now also reclaims **consumed** intents whose object nothing references
  any more — the shape an orphan actually takes when a draft item is deleted and
  its object delete fails. Reference lookups decide, not the consumed flag.
- Actual checks: `scripts/storage-integrity.test.mjs` and
  `scripts/submission-immutability.test.mjs` offline, plus
  `npm run test:local:lifecycle`, which uploads through a real presigned PUT to
  the sandbox object store and replays it with equal-size different bytes.
- Still pending: live-bucket verification on the release target (CORS, presign,
  replay) — unchanged by this work.
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
