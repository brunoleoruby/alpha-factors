@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org then double-click this file again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing News Pattern Desk...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting News Pattern Desk...
call npm run desktop
if errorlevel 1 pause
