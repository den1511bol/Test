#!/usr/bin/env bash
# HackSim APK builder - Developer: @yfeeeee
# Запуск: bash build_apk.sh
# Работает на Linux, macOS и Windows через WSL. Нужны: java 17+, curl, unzip.
# Скрипт сам скачает Android SDK и Gradle, соберёт проект и положит HackSim.apk рядом.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

SDK="${ANDROID_HOME:-$HOME/android-sdk}"
GRADLE_VER="8.10.2"
CMDTOOLS_BUILD="11076708"

echo "== HackSim: сборка APK =="

for tool in java curl unzip; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Ошибка: не найден '$tool'. Установи его и запусти снова."; exit 1; }
done

JAVA_MAJOR="$(java -version 2>&1 | head -1 | sed -E 's/.*"([0-9]+).*/\1/')"
if [ "${JAVA_MAJOR:-0}" -lt 17 ]; then
  echo "Ошибка: нужна Java 17 или новее (сейчас: ${JAVA_MAJOR:-неизвестно})."
  echo "Ubuntu/Debian: sudo apt install openjdk-17-jdk"
  exit 1
fi

OS="linux"
if [ "$(uname)" = "Darwin" ]; then OS="mac"; fi

# 1. Android command-line tools
if [ ! -x "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "-> Скачиваю Android command-line tools..."
  mkdir -p "$SDK/cmdline-tools"
  TMP_ZIP="$(mktemp -t cmdtools.XXXXXX).zip"
  curl -fL -o "$TMP_ZIP" "https://dl.google.com/android/repository/commandlinetools-${OS}-${CMDTOOLS_BUILD}_latest.zip"
  unzip -q -o "$TMP_ZIP" -d "$SDK/cmdline-tools"
  rm -f "$TMP_ZIP"
  rm -rf "$SDK/cmdline-tools/latest"
  mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
fi

export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"

# 2. Лицензии и пакеты SDK
echo "-> Принимаю лицензии и ставлю платформу и build-tools..."
yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
"$SDKMANAGER" "platform-tools" "platforms;android-35" "build-tools;35.0.0"

echo "sdk.dir=$SDK" > "$ROOT/local.properties"

# 3. Gradle: свой wrapper, если есть, иначе скачиваем дистрибутив
if [ -x "$ROOT/gradlew" ]; then
  GRADLE_CMD="$ROOT/gradlew"
else
  GRADLE_HOME="$HOME/.hacksim-gradle/gradle-$GRADLE_VER"
  if [ ! -x "$GRADLE_HOME/bin/gradle" ]; then
    echo "-> Скачиваю Gradle $GRADLE_VER..."
    mkdir -p "$HOME/.hacksim-gradle"
    TMP_G="$(mktemp -t gradle.XXXXXX).zip"
    curl -fL -o "$TMP_G" "https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip"
    unzip -q -o "$TMP_G" -d "$HOME/.hacksim-gradle"
    rm -f "$TMP_G"
  fi
  GRADLE_CMD="$GRADLE_HOME/bin/gradle"
fi

# 4. Сборка
echo "-> Собираю APK (первый раз это долго: качаются зависимости)..."
"$GRADLE_CMD" assembleDebug --no-daemon

APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "Ошибка: APK не найден, сборка не удалась. Пришли лог выше разработчику."
  exit 1
fi

cp "$APK" "$ROOT/HackSim.apk"
echo ""
echo "ГОТОВО: $ROOT/HackSim.apk"
echo "Перекинь файл на телефон и установи (разреши установку из неизвестных источников)."
