#!/bin/sh
# Refresh data/*.json from the feeds and, if anything changed, commit and
# push it: the same refresh the GitHub Action does, for running from a plain
# crontab entry on any machine with a clone of this repo and push access, e.g.
#
#   0 7,21 * * *  cd /srv/bdn-sports-page && scripts/update-data.sh >> /var/log/bdn-sports.log 2>&1
#
# Env overrides: PYTHON (default python3), BRANCH (default main),
# PUSH_REMOTE (default origin).
set -eu

cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python3}"
BRANCH="${BRANCH:-main}"
PUSH_REMOTE="${PUSH_REMOTE:-origin}"

"$PYTHON" -m scraper.main

git add data/
if git diff --cached --quiet; then
  echo "No data changes; nothing to commit."
  exit 0
fi

git commit -m "data: update $(date -u +%Y-%m-%d-%H%M)"
# Someone may have pushed code since this checkout; put the data commit on
# top rather than failing the push.
git pull --rebase "$PUSH_REMOTE" "$BRANCH"
git push "$PUSH_REMOTE" "HEAD:$BRANCH"
