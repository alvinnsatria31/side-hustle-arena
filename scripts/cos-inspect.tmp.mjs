// TEMPORARY, read-only: report the production bucket's CORS and ACL posture.
import { S3Client, GetBucketCorsCommand, GetBucketAclCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";

const credentials = {
  accessKeyId: process.env.TENCENT_SECRET_ID,
  secretAccessKey: process.env.TENCENT_SECRET_KEY,
};
const bucket = process.argv[2] ?? "sidehustlearena-prod-1468190043";
const region = process.argv[3] ?? "ap-jakarta";
const client = new S3Client({ region, endpoint: `https://cos.${region}.myqcloud.com`, credentials });

async function show(label, run) {
  try {
    console.log(label, JSON.stringify(await run()));
  } catch (error) {
    console.log(label, "ERROR:", error?.name ?? error?.Code ?? String(error).slice(0, 120));
  }
}

console.log("bucket:", bucket, "region:", region);
await show("location:", async () => (await client.send(new GetBucketLocationCommand({ Bucket: bucket }))).LocationConstraint ?? null);
await show("cors    :", async () => (await client.send(new GetBucketCorsCommand({ Bucket: bucket }))).CORSRules);
await show("acl     :", async () =>
  (await client.send(new GetBucketAclCommand({ Bucket: bucket }))).Grants?.map((g) => ({
    grantee: g.Grantee?.URI ?? g.Grantee?.ID,
    permission: g.Permission,
  })),
);
