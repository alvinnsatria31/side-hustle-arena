# Deploying the career product to the Sekolah Karir VPS

Moves the app (Arena + CV Scanner + Jobs + Career Report) off Vercel and onto
`sk-vps` (`129.226.94.253`) as a Docker container behind Caddy.

**Two metered walls were hit the same day, not one.** The Vercel Hobby project
auto-paused when Fast Origin Transfer passed its 10 GB/month cap. Moving the app
alone did not fix anything, because Neon's free tier had *also* exhausted its
data-transfer quota and was refusing every query with SQLSTATE `53000` — a fact
invisible until unhandled errors started being logged (`src/server/arena/errors.ts`).

So Postgres moved onto the box as well. Tencent COS stays where it is.

**The database was rebuilt empty.** Reading the old Neon data out needs
`pg_dump`, which needs the quota that was exhausted, so the schema was migrated
fresh and the content re-seeded. Participant history — enrollments, submissions,
reviews, points — did not come across; it is still in Neon, reachable if that
project is ever given a paid month. `NEON_DATABASE_URL` is preserved in
`arena.env` for exactly that.

Done 9-10 September 2026.

## What runs on the box

- `sk-arena` — the app. Publishes only to `127.0.0.1:3000`. Joins
  `sekolah-karir-automation_n8n-net` so the n8n scheduler/grading workflows
  reach it in-cluster as `http://sk-arena:3000`.
- `sk-arena-db` — Postgres 16. Loopback only (`127.0.0.1:5433`) so migrations
  and dumps can tunnel in; nothing outside the box can connect.
- `sk-arena-caddy` — reverse proxy + automatic HTTPS for
  `arena.sekolahkarir.id`. **This is the first container on this box to bind
  `0.0.0.0`.** Ports 80/443 are publicly reachable, on a box that also hosts the
  WhatsApp bots, n8n and Hermes — see Risks below.
- `sk-arena-migrate` / `sk-arena-seed` — one-shot, behind the `tools` profile.
- Cron: owned by n8n. `n8n/arena-trigger-workflow.json` replaces Vercel Cron;
  `reviews-run` stays owned by the grading workflow.

```
internet ──443──▶ sk-arena-caddy ──▶ sk-arena:3000 ──▶ sk-arena-db (same box)
                                              └────────▶ Tencent COS (TLS)
sk-n8n ──(n8n-net)──▶ sk-arena:3000/api/cron/*, /api/internal/reviews/*
```

## Files

| File | Goes to |
| --- | --- |
| `deploy/sk-vps/docker-compose.arena.yml` | `/opt/sekolah-karir-automation/arena-stack/` |
| `deploy/sk-vps/Caddyfile` | `/opt/sekolah-karir-automation/arena-stack/` |
| `deploy/sk-vps/arena.env.sample` → `arena.env` | `/opt/sekolah-karir-automation/arena-stack/` (filled, chmod 600) |
| `deploy/sk-vps/migrate-runner.mjs` + `drizzle/` | `/opt/sekolah-karir-automation/arena-stack/migrate/` |
| `deploy/sk-vps/backup-db.sh` | `/opt/sekolah-karir-automation/arena-stack/` |
| image `sk-arena:local` | `docker load` on the box |

---

## Step 1 — Cloud firewall (OWNER, manual)

Open inbound **80** and **443** to the box in the **Tencent Lighthouse console**
(Firewall / security group for `129.226.94.253`). The OS firewall is handled in
step 2. Nothing else in this runbook can be verified end to end until this is
done, but steps 2–6 can all run before it.

## Step 2 — One-time box prep

