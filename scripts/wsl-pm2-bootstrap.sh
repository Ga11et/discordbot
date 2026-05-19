#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www/discordbot"
APP_NAME="discordbot"
NVM_BIN="$HOME/.nvm/versions/node/v20.19.6/bin"
WSL_DISTRO="${WSL_DISTRO_NAME:-}"

export PATH="$NVM_BIN:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"

if ! command -v cmd.exe >/dev/null 2>&1; then
  echo "cmd.exe not found in PATH. This launcher must be run from WSL with Windows interop enabled." >&2
  exit 1
fi

if ! command -v wsl.exe >/dev/null 2>&1; then
  echo "wsl.exe not found in PATH. Cannot start a new Windows terminal session." >&2
  exit 1
fi

LOGS_COMMAND=$(printf "cd '%s' && '%s/pm2' logs '%s'" "$PROJECT_DIR" "$NVM_BIN" "$APP_NAME")

if [ -n "$WSL_DISTRO" ]; then
  cmd.exe /C start "discordbot pm2 logs" \
    wsl.exe -d "$WSL_DISTRO" --cd "$PROJECT_DIR" --exec bash -lc "$LOGS_COMMAND"
else
  cmd.exe /C start "discordbot pm2 logs" \
    wsl.exe --cd "$PROJECT_DIR" --exec bash -lc "$LOGS_COMMAND"
fi

echo "PM2 logs launcher started for '$APP_NAME'."
