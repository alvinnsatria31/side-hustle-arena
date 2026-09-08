import { httpJsonSourceConfigSchema, readPath, type JobsAdapter, type JobsFetchPage, type JobsFetchRequest } from "./contract";

/**
 * The one adapter a public or token-authenticated JSON feed needs.
 *
 * Deliberately boring: it fetches a page, retries transient failures with
 * backoff, honours a Retry-After, and hands the raw records on. It does not
 * normalize, does not know what a "job" is, and does not decide anything about
 * lifecycle — so a second provider with a different shape is a config change
 * (see `fieldMap`) rather than a fork of the pipeline.
 *
 * `fetchImpl` is injectable so the whole ingestion path can be tested against
 * a local fixture server with no vendor involved.
 */

export class JobsFeedError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "JobsFeedError";
    this.code = code;
    this.retryable = retryable;
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_BODY_BYTES = 5 * 1024 * 1024;

function backoffMs(attempt: number): number {
  return Math.min(4_000, 250 * 2 ** (attempt - 1));
}

/** Retry-After is either seconds or an HTTP date; both are clamped. */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.min(Math.max(0, date - now), 60_000);
}

export function createHttpJsonAdapter(
  options: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): JobsAdapter {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return {
    name: "http-json",
    async fetchPage(request: JobsFetchRequest): Promise<JobsFetchPage> {
      const parsed = httpJsonSourceConfigSchema.safeParse(request.config);
      if (!parsed.success) {
        throw new JobsFeedError("SOURCE_CONFIG_INVALID", `Source configuration is invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`, false);
      }
      const config = parsed.data;

      const url = new URL(config.baseUrl);
      for (const [key, value] of Object.entries(config.query)) url.searchParams.set(key, value);
      if (request.cursor) url.searchParams.set(config.cursorParam, request.cursor);

      const headers = new Headers({ accept: "application/json", ...config.headers });
      if (config.authHeader && request.credential) {
        headers.set(config.authHeader, `${config.authScheme}${request.credential}`);
      }

      let lastError: JobsFeedError | undefined;
      for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
        // Reported in this module's own vocabulary rather than as a raw
        // AbortError, so a caller reading `error.code` sees one taxonomy.
        if (request.signal?.aborted) {
          throw new JobsFeedError("FEED_BUDGET_EXCEEDED", "Ran out of execution budget while reading the feed.", false);
        }
        // The caller's budget bounds this as well as the per-request ceiling:
        // three attempts at ten seconds must not outlive a 45s invocation.
        const perRequest = AbortSignal.timeout(config.timeoutMs);
        const signal = request.signal ? AbortSignal.any([request.signal, perRequest]) : perRequest;
        try {
          const response = await doFetch(url, { method: "GET", headers, redirect: "error", signal });
          if (!response.ok) {
            const retryable = RETRYABLE_STATUS.has(response.status);
            const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
            lastError = new JobsFeedError(
              response.status === 429 ? "FEED_RATE_LIMITED" : `FEED_HTTP_${response.status}`,
              `Feed responded ${response.status}.`,
              retryable,
            );
            if (!retryable || attempt === config.maxAttempts) throw lastError;
            await sleep(retryAfter ?? backoffMs(attempt));
            continue;
          }

          const length = Number(response.headers.get("content-length") ?? "0");
          if (length > MAX_BODY_BYTES) throw new JobsFeedError("FEED_BODY_TOO_LARGE", "Feed page exceeds the size limit.", false);
          const text = await response.text();
          if (text.length > MAX_BODY_BYTES) throw new JobsFeedError("FEED_BODY_TOO_LARGE", "Feed page exceeds the size limit.", false);

          let body: unknown;
          try {
            body = JSON.parse(text);
          } catch {
            throw new JobsFeedError("FEED_NOT_JSON", "Feed page was not valid JSON.", false);
          }
          const items = readPath(body, config.itemsPath);
          if (!Array.isArray(items)) {
            throw new JobsFeedError("FEED_SHAPE_INVALID", `Feed page has no array at "${config.itemsPath}".`, false);
          }
          const next = config.nextCursorPath ? readPath(body, config.nextCursorPath) : undefined;
          return {
            items,
            nextCursor: typeof next === "string" && next ? next : null,
            retryAfterMs: config.pageDelayMs || undefined,
          };
        } catch (error) {
          if (error instanceof JobsFeedError) {
            if (!error.retryable || attempt === config.maxAttempts) throw error;
            lastError = error;
            await sleep(backoffMs(attempt));
            continue;
          }
          // An abort from the CALLER's budget is terminal; one from our own
          // per-request timeout is worth another attempt.
          if (request.signal?.aborted) throw new JobsFeedError("FEED_BUDGET_EXCEEDED", "Ran out of execution budget while reading the feed.", false);
          lastError = new JobsFeedError("FEED_UNREACHABLE", error instanceof Error ? error.message.slice(0, 200) : "Feed request failed.", true);
          if (attempt === config.maxAttempts) throw lastError;
          await sleep(backoffMs(attempt));
        }
      }
      throw lastError ?? new JobsFeedError("FEED_UNREACHABLE", "Feed request failed.", true);
    },
  };
}
