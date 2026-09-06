// TEMPORARY operator script: read or set the bucket CORS rule. Delete when done.
//
//   node scripts/cos-cors.tmp.mjs show    -> print the rule the bucket has now
//   node scripts/cos-cors.tmp.mjs apply   -> write the rule the browser needs
//
// The browser PUTs straight to Tencent COS with a presigned URL. Without a CORS
// rule the preflight is refused and no file can ever leave a page, which is
// invisible to every Node test because Node does not enforce CORS.
import nextEnv from "@next/env";
import { createHash } from "node:crypto";
import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";

nextEnv.loadEnvConfig(process.cwd());

const bucket = process.env.TENCENT_COS_BUCKET;
const region = process.env.TENCENT_COS_REGION;
const accessKeyId = process.env.TENCENT_COS_SECRET_ID;
const secretAccessKey = process.env.TENCENT_COS_SECRET_KEY;
for (const [name, value] of Object.entries({ bucket, region, accessKeyId, secretAccessKey })) {
  if (!value) throw new Error(`Missing ${name} in .env`);
}

const client = new S3Client({
  region,
  // Tencent COS rejects the x-amz-checksum-* headers the AWS SDK now adds by
  // default on this operation, answering InvalidRequest.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  endpoint: `https://cos.${region}.myqcloud.com`,
  forcePathStyle: false,
  credentials: { accessKeyId, secretAccessKey },
});

// Tencent COS still requires Content-MD5 on this operation; the AWS SDK stopped
// sending it when it moved to x-amz-checksum-*. Added at the build step so the
// signature covers it.
client.middlewareStack.add(
  (next) => async (args) => {
    const body = args.request?.body;
    if (typeof body === "string") {
      args.request.headers["Content-MD5"] = createHash("md5").update(body, "utf8").digest("base64");
    }
    return next(args);
  },
  { step: "build", name: "tencentContentMd5" },
);

// Only what the upload flow actually needs. GET and HEAD cover the signed
// download and the metadata check; content-type is the one header the presigned
// PUT requires; ETag is the only response header worth exposing.
const RULES = [
  {
    AllowedOrigins: ["http://localhost:3001", "https://arena.sekolahkarir.id"],
    AllowedMethods: ["GET", "PUT", "HEAD"],
    AllowedHeaders: ["content-type"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 600,
  },
];

async function show(label) {
  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    console.log(`${label}:`, JSON.stringify(current.CORSRules, null, 2));
    return current.CORSRules;
  } catch (error) {
    console.log(`${label}: (tidak ada aturan CORS) — ${error.name}`);
    return null;
  }
}

async function probe(origin) {
  const response = await fetch(`https://${bucket}.cos.${region}.myqcloud.com/arena/development/cors-probe`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "PUT",
      "access-control-request-headers": "content-type",
    },
  });
  const allowed = response.headers.get("access-control-allow-origin");
  console.log(`  preflight ${origin}: HTTP ${response.status}, allow-origin=${allowed ?? "(tidak ada)"}`);
  return allowed === origin || allowed === "*";
}

const mode = process.argv[2];

if (mode === "show") {
  await show("SEKARANG");
  await probe("http://localhost:3001");
} else if (mode === "apply") {
  await show("SEBELUM");
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: RULES } }));
  console.log("\naturan CORS dikirim.\n");
  await show("SESUDAH");
  console.log("\nverifikasi langsung dari sisi browser:");
  const ok = await probe("http://localhost:3001");
  await probe("https://arena.sekolahkarir.id");
  console.log(ok ? "\nBERHASIL — upload dari browser sekarang diizinkan." : "\nBELUM — preflight masih ditolak, mungkin butuh beberapa detik untuk menyebar.");
} else {
  console.error("usage: node scripts/cos-cors.tmp.mjs show|apply");
  process.exitCode = 1;
}
