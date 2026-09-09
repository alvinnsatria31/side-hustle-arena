#!/usr/bin/env bash
set -euo pipefail

# Daily backup of the self-hosted Arena database.
#
# The database moved off a managed provider onto this box, which means nobody
# else is taking snapshots any more. This is the whole safety net: without it a
# dead disk is a dead product. Runs from cron on the VPS — see
# docs/backend/DEPLOY_SK_VPS.md.
#
# Keeps 14 days locally and mirrors to Tencent COS, so a lost box is not a lost
# database. Credentials come from arena.env, never from the environment of
# whoever runs this.

STACK_DIR="/opt/sekolah-karir-automation/arena-stack"
BACKUP_DIR="${STACK_DIR}/backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="arena-${STAMP}.dump"
RETAIN_DAYS=14

mkdir -p "${BACKUP_DIR}"

# -Fc is the custom format: compressed, and restorable selectively with
# pg_restore rather than all-or-nothing.
docker exec sk-arena-db pg_dump -U arena -d arena -Fc > "${BACKUP_DIR}/${FILE}"

# A dump that cannot be read back is not a backup. Verify before pruning.
if ! docker exec -i sk-arena-db pg_restore --list > /dev/null < "${BACKUP_DIR}/${FILE}"; then
  echo "[backup] ${FILE} FAILED verification — keeping it and every older dump" >&2
  exit 1
fi

SIZE="$(du -h "${BACKUP_DIR}/${FILE}" | cut -f1)"
echo "[backup] ${FILE} ok (${SIZE})"

# Mirror off-box to object storage — a backup that only exists on this box dies
# with this box. `mc` over the COS S3 endpoint; best effort, because a storage
# outage must not cost us the local dump or fail the job.
if command -v mc >/dev/null 2>&1; then
  set +e

  # Read only the key we need WITHOUT sourcing the file. `. arena.env` looks
  # convenient and is a trap: values are unquoted dotenv, so a line like
  # `ARENA_FROM_EMAIL=Arena Sekolah Karir <arena@sekolahkarir.id>` makes the
  # shell treat `<` as a redirect and abort.
  S_BUCKET="$(sed -n 's/^STORAGE_BUCKET=//p' "${STACK_DIR}/arena.env" | tail -1 | sed -e 's/^"//' -e 's/"$//')"

  # The `cos` alias is configured once with `--path off`: Tencent COS refuses
  # path-style addressing and demands the virtual-hosted domain
  # (<bucket>.cos.<region>.myqcloud.com), which mc uses by default only when
  # path lookup is disabled. Setup is in docs/backend/DEPLOY_SK_VPS.md.
  export MC_CONFIG_DIR="${STACK_DIR}/.mc"

  if [ -n "${S_BUCKET}" ] && [ -d "${MC_CONFIG_DIR}" ]; then
    # NOTE: the storage key is scoped to object writes, not ListBucket, so
    # `mc stat`/`mc ls` answer Access Denied even for objects that uploaded
    # fine. Trust mc's exit code here; confirm in the COS console.
    mc cp --quiet "${BACKUP_DIR}/${FILE}" "cos/${S_BUCKET}/db-backups/${FILE}" >/dev/null 2>&1 \
      && echo "[backup] mirrored to COS" \
      || echo "[backup] COS mirror failed (local dump kept)" >&2
  else
    echo "[backup] COS alias or bucket missing — local dump only" >&2
  fi
  set -e
else
  echo "[backup] mc absent — local dump only" >&2
fi

# Prune only after a verified dump exists, so a run of failures never leaves us
# with nothing.
find "${BACKUP_DIR}" -name 'arena-*.dump' -type f -mtime "+${RETAIN_DAYS}" -delete
echo "[backup] retention: ${RETAIN_DAYS} days"
