#!/usr/bin/env bash
set -euo pipefail
regular=app.mostap.mimorta.preview
isolated="$regular.diaryqa"
activity="$regular.DiaryActivity"
apk=android/app/build/outputs/apk/debug/app-debug.apk

adb install "$RUNNER_TEMP/regular.apk"
adb install "$apk"
adb shell pm path "$regular"
adb shell pm path "$isolated"
adb shell dumpsys webviewupdate | grep 'Current WebView package'
inspect_screen() {
    local pid
    pid=$(adb shell pidof -s "$isolated" | tr -d '\r')
    adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
    if ! node android/check-screen.cjs "$1"; then
        adb logcat -d -b crash
        adb logcat -d -s chromium:I | tail -40
        return 1
    fi
    adb forward --remove tcp:9222
}
check_screen() {
    adb shell am start -W -n "$isolated/$activity"
    inspect_screen "$1"
}
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
check_screen welcome
adb shell am force-stop "$isolated"
check_screen diary
adb shell input keyevent KEYCODE_HOME
inspect_screen rollover-prepare
check_screen rollover-resume