```bash
ssh sk-vps

# 2a. Swap — the box has 3.6 GB RAM and ~1.8 GB free, so a swapfile is cheap
#     insurance against an OOM during a CV-scan/OCR spike. One already exists
#     (2 GB); this is the idempotent form if it ever needs recreating.
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
free -h

# 2b. OS firewall
sudo ufw allow 80/tcp comment 'sk-arena caddy http'
sudo ufw allow 443/tcp comment 'sk-arena caddy https'
sudo ufw status

# 2c. Stack directory
sudo mkdir -p /opt/sekolah-karir-automation/arena-stack
sudo chown "$USER":"$USER" /opt/sekolah-karir-automation/arena-stack
```

Copy the stack files from your machine:

```bash
scp deploy/sk-vps/docker-compose.arena.yml deploy/sk-vps/Caddyfile \
    deploy/sk-vps/arena.env.sample \
    sk-vps:/opt/sekolah-karir-automation/arena-stack/
```

## Step 3 — Build `arena.env`

On your machine, pull current production values:

```bash
vercel env pull vercel.prod.env --environment=production   # needs `vercel login`
```

On the box, create `arena.env` from the sample and fill every required key
(see comments in the file). Values worth calling out:

- `CRON_SECRET` — must equal what n8n already sends. Read it back:
  ```bash
  sudo -n docker inspect sk-n8n --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -E 'ARENA_CRON_TOKEN|INTERNAL_AUTOMATION_TOKEN|AI_API_'
  ```
- `AI_API_BASE_URL` / `AI_API_KEY` — reuse the values from that same output.
- `SESSION_SECRET` — the signing secret from `sekolah-karir-website`. Wrong
  value ⇒ everyone reads as logged out.
- `POSTGRES_PASSWORD` + `LOCAL_DATABASE_URL` — generate once:
  ```bash
  PW=$(openssl rand -hex 24)
  printf 'POSTGRES_PASSWORD=%s\nLOCAL_DATABASE_URL=postgresql://arena:%s@sk-arena-db:5432/arena\n' "$PW" "$PW" >> arena.env
  ```
  Then set `DATABASE_URL` to the same value. Keep any previous managed-database
  URL as `NEON_DATABASE_URL` — it is the only handle on the old data.
- Leave `VPS_WEBHOOK_TOKEN` unset.

**Do not quote values.** Compose's `env_file` strips quotes, but `docker run
--env-file` and most other tooling take them literally, so a quoted
`DATABASE_URL` works in the app and breaks every script that reads the same
file.

```bash
chmod 600 /opt/sekolah-karir-automation/arena-stack/arena.env
```

## Step 4 — Build and ship the image

From the repo root on your machine (Docker Desktop running):

```bash
./deploy/sk-vps/build-and-ship.sh
# or, to bake the CV Scanner in:  CV_SCANNER=true ./deploy/sk-vps/build-and-ship.sh
```

This builds `linux/amd64`, then `docker save | ssh sk-vps 'docker load'`.

**The link to this box drops large transfers.** The single-pipe ship failed
repeatedly on a ~105 MB image. If it does, split and retry per chunk, then load
detached so a dropped SSH cannot kill a load already in progress:

```bash
# locally
docker save sk-arena:local | gzip > /tmp/sk-arena.tar.gz
split -b 20m /tmp/sk-arena.tar.gz /tmp/parts/part-
for f in /tmp/parts/part-*; do
  until scp -q "$f" sk-vps:/tmp/skparts/; do sleep 3; done
done

