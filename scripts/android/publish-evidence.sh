#!/usr/bin/env bash
# Commits build evidence (logs, build-info, screenshots) to the ci-artifacts
# branch so anyone can review it from a normal checkout, without downloading
# workflow artifacts.
#
# Design notes learned the hard way:
# - The job's own working tree contains the generated android/ project and a
#   dirty index, and `git checkout` onto ci-artifacts refused to overwrite those
#   untracked files. That silently produced a commit on the wrong branch and a
#   rejected push, so the screenshots never appeared. Publishing now happens in
#   a throw-away clone, so it cannot be affected by the build tree at all.
# - Logs are truncated to their tail; the evidence branch is small on purpose.
# - Push retries with a rebase so the build job and the emulator job (they run
#   one after the other, but a rerun can overlap) do not lose each other's files.
set -uo pipefail

SOURCE_DIR="${1:-artifacts}"
DEST_DIR="${2:-build/android}"

if [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GH_TOKEN:-}" ]; then
  echo "Not running in Actions with a token; skipping evidence publication."
  exit 0
fi

WORK="$(mktemp -d)"
CLONE="$WORK/evidence"
REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

echo "Publishing $SOURCE_DIR → ci-artifacts:$DEST_DIR"
if ! git clone -q --branch ci-artifacts "$REMOTE" "$CLONE" 2>/dev/null; then
  echo "ci-artifacts does not exist yet; creating it."
  git init -q "$CLONE"
  git -C "$CLONE" remote add origin "$REMOTE"
  git -C "$CLONE" checkout -q -b ci-artifacts
fi

git -C "$CLONE" config user.name "Notely CI"
git -C "$CLONE" config user.email "ci@notely.app"

# One-time migration: earlier runs published into android/ and screenshots/ at
# the repository root, which collided with the generated project of the same
# name. Evidence now lives under build/.
git -C "$CLONE" rm -rq --cached android screenshots >/dev/null 2>&1 || true
rm -rf "$CLONE/android" "$CLONE/screenshots"

mkdir -p "$CLONE/$DEST_DIR"
if [ -d "$SOURCE_DIR/android" ]; then
  SRC="$SOURCE_DIR/android"
elif [ -d "$SOURCE_DIR/screenshots" ]; then
  SRC="$SOURCE_DIR/screenshots"
else
  SRC="$SOURCE_DIR"
fi
echo "Source: $SRC"
copied=0
while IFS= read -r -d '' file; do
  cp -f "$file" "$CLONE/$DEST_DIR/" && copied=$((copied + 1))
done < <(find "$SRC" -maxdepth 1 -type f \
  \( -name '*.md' -o -name '*.json' -o -name '*.log' -o -name '*.txt' \
     -o -name '*.png' -o -name '*.xml' -o -name '*.apk' -o -name '*.aab' \) -print0)

# Keep published logs to a reviewable size.
for log in "$CLONE/$DEST_DIR"/*.log; do
  [ -f "$log" ] || continue
  tail -n 2000 "$log" > "$log.tail" && mv "$log.tail" "$log"
done

# A 100 MB APK cannot live in git; point at the release instead.
rm -f "$CLONE/$DEST_DIR"/*.apk "$CLONE/$DEST_DIR"/*.aab

echo "Copied $copied file(s)."
[ "$copied" -gt 0 ] || { echo "No evidence files found; nothing to publish."; exit 0; }

{
  echo "# Android CI evidence"
  echo
  echo "- Run: ${GITHUB_RUN_ID:-local}"
  echo "- Commit: ${GITHUB_SHA:-unknown}"
  echo "- Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "Produced by the Android workflow: build logs, build facts and emulator"
  echo "screenshots. APKs and AABs are attached to the tagged GitHub release"
  echo "named in \`$DEST_DIR/build-info.md\` (git cannot hold a 100 MB+ binary)."
} > "$CLONE/README.md"

git -C "$CLONE" add -A
if git -C "$CLONE" diff --cached --quiet; then
  echo "Nothing new to publish."
  exit 0
fi
git -C "$CLONE" commit -q -m "ci(android): evidence for run ${GITHUB_RUN_ID:-local}"

for attempt in 1 2 3 4 5; do
  if git -C "$CLONE" push -q origin ci-artifacts; then
    echo "✓ evidence pushed to ci-artifacts ($DEST_DIR)"
    exit 0
  fi
  echo "push attempt $attempt rejected; rebasing and retrying"
  git -C "$CLONE" pull -q --rebase --no-edit origin ci-artifacts || true
  sleep 3
done

echo "::error::Could not publish evidence to ci-artifacts after 5 attempts"
exit 1
