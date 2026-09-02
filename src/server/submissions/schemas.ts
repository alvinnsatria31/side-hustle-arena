import { z } from "zod";

export const supportedFileMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const uuid = z.uuid();
const filename = z.string().trim().min(1).max(255).regex(/^[^\\/\u0000]+$/);

export const uploadPresignSchema = z.object({
  requirementId: uuid,
  filename,
  mimeType: z.enum(supportedFileMimeTypes),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
}).strict();

export const draftLinkSchema = z.object({
  requirementId: uuid,
  url: z.string().trim().max(2_048).url().refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  }, "Links must be credential-free HTTPS URLs."),
  label: z.string().trim().min(1).max(200).optional(),
}).strict();

export const draftSubmissionSchema = z.object({
  explanation: z.string().trim().max(10_000).nullable().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
}).strict();
