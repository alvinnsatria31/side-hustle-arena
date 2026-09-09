#!/usr/bin/env bash
set -euo pipefail

# Build the career-product image off-box and load it onto the Sekolah Karir VPS.
#
# The VPS has ~1.8 GB free and no swap; `next build` runs HERE (dev machine or
# CI), never there. The image is streamed over SSH and loaded directly — no
# registry account needed.
#
# Usage:
#   deploy/sk-vps/build-and-ship.sh                 # build + ship
#   CV_SCANNER=true deploy/sk-vps/build-and-ship.sh # bake CV Scanner on
#   BUILD_ONLY=1 deploy/sk-vps/build-and-ship.sh    # build, don't ship
#
# Requires: docker with buildx, and the `sk-vps` ssh alias (see AGENTS.md).
# On Windows run it from Git Bash or WSL with Docker Desktop running.

IMAGE="sk-arena:local"
SSH_ALIAS="${SK_VPS_SSH:-sk-vps}"
CV_SCANNER="${CV_SCANNER:-}"
REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "==> Building ${IMAGE} (linux/amd64, CV_SCANNER='${CV_SCANNER}') ..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_CV_SCANNER_ENABLED="${CV_SCANNER}" \
  --tag "${IMAGE}" \
  --load \
  "${REPO_ROOT}"

if [[ "${BUILD_ONLY:-}" == "1" ]]; then
  echo "==> BUILD_ONLY set; stopping before ship."
  exit 0
fi

echo "==> Shipping ${IMAGE} to ${SSH_ALIAS} (this streams ~200-400 MB) ..."
docker save "${IMAGE}" | gzip | ssh "${SSH_ALIAS}" 'gunzip | sudo -n docker load'

cat <<'EOF'
==> Image loaded. Next, on the VPS:

    cd /opt/sekolah-karir-automation/arena-stack
    sudo -n docker compose -f docker-compose.arena.yml up -d
    sudo -n docker compose -f docker-compose.arena.yml ps

First deploy? Follow docs/backend/DEPLOY_SK_VPS.md from step 1.
EOF
