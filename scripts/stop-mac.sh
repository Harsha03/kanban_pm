#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="pm-mvp"

docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker rm "${CONTAINER_NAME}" >/dev/null 2>&1 || true

echo "Stopped and removed ${CONTAINER_NAME}"