# on the box — setsid survives the SSH session ending
cat /tmp/skparts/part-* > /tmp/sk-arena.tar.gz
sudo setsid bash -c 'docker load -i /tmp/sk-arena.tar.gz > /tmp/load.log 2>&1' < /dev/null &
```

Compare `sha256sum` on both ends before loading, and confirm the image id
actually changed afterwards — `docker load` reports success on the old image if
the new one never arrived.

## Step 4b — Schema and content

```bash
cd /opt/sekolah-karir-automation/arena-stack
sudo -n docker compose -f docker-compose.arena.yml up -d sk-arena-db
sudo -n docker compose -f docker-compose.arena.yml --profile tools run --rm sk-arena-migrate
sudo -n docker compose -f docker-compose.arena.yml --profile tools run --rm sk-arena-seed
```

The migrator needs `deploy/sk-vps/migrate-runner.mjs` and the repo's `drizzle/`
folder in `arena-stack/migrate/`; the seed additionally needs
`seed-arena-core.mjs` and `seed-rewards-catalog.mjs` there. Both run with
`APP_ENV=development` because the scripts refuse to touch a database otherwise —
a guard against seeding by accident, not an environment claim.

`bootstrap-generation-library` is **not** run here: it imports `@/server/...`
and needs the full repo, and `IMPLEMENTATION_AUDIT_2026-09-08.md` records that
it writes `[PLACEHOLDER]` text tagged HIGH_QUALITY. Curate rubrics before
relying on generation fallback.

## Step 5 — First boot (app only, still private)

```bash
ssh sk-vps
cd /opt/sekolah-karir-automation/arena-stack
sudo -n docker compose -f docker-compose.arena.yml up -d sk-arena
sudo -n docker compose -f docker-compose.arena.yml logs -f sk-arena   # watch it come up
sudo -n docker compose -f docker-compose.arena.yml ps                 # health: healthy
curl -fsS http://127.0.0.1:3000/api/health                            # {"status":"ok",...}
```

Smoke test the real app over an SSH tunnel from your machine:

```bash
ssh -L 3000:127.0.0.1:3000 sk-vps
# then in a browser: http://localhost:3000  — landing page renders,
# /arena redirects to the Sekolah Karir login
```

Exercise the data paths (see `docs/backend/END_TO_END_IMPLEMENTATION.md` for the
full flow): DB read (`/api/arena/week/current`), object storage (a presign call),
and one cron by hand:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/session-cleanup
```

## Step 6 — DNS cutover (OWNER, manual)

At the DNS provider for `sekolahkarir.id`, change the `arena` record:

| | From | To |
| --- | --- | --- |
| Type | `CNAME` | `A` |
| Value | `cname.vercel-dns.com` | `129.226.94.253` |

Lower the TTL an hour beforehand. If the zone is on Cloudflare, keeping the
record **proxied (orange cloud)** is recommended — it puts a free WAF/rate limit
in front of the box's newly public port, which matters since this is the box's
first public service.

## Step 7 — Bring up Caddy, point n8n inward

Once DNS resolves to the box:

```bash
ssh sk-vps
cd /opt/sekolah-karir-automation/arena-stack
sudo -n docker compose -f docker-compose.arena.yml up -d          # starts caddy too
sudo -n docker compose -f docker-compose.arena.yml logs -f sk-arena-caddy
# wait for "certificate obtained successfully" for arena.sekolahkarir.id
curl -fsS https://arena.sekolahkarir.id/api/health
```

Repoint the n8n workflows at the in-cluster address so automation never makes a
public round-trip. Edit the root compose env:

```bash
sudo sed -i 's#^ARENA_BASE_URL=.*#ARENA_BASE_URL=http://sk-arena:3000#' \
  /opt/sekolah-karir-automation/.env
cd /opt/sekolah-karir-automation
sudo -n docker compose up -d n8n           # picks up the new value
```

(`sk-n8n` already sits on `n8n-net`, which `sk-arena` now joins, so the name
resolves.)

## Step 8 — Detach from Vercel

- **Remove `VPS_WEBHOOK_TOKEN`** from the Vercel project (per
  `N8N_SEKOLAH_KARIR_MIGRATION.md`) — or ignore it, the project is paused.
- Leave the Vercel project **paused, not deleted**, for ~1 week as rollback.
- The stored Vercel Cron entries are moot once traffic leaves; n8n owns the
  schedule.

## Step 9 — Post-cutover verification

```bash
# From your machine — runs the real n8n router code against the live app
ARENA_BASE_URL=https://arena.sekolahkarir.id \
ARENA_CRON_TOKEN=<CRON_SECRET> \
ARENA_AUTOMATION_TOKEN=<INTERNAL_AUTOMATION_TOKEN> \
npm run n8n:dry-run
```

