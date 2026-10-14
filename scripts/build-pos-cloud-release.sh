#!/usr/bin/env bash
set -euo pipefail
# Secret files are mounted by the environment, never stored in this repository.
cd "$(dirname "$0")/.."
task_repo_root=$(pwd)
: "${ANDROID_HOME:?Configure the Linux Android SDK path in the environment}"
: "${GHR_POS_RELEASE_SIGNING_PROPERTIES:?Mount the existing release signing properties as a secret file}"
test -f "$GHR_POS_RELEASE_SIGNING_PROPERTIES" || { echo 'Release signing properties file is missing.' >&2; exit 1; }
test -f "$ANDROID_HOME/platforms/android-35/android.jar" || { echo 'Android SDK platform 35 is missing.' >&2; exit 1; }
test -d "$ANDROID_HOME/build-tools/35.0.0" || { echo 'Android Build Tools 35.0.0 are missing.' >&2; exit 1; }
test -d "$ANDROID_HOME/ndk/26.1.10909125" || { echo 'Android NDK 26.1.10909125 is missing.' >&2; exit 1; }
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/.gradle}"
cd "$task_repo_root/ghr-pos-mobile-native"
npm ci
cd android
# The repository rejects release builds without the existing release credentials.
bash gradlew --no-daemon :app:assembleRelease
task_apk=app/build/outputs/apk/release/app-release.apk
test -f "$task_apk"
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify "$task_apk"
sha256sum "$task_apk"
printf 'Release APK: %s/%s\n' "$PWD" "$task_apk"
