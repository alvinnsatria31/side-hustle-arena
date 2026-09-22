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
#
# Encryption: if BACKUP_AGE_RECIPIENT (age, preferred — single static binary)
# or BACKUP_GPG_RECIPIENT (gpg fallback) is set in arena.env, the dump is
# encrypted BEFORE it leaves this box and only the ciphertext is mirrored to
# COS. The local 14-day copy stays plaintext so `pg_restore --list`
# verification and local restores keep working unchanged. With neither var set
# the old plaintext behaviour remains, with a loud warning on stderr.
#
# Exit codes: 1 = dump failed verification, recipient configured but its tool
# missing, or COS mirror failed. The mirror failure exits AFTER the local dump
# is verified and retention has run — a missing off-box copy must fail the cron
# job loudly, never pass silently.

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

# Encrypt before anything leaves this box. Recipients are read with the same
# no-source sed pattern as STORAGE_BUCKET below (see comment there for why
# `. arena.env` is a trap). age is preferred: one static binary, one recipient
# flag, no keyring state. gpg is the fallback for boxes that already have it.
BACKUP_AGE_RECIPIENT="$(sed -n 's/^BACKUP_AGE_RECIPIENT=//p' "${STACK_DIR}/arena.env" | tail -1 | sed -e 's/^"//' -e 's/"$//')"
BACKUP_GPG_RECIPIENT="$(sed -n 's/^BACKUP_GPG_RECIPIENT=//p' "${STACK_DIR}/arena.env" | tail -1 | sed -e 's/^"//' -e 's/"$//')"
MIRROR_SRC="${BACKUP_DIR}/${FILE}"
MIRROR_NAME="${FILE}"

if [ -n "${BACKUP_AGE_RECIPIENT}" ]; then
  if ! command -v age >/dev/null 2>&1; then
    echo "[backup] ALERT: BACKUP_AGE_RECIPIENT is set but 'age' is not installed — refusing to mirror plaintext" >&2
    exit 1
  fi
  age -r "${BACKUP_AGE_RECIPIENT}" -o "${BACKUP_DIR}/${FILE}.age" "${BACKUP_DIR}/${FILE}"
  MIRROR_SRC="${BACKUP_DIR}/${FILE}.age"
  MIRROR_NAME="${FILE}.age"
  echo "[backup] encrypted with age for ${BACKUP_AGE_RECIPIENT}"
elif [ -n "${BACKUP_GPG_RECIPIENT}" ]; then
  if ! command -v gpg >/dev/null 2>&1; then
    echo "[backup] ALERT: BACKUP_GPG_RECIPIENT is set but 'gpg' is not installed — refusing to mirror plaintext" >&2
    exit 1
  fi
  gpg --batch --yes --trust-model always --encrypt --recipient "${BACKUP_GPG_RECIPIENT}" \
    --output "${BACKUP_DIR}/${FILE}.gpg" "${BACKUP_DIR}/${FILE}"
  MIRROR_SRC="${BACKUP_DIR}/${FILE}.gpg"
  MIRROR_NAME="${FILE}.gpg"
  echo "[backup] encrypted with gpg for ${BACKUP_GPG_RECIPIENT}"
else
  echo "[backup] WARNING: no BACKUP_AGE_RECIPIENT / BACKUP_GPG_RECIPIENT in arena.env — mirroring UNENCRYPTED dump" >&2
fi

# Mirror off-box to object storage — a backup that only exists on this box dies
# with this box. `mc` over the COS S3 endpoint. A failed mirror fails the job
# (exit 1 at the end, after retention) because a missing off-box copy must
# alert, not pass silently. The local dump is already verified by then, so the
# failure costs us redundancy, never data.
MIRROR_FAILED=0
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
    # MIRROR_SRC is the ciphertext when encryption is configured, else the
    # plaintext dump (with the WARNING above).
    mc cp --quiet "${MIRROR_SRC}" "cos/${S_BUCKET}/db-backups/${MIRROR_NAME}" >/dev/null 2>&1 \
      && echo "[backup] mirrored to COS (${MIRROR_NAME})" \
      || { echo "[backup] ALERT: COS mirror failed for ${MIRROR_NAME} (local dump kept) — investigate" >&2; MIRROR_FAILED=1; }
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

if [ "${MIRROR_FAILED}" -ne 0 ]; then
  echo "[backup] ALERT: local backup ok but off-box mirror missing — job FAILED" >&2
  exit 1
fi