Then, in a browser against `https://arena.sekolahkarir.id`: sign in through the
main site, open `/arena`, submit a deliverable, upload a file (presign + PUT to
COS), and — if enabled — run a CV scan. Confirm a scheduled `week-close` /
`week-finalize` tick lands in the audit log within the hour.

## Rollback

Flip the `arena` DNS record back to `CNAME cname.vercel-dns.com` and un-pause the
Vercel project (raise the spending limit or upgrade to Pro). The container can
keep running privately while DNS propagates back.

Note the rollback is **partial**: the Vercel deployment points at Neon, which
holds the pre-migration data and none of what has been written since. The two
databases have diverged from the moment of cutover.

## Backups — the part nobody else does now

A managed database took snapshots; this box does not. `deploy/sk-vps/backup-db.sh`
is the entire safety net:

- `pg_dump -Fc` daily at 03:30 UTC via `/etc/cron.d/arena-db-backup`
- verified with `pg_restore --list` before anything is pruned
- mirrored to COS under `db-backups/`, because a dump that only exists on this
  box dies with this box
- 14 days retained locally

The storage key can write and read objects but not `ListBucket`, so `mc ls` and
`mc stat` answer *Access Denied* even for objects that uploaded fine. Verify by
downloading instead:

```bash
cd /opt/sekolah-karir-automation/arena-stack
export MC_CONFIG_DIR=$PWD/.mc
sudo -n env MC_CONFIG_DIR=$MC_CONFIG_DIR mc cp "cos/<bucket>/db-backups/<file>" /tmp/v.dump
sudo -n docker exec -i sk-arena-db pg_restore --list < /tmp/v.dump | head
```

The `cos` alias must be created with `--path off`: Tencent COS rejects
path-style addressing and requires the virtual-hosted domain.

**Restore:**

```bash
sudo -n docker exec -i sk-arena-db pg_restore -U arena -d arena --clean --if-exists < backup.dump
```

## Risks this deployment carries

Worth re-reading before assuming the migration is "done":

- **The box is publicly reachable for the first time**, and it also hosts the
  WhatsApp bots, n8n (with its credentials) and Hermes. Scanners found it within
  minutes. A compromise of the app is a compromise of that whole neighbourhood.
  There is no WAF — the domain is on Neo DNS, not Cloudflare.
- **Single point of failure.** No CDN, no redundancy, no failover. The box is
  the entire product.
- **No PITR or HA on the database.** The daily dump is the recovery granularity;
  up to 24h of writes can be lost.
- **Deploys are manual** and the network to the box is unreliable — budget for
  the chunked-transfer path above.
- **No autoscaling.** One 768 MB container absorbs any traffic spike.

## Operating it

- **Redeploy:** `./deploy/sk-vps/build-and-ship.sh` then
  `sudo -n docker compose -f docker-compose.arena.yml up -d` on the box.
  `server.js` drains on SIGTERM (30s grace) so restarts don't drop requests.
- **Logs:** `sudo -n docker compose -f docker-compose.arena.yml logs -f sk-arena`.
  Unhandled 500s are printed as `[arena] unhandled error:` — they used to be
  swallowed silently, which is why the Neon quota failure took so long to find.
- **Database shell:** `sudo -n docker exec -it sk-arena-db psql -U arena -d arena`
- **Memory:** `sudo -n docker stats --no-stream`. Measured steady state is ~90 MB
  app / ~47 MB Postgres / ~21 MB Caddy against 3.6 GB total — far below the
  configured limits, with the other eleven containers unaffected.
- **Cert renewal:** automatic via Caddy; the `caddy_data` volume persists it.
  After a failed ACME run Caddy backs off exponentially — restarting
  `sk-arena-caddy` resets the backoff and retries immediately.
