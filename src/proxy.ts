import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CENTRAL_ADMIN_ENV, redirectsToCentral, resolveCentralAdmin } from "@/server/admin/central-admin";

/**
 * Legacy admin console → unified admin, when and only when it is switched on.
 *
 * Runs for the console's own pages and nothing else (see `config.matcher`):
 * `/api/internal/*` is what the unified admin calls, and redirecting it would
 * cut the panel off from the data it exists to manage.
 *
 * Read per request, on the Node.js runtime, so the switch is an environment
 * variable and a container restart — not a rebuild. See
 * src/server/admin/central-admin.ts and docs/UNIFIED-ADMIN-HANDOFF.md.
 */
let reportedProblem: string | undefined;

export function proxy(request: NextRequest) {
  const target = resolveCentralAdmin();
  if (target.enabled) {
    // Sections the central panel cannot do yet stay where they work.
    if (!redirectsToCentral(request.nextUrl.pathname)) return NextResponse.next();
    // 307, not 308: this is reversible by design, and a browser that cached a
    // permanent redirect would keep sending operators away after a rollback.
    const response = NextResponse.redirect(target.url, 307);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  if (target.reason === "invalid" && reportedProblem !== target.problem) {
    // Once per distinct problem: this runs on every console navigation.
    reportedProblem = target.problem;
    console.error(`[admin] ${CENTRAL_ADMIN_ENV} is set but ${target.problem}; the legacy console stays in place.`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/admin", "/app/admin/:path*", "/admin", "/admin/:path*"],
};
