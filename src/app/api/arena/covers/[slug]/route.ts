import { GetObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import { getStorageClient } from "@/server/storage/storage-client";
import { getStorageConfig } from "@/server/storage/config";

export const dynamic = "force-dynamic";

/**
 * Public cover proxy: cards always render this URL when a project has a
 * cover, regardless of where the bytes live (provider HTTPS URL, local
 * public/ path, or private COS key). Private keys never leak — the bucket
 * is read server-side and streamed with a long public cache.
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) return new Response("Not found.", { status: 404 });
  const [project] = await getDb().select().from(projects).where(eq(projects.slug, slug));
  const cover = project?.coverImageUrl;
  if (!cover) return new Response("Not found.", { status: 404 });
  if (cover.startsWith("https://")) {
    return Response.redirect(cover, 302);
  }
  if (cover.startsWith("/arena-covers/")) {
    return Response.redirect(cover, 302);
  }
  try {
    const config = getStorageConfig();
    const object = await getStorageClient().send(new GetObjectCommand({ Bucket: config.bucket, Key: cover }));
    const body = object.Body;
    if (!body) return new Response("Not found.", { status: 404 });
    const stream = (body as { transformToWebStream?: () => ReadableStream }).transformToWebStream
      ? (body as { transformToWebStream: () => ReadableStream }).transformToWebStream()
      : body as ReadableStream;
    return new Response(stream, {
      headers: {
        "content-type": (object.ContentType as string) || "image/png",
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
