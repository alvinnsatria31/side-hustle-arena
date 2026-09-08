# Tencent Cloud COS Setup (file bytes backend)

> **Naming note (8 September 2026).** The canonical environment variables are
> `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`,
> `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`. The `TENCENT_COS_*`
> names below are read as a compatibility alias only. Local development runs on
> `http://localhost:3001`, not `:3000`. Follow `.env.example` and
> `src/server/storage/config-core.ts` when provisioning; where this document
> disagrees with them, they win.

Locked decision: file bytes live in Tencent Cloud COS (private bucket,
region `ap-jakarta`); all text/metadata/state lives in Neon. Deploy target is
Vercel. Code side is done (`src/server/storage/`); this doc covers the console
side that only a human with the Tencent account can do.

## 1. Create the bucket

1. Tencent Cloud Console → Cloud Object Storage (COS) → Bucket List → Create Bucket.
2. Name: e.g. `sidehustlearena-<appid>` (the `<appid>` suffix is appended by
   Tencent automatically — copy the FULL name including the suffix).
3. Region: **ap-jakarta** (Singapore `ap-singapore` is the fallback).
4. Access permission: **Private Read/Write**. Never public.
5. Create.

## 2. Restrict CORS to the Vercel domain

Bucket → Security Management → CORS → Add Rule:

- Allowed origin: `https://<vercel-domain>` (production) plus
  `http://localhost:3000` for local dev only — remove localhost before launch.
- Allowed methods: `PUT`, `GET`, `HEAD`.
- Allowed headers: `Content-Type`.
- Expose headers: `ETag`.
- Max age: `600`.

No other origin. The browser only ever uses short-lived presigned URLs, so a
tight CORS list costs nothing and kills whole classes of abuse.

## 3. Create a least-privilege key pair (CAM)

1. CAM → Users → Create User (sub-account, NOT the root account).
2. Attach a custom policy limited to this bucket (replace names):

```json
{
  "version": "2.0",
  "statement": [
    {
      "effect": "allow",
      "action": [
        "cos:PutObject",
        "cos:GetObject",
        "cos:HeadObject",
        "cos:DeleteObject",
        "cos:PostObject"
      ],
      "resource": ["qcs::cos:ap-jakarta:uid/<appid>:sidehustlearena-<appid>/*"]
    }
  ]
}
```

3. Create an API key pair for that user → `SecretId` + `SecretKey`.

## 4. Wire the keys (local dev .env, one pair per line, no stray lines)

```ini
APP_ENV=development
TENCENT_COS_BUCKET=sidehustlearena-<appid>
TENCENT_COS_REGION=ap-jakarta
TENCENT_COS_SECRET_ID=<SecretId>
TENCENT_COS_SECRET_KEY=<SecretKey>
```

Notes:

- Do NOT set `TENCENT_COS_ENDPOINT` unless Tencent support tells you to: the
  app derives the regional endpoint `https://cos.ap-jakarta.myqcloud.com`
  automatically. A bucket-scoped endpoint doubles the bucket in the host and
  breaks TLS (caught by `test:e2e:storage`).
- Never commit `.env`. On Vercel, paste the same five names into Project
  Settings → Environment Variables (`APP_ENV=production` there).

## 5. Verify end to end

```bash
npm run test:e2e:storage
```

Expected: `live object-storage roundtrip … ✔` (presign PUT → upload → HEAD →
presigned GET → byte-identical → delete). Failure cheat-sheet:

| Symptom | Meaning | Fix |
|---|---|---|
| TLS cert hostname error | bucket-scoped endpoint configured | unset `*_ENDPOINT`, let derivation work |
| HTTP 403 on PUT | wrong secret, wrong bucket/appid, or CAM policy missing `PutObject` | re-copy pair from CAM, check policy JSON resource ARN |
| HTTP 400 `SignatureDoesNotMatch` | region mismatch (bucket not in ap-jakarta) | match `TENCENT_COS_REGION` to the real bucket region |
| CORS error in browser only | origin not allowlisted | add the exact Vercel origin in bucket CORS |
