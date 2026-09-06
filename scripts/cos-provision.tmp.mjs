// TEMPORARY: inspect / provision the Tencent COS production bucket.
//
//   node scripts/cos-provision.tmp.mjs list
//   node scripts/cos-provision.tmp.mjs create <bucket-name> <region>
//
// COS is S3-compatible, so the AWS SDK already in this repo drives it.
// Bucket names on COS must end in "-<APPID>"; `list` reveals the APPID.
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";

const id = process.env.TENCENT_SECRET_ID;
const key = process.env.TENCENT_SECRET_KEY;
if (!id || !key) throw new Error("TENCENT_SECRET_ID and TENCENT_SECRET_KEY are required.");

const credentials = { accessKeyId: id, secretAccessKey: key };
const [command, bucketArg, regionArg = "ap-jakarta"] = process.argv.slice(2);

const ARENA_ORIGIN = "https://arena.sekolahkarir.id";

function regional(region) {
  return new S3Client({
    region,
    endpoint: `https://cos.${region}.myqcloud.com`,
    credentials,
  });
}

if (command === "list") {
  // The service endpoint lists every bucket on the account, across regions.
  const service = new S3Client({
    region: "ap-jakarta",
    endpoint: "https://service.cos.myqcloud.com",
    credentials,
  });
  const result = await service.send(new ListBucketsCommand({}));
  console.log("owner:", result.Owner?.ID ?? "(unknown)");
  for (const bucket of result.Buckets ?? []) {
    console.log("-", bucket.Name, "| created:", bucket.CreationDate?.toISOString?.() ?? "?");
  }
  const appId = (result.Buckets ?? [])[0]?.Name?.split("-").pop();
  if (appId) console.log("\nAPPID looks like:", appId);
} else if (command === "create") {
  if (!bucketArg) throw new Error("Usage: create <bucket-name> [region]");
  const client = regional(regionArg);
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucketArg }));
    console.log("created bucket:", bucketArg);
  } catch (error) {
    if (error?.name === "BucketAlreadyOwnedByYou" || error?.Code === "BucketAlreadyOwnedByYou") {
      console.log("bucket already exists and is yours:", bucketArg);
    } else {
      throw error;
    }
  }

  // Private by default is what the PRD requires; make it explicit anyway.
  try {
    await client.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucketArg,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }),
    );
    console.log("public access blocked");
  } catch (error) {
    console.log("public-access-block not applied:", error?.name ?? error?.Code ?? "unknown");
  }

  // Without this rule the browser preflight for PUT is refused and no file can
  // ever reach storage from a page — the failure that cost a day in dev.
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucketArg,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [ARENA_ORIGIN],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag", "Content-Disposition"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
  const cors = await client.send(new GetBucketCorsCommand({ Bucket: bucketArg }));
  console.log("CORS rules:", JSON.stringify(cors.CORSRules));
} else {
  throw new Error("Usage: list | create <bucket-name> [region]");
}
