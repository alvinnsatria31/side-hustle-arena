# Self-hosted image for the Sekolah Karir career product (Arena + CV Scanner +
# Jobs + Career Report). Built for the Sekolah Karir VPS; Vercel does not use
# this file. Runbook: docs/backend/DEPLOY_SK_VPS.md
#
# Debian bookworm-slim, not Alpine: `sharp` (image optimization), `pdfjs-dist`
# and `officeparser` all behave on glibc and hit musl edge cases on Alpine.

# ---- deps: install node_modules from the lockfile only --------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- builder: produce .next/standalone -----------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# The config parsers refuse malformed values even though the build reaches no
# database or network — every route is rendered on demand at runtime. These are
# the same well-formed placeholders CI builds with (.github/workflows/ci.yml),
# NOT credentials. Real values are supplied at runtime via the env file.
ENV APP_ENV=test \
    DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/ci \
    SESSION_SECRET=build-placeholder-secret-at-least-32-chars \
    ARENA_ORIGIN=http://localhost:3001 \
    ARENA_ALLOWED_ORIGINS=http://localhost:3001 \
    SK_AUTH_ORIGIN=http://localhost:3000

# NEXT_PUBLIC_* is inlined at build time, so the CV Scanner flag is baked here.
# Default off (matches the safe default in .env.example); rebuild with
# --build-arg NEXT_PUBLIC_CV_SCANNER_ENABLED=true to ship it enabled.
ARG NEXT_PUBLIC_CV_SCANNER_ENABLED=""
ENV NEXT_PUBLIC_CV_SCANNER_ENABLED=$NEXT_PUBLIC_CV_SCANNER_ENABLED

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal runtime -------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# The standalone server bundles its own trimmed node_modules. `static` and
# `public` are not copied into it by `next build`, so place them by hand.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# server.js is PID 1 and handles SIGTERM: it drains in-flight requests and runs
# pending after() callbacks before exiting. Give it a 30s stop grace period.
CMD ["node", "server.js"]
