#!/bin/zsh

cd "$(dirname "$0")" || exit 1

URL="http://127.0.0.1:5173/"

if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

(sleep 2; open "$URL") &
npm run dev -- --host 127.0.0.1 --port 5173
