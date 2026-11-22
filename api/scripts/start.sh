#!/bin/sh
# Render start command: the API and the AI worker in one free web service.
#
# A free Render service sleeps when idle, and a worker-only service gets no
# traffic to wake it, so the worker runs alongside the API instead. It stays a
# separate process (spec "Separate process"): if it crashes, the API keeps
# serving and the loop restarts the worker; queued checks wait in Postgres.
set -e
cd "$(dirname "$0")/../build"

(
  while true; do
    node ace.js align:work || true
    sleep 15
  done
) &

exec node bin/server.js
