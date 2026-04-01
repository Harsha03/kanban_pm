#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="pm-mvp:local"
CONTAINER_NAME="pm-mvp"

docker build -t "${IMAGE_NAME}" .
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d \
  --name "${CONTAINER_NAME}" \
  --env-file .env \
  -p 8000:8000 \
  "${IMAGE_NAME}"

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:8000/api/health" >/dev/null 2>&1; then
    echo "App is running at http://127.0.0.1:8000"
    exit 0
  fi
  sleep 1
done

echo "Container started, but app did not become healthy in time."
exit 1
