#!/usr/bin/env bash
# Commits build evidence (logs, build-info, screenshots) to the ci-artifacts
# branch so it can be reviewed from any checkout without downloading workflow
# artifacts. Runs inside GitHub Actions with a token that can push.
set -uo pipefail

SOURCE_DIR="${1:-artifacts}"
DEST_DIR="${2:-android}"

git config user.name "Notely CI"
git config user.email "ci@notely.app"

if git fetch origin ci-artifacts:refs/remotes/origin/ci-artifacts 2>/dev/null; then
  git checkout -q -B ci-artifacts origin/ci-artifacts
else
  git checkout -q --orphan ci-artifacts
  git rm -rq --cached . >/dev/null 2>&1 || true
fi

mkdir -p "$DEST_DIR"
# Copy whatever exists; the branch is a record of the latest run's evidence.
if [ -d "$SOURCE_DIR/android" ]; then
  cp -f "$SOURCE_DIR"/android/*.md "$DEST_DIR"/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/android/*.json "$DEST_DIR"/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/android/*.log "$DEST_DIR"/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/android/*.txt "$DEST_DIR"/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/android/*.apk "$DEST_DIR"/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/android/*.aab "$DEST_DIR"/ 2>/dev/null || true
fi
if [ -d "$SOURCE_DIR/screenshots" ]; then
  mkdir -p "$DEST_DIR/screenshots"
  cp -f "$SOURCE_DIR"/screenshots/*.png "$DEST_DIR"/screenshots/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/screenshots/*.txt "$DEST_DIR"/screenshots/ 2>/dev/null || true
  cp -f "$SOURCE_DIR"/screenshots/*.xml "$DEST_DIR"/screenshots/ 2>/dev/null || true
fi

{
  echo "# Android CI evidence"
  echo
  echo "- Run: ${GITHUB_RUN_ID:-local}"
  echo "- Commit: ${GITHUB_SHA:-unknown}"
  echo "- Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "Files in this branch are produced by the Android workflow: build logs,"
  echo "artifact metadata and emulator screenshots."
} > README.md

git add -f -A "$DEST_DIR" README.md
if git diff --cached --quiet; then
  echo "Nothing new to publish."
  exit 0
fi
git commit -q -m "ci(android): evidence for run ${GITHUB_RUN_ID:-local}"
git push -q origin ci-artifacts && echo "✓ evidence pushed to ci-artifacts"
