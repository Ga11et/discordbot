#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMPS_DIR="${ROOT_DIR}/dumps"
TIMESTAMP="$(date +%F-%H%M)"
OUTPUT_FILE="${DUMPS_DIR}/dump-${TIMESTAMP}.sql"

mkdir -p "${DUMPS_DIR}"

docker exec -t discordbot-postgres \
  pg_dump \
  -U "${POSTGRES_USER:-discordbot_user}" \
  -d "${POSTGRES_DB:-discordbot_db}" \
  > "${OUTPUT_FILE}"

echo "Database dump saved to ${OUTPUT_FILE}"
