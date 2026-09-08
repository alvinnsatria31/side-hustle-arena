import { readFile } from "node:fs/promises";
import { isAbsolute, join, normalize, resolve } from "node:path";
import { isLocalSandboxEnvironment } from "@/server/dev/guard";
import { ArenaDomainError } from "@/server/arena/errors";
import type { JobsAdapter, JobsFetchPage, JobsFetchRequest } from "./contract";

/**
 * A jobs "provider" that is a file on disk.
 *
 * Its purpose is to let the whole pipeline — sync, dedupe, lifecycle, matching,
 * the admin screens, the participant page — be demonstrated and developed with
 * no vendor, no credential and no network. Its second purpose is to be
 * impossible to mistake for a real one in production, which is why it refuses
 * to run outside the local sandbox rather than trusting a config flag: a flag
 * can be set by accident, and fabricated openings shown as live listings would
 * be the single most damaging thing this product could display.
 *
 * The fixture paginates for real (`pageSize`), so cursor and checkpoint
 * behaviour is exercised rather than assumed.
 */

export const FIXTURE_ADAPTER_NAME = "fixture-file";

export function createFixtureAdapter(options: { env?: NodeJS.ProcessEnv; rootDir?: string } = {}): JobsAdapter {
  const env = options.env ?? process.env;
  const root = resolve(options.rootDir ?? process.cwd());
  return {
    name: FIXTURE_ADAPTER_NAME,
    async fetchPage(request: JobsFetchRequest): Promise<JobsFetchPage> {
      if (!isLocalSandboxEnvironment(env)) {
        throw new ArenaDomainError("FORBIDDEN", "The fixture jobs adapter runs only in the local sandbox.");
      }
      const config = request.config as { file?: unknown; pageSize?: unknown };
      if (typeof config.file !== "string" || !config.file) {
        throw new ArenaDomainError("VALIDATION_ERROR", "Fixture source config needs a `file` path.");
      }
      // Repo-relative only: a fixture source must not become a file-read
      // primitive pointed at /etc or a home directory.
      if (isAbsolute(config.file) || config.file.includes("..")) {
        throw new ArenaDomainError("VALIDATION_ERROR", "Fixture `file` must be a repository-relative path.");
      }
      const path = normalize(join(root, config.file));
      if (!path.startsWith(root)) {
        throw new ArenaDomainError("VALIDATION_ERROR", "Fixture `file` must stay inside the repository.");
      }
      const pageSize = Number(config.pageSize ?? 50);
      const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
      const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown[] }).items ?? [];
      if (!Array.isArray(items)) throw new ArenaDomainError("VALIDATION_ERROR", "Fixture file has no items array.");

      const offset = Number(request.cursor ?? 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > items.length) {
        throw new ArenaDomainError("VALIDATION_ERROR", "Fixture cursor is out of range.");
      }
      const page = items.slice(offset, offset + Math.max(1, pageSize));
      const next = offset + page.length;
      return { items: page, nextCursor: next < items.length ? String(next) : null };
    },
  };
}
