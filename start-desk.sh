#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org then run this again."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing News Pattern Desk..."
  npm install
fi

echo "Starting News Pattern Desk..."
npm run desktop
