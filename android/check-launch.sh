#!/usr/bin/env bash
set -euo pipefail

regular=app.mostap.mimorta.preview
isolated="$regular.qa"
activity="$regular.DiaryActivity"
apk=android/app/build/outputs/apk/debug/app-debug.apk

adb install "$RUNNER_TEMP/regular.apk"
adb install "$apk"
adb shell pm path "$regular"
adb shell pm path "$isolated"

check_welcome() {
    adb shell am start -W -n "$isolated/$activity"
    for attempt in {1..10}; do
        if adb shell uiautomator dump /sdcard/mimo-window.xml >/dev/null &&
           adb shell cat /sdcard/mimo-window.xml | grep -F 'Начать' >/dev/null; then
            echo "Welcome screen rendered"
            return
        fi
        sleep 1
    done
    adb logcat -d -b crash
    return 1
}

check_welcome
adb shell am force-stop "$isolated"
check_welcome
