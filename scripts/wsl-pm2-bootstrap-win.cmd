@echo off
setlocal

set "PROJECT_DIR=/var/www/discordbot"
set "SCRIPT_PATH=/var/www/discordbot/scripts/wsl-pm2-bootstrap.sh"

rem Optional override. Leave empty to use the default WSL distro.
set "WSL_DISTRO="

rem Avoid surprises when script is launched from UNC contexts.
cd /d "%SystemRoot%\System32"

where wsl.exe >nul 2>&1
if errorlevel 1 (
  echo wsl.exe not found in PATH.
  pause
  exit /b 1
)

if defined WSL_DISTRO (
  wsl.exe -d "%WSL_DISTRO%" --cd "%PROJECT_DIR%" --exec bash "%SCRIPT_PATH%"
) else (
  wsl.exe --cd "%PROJECT_DIR%" --exec bash "%SCRIPT_PATH%"
)

endlocal
