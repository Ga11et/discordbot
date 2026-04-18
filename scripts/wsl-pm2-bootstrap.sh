#!/usr/bin/env bash
set -euo pipefail
 
PROJECT_DIR="/var/www/discordbot"
APP_NAME="discordbot"
NVM_BIN="$HOME/.nvm/versions/node/v20.19.6/bin"
 
export PATH="$NVM_BIN:$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"
 
cd "$PROJECT_DIR"
 
docker compose up -d postgres
 
"$NVM_BIN/corepack" yarn build
 
if "$NVM_BIN/pm2" describe "$APP_NAME" >/dev/null 2>&1; then
  "$NVM_BIN/pm2" restart "$APP_NAME" --update-env
else
  "$NVM_BIN/pm2" start -f ecosystem.config.cjs
fi
 
"$NVM_BIN/pm2" save
