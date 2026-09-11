import { z } from "zod";

/**
 * The seam a real jobs provider plugs into.
 *
 * No vendor has been chosen, and inventing one would be worse than leaving the
 * gap honest: a fabricated integration is indistinguishable from a working one
 * until the day someone tries it. So the whole pipeline — normalization,
 * deduplication, lifecycle, matching, API, UI, scheduling — is built and tested
 * against this interface, and connecting a real board means writing one adapter
 * and inserting one `job_sources` row. Nothing in the business logic below this
 * line knows a provider's name.
 *
 * A `JobsAdapter` returns ONE page at a time and says how to ask for the next.
 * Cursor rather than offset: an offset silently skips or repeats rows when the
 * feed changes underneath a paginated read, which is exactly what happens on a
 * job board.
 */

/** What an adapter is handed for one page request. */
export interface JobsFetchRequest {
  /** Non-secret wiring from the `job_sources` row. */
  config: Record<string, unknown>;
  /** Resolved credential, if the source names an environment variable. */
  credential?: string;
  /** Opaque continuation token from the previous page, or the stored cursor. */
  cursor?: string | null;
  /** Bounds this page. Callers pass their remaining execution budget. */
  signal?: AbortSignal;
}

/** One page of raw provider records, plus how to continue. */
export interface JobsFetchPage {
  /** Raw, provider-shaped records. Normalization happens after this. */
  items: unknown[];
  /** Pass back as `cursor` for the next page; null/undefined ends the sync. */
  nextCursor?: string | null;
  /**
   * Provider rate-limit hint, in milliseconds. The sync waits this long before
   * the next page rather than guessing, and clamps it so a hostile or broken
   * header cannot stall a worker indefinitely.
   */
  retryAfterMs?: number;
}

export interface JobsAdapter {
  readonly name: string;
  fetchPage(request: JobsFetchRequest): Promise<JobsFetchPage>;
}

/**
 * Field mapping, so a provider's JSON shape is configuration rather than code.
 *
 * Each entry is a dotted path into a provider record. A provider that nests
 * `company.name` needs a config change, not a new adapter.
 */
export const fieldMapSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  workMode: z.string().optional(),
  employmentType: z.string().optional(),
  description: z.string().optional(),
  requiredSkills: z.string().optional(),
  preferredSkills: z.string().optional(),
  applicationUrl: z.string().min(1),
  postedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
  salaryCurrency: z.string().optional(),
  salaryPeriod: z.string().optional(),
}).strict();

export type FieldMap = z.infer<typeof fieldMapSchema>;

/**
 * Everything an HTTP JSON feed needs, and nothing secret.
 *
 * `authHeader` names the header a credential is sent in; the credential itself
 * comes from `job_sources.credentialEnvVar`, so nothing here can leak a token
 * into a database dump, an audit row or an admin screen.
 */
export const httpJsonSourceConfigSchema = z.object({
  /**
   * Credential-free HTTPS, with one exception: a loopback HTTP address, so the
   * ingestion path can be exercised against a local fixture server. The sync
   * service refuses a non-HTTPS feed outside the local sandbox, so the
   * exception cannot travel — see `assertFeedTransportAllowed`.
   */
  baseUrl: z.url().refine((value) => {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  }, "Feed URLs must be credential-free HTTPS (or a loopback address for local fixtures)."),
  /** Extra non-secret query parameters, e.g. a country or category filter. */
  query: z.record(z.string(), z.string()).default({}),
  /** Non-secret headers, e.g. Accept. Never put a token here. */
  headers: z.record(z.string(), z.string()).default({}),
  /** Header the credential is sent in, e.g. "Authorization". */
  authHeader: z.string().min(1).optional(),
  /** Prefix for the credential value, e.g. "Bearer ". */
  authScheme: z.string().default(""),
  /** Dotted path to the array of records in the response body. */
  itemsPath: z.string().default("items"),
  /** Dotted path to the next-page token, if the provider returns one. */
  nextCursorPath: z.string().optional(),
  /** Query parameter used to send the cursor back, e.g. "page_token". */
  cursorParam: z.string().default("cursor"),
  fieldMap: fieldMapSchema,
  /** Per-request ceiling; the sync's own budget can shorten it, never extend it. */
  timeoutMs: z.number().int().min(1_000).max(30_000).default(10_000),
  /** Attempts per page, including the first. */
  maxAttempts: z.number().int().min(1).max(5).default(3),
  /** Deliberate pause between pages, to stay under a provider's rate limit. */
  pageDelayMs: z.number().int().min(0).max(10_000).default(0),
  /** Safety stop: a feed that never ends must not run forever. */
  maxPages: z.number().int().min(1).max(200).default(20),
  /** Display only: the provider's public site, shown to operators. Never fetched. */
  siteUrl: z.url().refine((value) => new URL(value).protocol === "https:", "siteUrl must be an https:// address").optional(),
  /** Display only: an operator's label for what the feed lists, e.g. "Teknologi". */
  category: z.string().trim().min(1).max(60).optional(),
}).strict();

export type HttpJsonSourceConfig = z.infer<typeof httpJsonSourceConfigSchema>;

/** Read a dotted path out of an arbitrary JSON value, without throwing. */
export function readPath(value: unknown, path: string): unknown {
  if (!path) return undefined;
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
