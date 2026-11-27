#!/bin/sh
# Pretty-print a day's log file from storage/logs (see config/logger.ts).
#
#   npm run logs                         today's API log
#   npm run logs 2026-11-26              that day's API log
#   npm run logs 2026-11-26 worker       that day's worker log (align:work)
#   npm run logs -- --errors             errors only (any position)
#
# Days are UTC, like the files (TZ=UTC).

day=$(date -u +%F)
name=api
level=""
for arg in "$@"; do
  case "$arg" in
    --errors) level="-L error" ;;
    api|worker) name="$arg" ;;
    ????-??-??) day="$arg" ;;
    *) echo "Unknown argument: $arg (want YYYY-MM-DD, api, worker or --errors)" >&2; exit 1 ;;
  esac
done

dir=storage/logs
[ -d "$dir" ] || dir=build/storage/logs

set -- "$dir/$name.$day".*.log
if [ ! -e "$1" ]; then
  echo "No $name log for $day in $dir." >&2
  ls "$dir" 2>/dev/null | tail -n 20 >&2
  exit 1
fi

# Numbered files of the same day, in order (.1, .2, … .10).
ls "$@" | sort -t. -k3,3n | xargs cat | npx pino-pretty --translateTime SYS:standard $level
