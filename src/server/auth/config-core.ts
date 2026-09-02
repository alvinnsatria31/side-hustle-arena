import { z } from "zod";

const rawConfigSchema = z.object({
  arenaOrigin: z.string().url(),
  canonicalOrigin: z.string().url(),
  clientId: z.literal("arena"),
  clientSecret: z.string().min(32),
  introspectionIntervalSeconds: z.coerce.number().int().min(30).max(300).default(60),
  allowedOrigins: z.array(z.string().url()).min(1),
});

export type ArenaAuthConfig = z.infer<typeof rawConfigSchema>;

function parseOrigin(value: string, environment: string | undefined, productionArena: boolean): string {
  try {
    const url = new URL(value);
    const isRootOrigin = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
    const isLocalHttp = environment !== "production" && url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    const isSecure = url.protocol === "https:";
    if (!isRootOrigin || (!isSecure && !isLocalHttp)) throw new Error("invalid");
    if (productionArena && url.origin !== "https://arena.sekolahkarir.id") throw new Error("invalid");
    return url.origin;
  } catch {
    throw new Error("Arena auth configuration is invalid.");
  }
}

export function parseArenaAuthConfig(input: unknown, environment = process.env.NODE_ENV): ArenaAuthConfig {
  const result = rawConfigSchema.safeParse(input);
  if (!result.success) throw new Error("Arena auth configuration is invalid.");

  const arenaOrigin = parseOrigin(result.data.arenaOrigin, environment, environment === "production");
  const canonicalOrigin = parseOrigin(result.data.canonicalOrigin, environment, false);
  const allowedOrigins = result.data.allowedOrigins.map((origin) => parseOrigin(origin, environment, false));
  if (environment === "production" && allowedOrigins.some((origin) => origin !== arenaOrigin)) {
    throw new Error("Arena auth configuration is invalid.");
  }

  return { ...result.data, arenaOrigin, canonicalOrigin, allowedOrigins };
}
