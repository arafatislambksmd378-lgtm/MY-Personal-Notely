#!/usr/bin/env bash
# Installs the built APK on the running emulator, drives a UI tour and captures
# screenshots as evidence. Runs inside GitHub Actions (adb available).
#
# Every step is best-effort: a missing element logs a warning and moves on, so
# one changed label never costs the whole set of screenshots. The tour starts
# from a clean install, creates a note, proves it survives a process kill,
# exports Markdown through the Android share sheet and visits every tab.
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
$ADB shell dumpsys package com.notely.app | grep -E "versionName|versionCode|firstInstallTime" > "$OUT_DIR/package-info.txt" || true
$ADB shell getprop ro.build.version.release >> "$OUT_DIR/package-info.txt" || true
$ADB shell wm size >> "$OUT_DIR/package-info.txt" || true

$ADB logcat -c || true
$ADB shell am start -W -n com.notely.app/.MainActivity | tee "$OUT_DIR/launch.txt"
sleep 9

shot() {
  local name="$1"
  $ADB exec-out screencap -p > "$OUT_DIR/$name.png" || true
  echo "captured $name"
}

# Resolve an element by accessibility text/description and tap its centre.
tap_text() {
  local needle="$1"
  local attempt
  for attempt in 1 2 3; do
    $ADB shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
    $ADB pull /sdcard/ui.xml "$OUT_DIR/last-ui.xml" >/dev/null 2>&1 || true
    local coords
    coords=$(node scripts/android/find-element.mjs "$OUT_DIR/last-ui.xml" "$needle" || true)
    if [ -n "$coords" ]; then
      echo "tap '$needle' at $coords"
      $ADB shell input tap $coords
      sleep 1.4
      return 0
    fi
    sleep 1
  done
  echo "⚠ element not found: $needle"
  return 1
}

back() { $ADB shell input keyevent 4; sleep 1; }
hide_keyboard() { $ADB shell input keyevent 111; sleep 0.6; }

# ---------------------------------------------------------------- first run --
shot 01-home

# Create a note and give it a title that is easy to find in later screenshots.
tap_text "Create a new note"
sleep 2.5
shot 02-new-note
tap_text "Note title"
$ADB shell input text 'Smoke%stest%snote'
sleep 3
shot 03-title-typed
hide_keyboard
back          # leave the editor
sleep 1.5
shot 04-home-after-create

# ------------------------------------------------- persistence after restart --
$ADB shell am force-stop com.notely.app
sleep 2
$ADB shell am start -W -n com.notely.app/.MainActivity >/dev/null
sleep 9
shot 05-after-restart
tap_text "Smoke test note"
sleep 2.5
shot 06-note-survived-restart
back
sleep 1

# ------------------------------------------------------------- tabs and settings
tap_text "Notebooks"
sleep 1.5
shot 07-notebooks
tap_text "Settings"
sleep 1.5
shot 08-settings
tap_text "Backup & restore"
sleep 1.5
shot 09-backup-restore
back
tap_text "Templates"
sleep 1.5
shot 10-templates
back
tap_text "Cloud sync"
sleep 1.5
shot 11-cloud-sync
back
tap_text "Spelling & grammar"
sleep 1
shot 12-spelling-settings
back
tap_text "Home"
sleep 1

# --------------------------------------------------------------- note options --
tap_text "Welcome"
sleep 2.5
shot 13-seeded-note
tap_text "Note options"
sleep 1.2
shot 14-note-options
tap_text "Share & export"
sleep 1.2
shot 15-share-export
tap_text "Markdown"
sleep 5
shot 16-android-share-sheet
$ADB shell dumpsys activity activities 2>/dev/null | grep -E "mResumedActivity|topResumedActivity" | head -3 > "$OUT_DIR/foreground.txt" || true
back          # dismiss the chooser
sleep 1
hide_keyboard
back          # close the share sheet
sleep 1

# ------------------------------------------------------------- insert + tools --
tap_text "Insert content"
sleep 1.2
shot 17-insert-sheet
tap_text "Scan"
sleep 1.5
shot 18-scan-sheet
back
sleep 0.6
tap_text "Voice typing"
sleep 2
shot 19-voice-typing
back
sleep 0.6
tap_text "Text style"
sleep 1.2
shot 20-text-style
back
sleep 0.6
tap_text "Find and replace"
sleep 1.2
shot 21-find-replace
back
sleep 0.6

# ----------------------------------------------------- page setup and versions --
tap_text "Note options"
sleep 1.2
tap_text "Page setup"
sleep 1.2
shot 22-page-setup
back
sleep 0.6
tap_text "Note options"
sleep 1.2
tap_text "Version history"
sleep 1.2
shot 23-version-history
back
sleep 0.6
tap_text "Note options"
sleep 1.2
tap_text "Comments"
sleep 1.2
shot 24-comments
back

# -------------------------------------------------------------------- search --
back
sleep 1
tap_text "Search"
sleep 1.5
$ADB shell input text "welcome"
sleep 2
shot 25-search-results
hide_keyboard
back
sleep 1
tap_text "Home"
sleep 1
shot 26-home-final

# ------------------------------------------------------------------- logcat --
$ADB logcat -d > "$OUT_DIR/logcat.txt" || true
if grep -q "FATAL EXCEPTION" "$OUT_DIR/logcat.txt"; then
  echo "::error::FATAL EXCEPTION in logcat"
  grep -A 20 "FATAL EXCEPTION" "$OUT_DIR/logcat.txt" | head -60
else
  echo "no fatal exceptions in logcat"
fi
grep -cE "ReactNativeJS.*(Error|Warning)" "$OUT_DIR/logcat.txt" > "$OUT_DIR/js-log-count.txt" 2>/dev/null || true
rm -f "$OUT_DIR/last-ui.xml"
ls -la "$OUT_DIR"
