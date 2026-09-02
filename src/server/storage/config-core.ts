import { z } from "zod";

const r2ConfigSchema = z.object({
  accountId: z.string().trim().min(1),
  accessKeyId: z.string().trim().min(1),
  secretAccessKey: z.string().trim().min(1),
  bucketName: z.string().trim().min(3).max(63).regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/),
  endpoint: z.string().url().refine((value) => new URL(value).protocol === "https:", "R2 endpoint must use HTTPS."),
});

export type R2Config = z.infer<typeof r2ConfigSchema>;

export function parseR2Config(input: unknown, environment: string): R2Config {
  if (environment !== "development") throw new Error("R2 is configured only for development in this phase.");
  const parsed = r2ConfigSchema.safeParse(input);
  if (!parsed.success || new URL(parsed.data.endpoint).hostname !== `${parsed.data.accountId}.r2.cloudflarestorage.com`) {
    throw new Error("Invalid development R2 configuration.");
  }
  return parsed.data;
}
