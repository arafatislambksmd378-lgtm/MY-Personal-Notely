#!/usr/bin/env bash
# Installs the built APK on the running emulator, drives a short UI tour and
# captures screenshots as evidence. Runs inside GitHub Actions (adb available).
set -uo pipefail

OUT_DIR="${1:-artifacts/screenshots}"
mkdir -p "$OUT_DIR"

ADB="adb -s emulator-5554"
$ADB wait-for-device
# Give Android a moment to finish booting past the lock screen.
for _ in $(seq 1 60); do
  BOOTED=$($ADB shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$BOOTED" = "1" ] && break
  sleep 2
done
$ADB shell settings put global window_animation_scale 0 || true
$ADB shell settings put global transition_animation_scale 0 || true
$ADB shell settings put global animator_duration_scale 0 || true
$ADB shell wm dismiss-keyguard || true

APK=$(ls artifacts/android/*.apk | head -1)
echo "Installing $APK"
$ADB install -r -g "$APK"

$ADB logcat -c || true
$ADB shell am start -W -n com.notely.app/.MainActivity | tee "$OUT_DIR/launch.txt"
sleep 8

shot() {
  local name="$1"
  $ADB exec-out screencap -p > "$OUT_DIR/$name.png" || true
  echo "captured $name"
}

# Resolve an element by accessibility text/description and tap its centre.
tap_text() {
  local needle="$1"
  $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  $ADB pull /sdcard/ui.xml "$OUT_DIR/last-ui.xml" >/dev/null 2>&1 || true
  local coords
  coords=$(node scripts/android/find-element.mjs "$OUT_DIR/last-ui.xml" "$needle" || true)
  if [ -z "$coords" ]; then
    echo "⚠ element not found: $needle"
    return 1
  fi
  echo "tap $needle at $coords"
  $ADB shell input tap $coords
  sleep 1.2
}

shot 01-home
tap_text "Create note" && sleep 1 && shot 02-editor
$ADB shell input keyevent 4 && sleep 1
tap_text "Notebooks" && shot 03-notebooks
tap_text "Settings" && shot 04-settings
tap_text "Backup" && shot 05-backup
$ADB shell input keyevent 4 && sleep 0.5
tap_text "Templates" && shot 06-templates

# Editor deeper tour: open a seeded note from the home screen.
tap_text "Home" && sleep 0.5
tap_text "Welcome" && sleep 2 && shot 07-note-open
tap_text "Note options" && sleep 1 && shot 08-note-options
$ADB shell input keyevent 4 && sleep 0.5
tap_text "Insert" && sleep 1 && shot 09-insert-sheet
$ADB shell input keyevent 4 && sleep 0.5

# --- Exercise the editor: type into the note body, wait for autosave ---------
tap_text "Welcome" && sleep 2
$ADB shell input tap 540 900
$ADB shell input text "Android smoke test line"
sleep 3
shot 10-typed
$ADB shell input keyevent 4 && sleep 2

# --- Persistence: kill the process, relaunch, check the note still exists ----
$ADB shell am force-stop com.notely.app
sleep 2
$ADB shell am start -W -n com.notely.app/.MainActivity >/dev/null
sleep 8
shot 11-after-restart
tap_text "Welcome" && sleep 3 && shot 12-reopened-note
$ADB shell input keyevent 4 && sleep 1

# --- Native sharing: export the note as Markdown -----------------------------
tap_text "Welcome" && sleep 2
tap_text "Note options" && sleep 1
tap_text "Share & export" && sleep 1 && shot 13-share-export
tap_text "Markdown" && sleep 3 && shot 14-android-share-sheet
$ADB shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -3 > "$OUT_DIR/foreground.txt" || true
$ADB shell input keyevent 4 && sleep 1
$ADB shell input keyevent 4 && sleep 1

# --- Search at the library level --------------------------------------------
tap_text "Search" && sleep 1 && shot 15-search
$ADB shell input text "welcome"
sleep 2
shot 16-search-results
$ADB shell input keyevent 4 && sleep 1

$ADB logcat -d > "$OUT_DIR/logcat.txt" || true
if grep -q "FATAL EXCEPTION" "$OUT_DIR/logcat.txt"; then
  echo "::error::FATAL EXCEPTION in logcat"
  grep -A 20 "FATAL EXCEPTION" "$OUT_DIR/logcat.txt" | head -60
fi
ls -la "$OUT_DIR"
