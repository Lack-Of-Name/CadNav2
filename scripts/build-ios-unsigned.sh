#!/usr/bin/env bash
#
# Build an unsigned iOS .ipa locally on macOS.
#
# Apple's toolchain (xcodebuild) only runs on macOS, so this script refuses to
# run elsewhere. It produces an unsigned device build, which is useful for
# initial testing via TrollStore, a jailbroken device, or re-signing with a
# development certificate later.
#
# Usage:
#   npm run build:ios:unsigned
#   npm run build:ios:unsigned -- versions/v1.2.1-unsigned.ipa
#
# Requires: macOS, Xcode command line tools, CocoaPods.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS builds require macOS with Xcode. Current platform: $(uname -s)" >&2
  echo "Run this script on a Mac, or use EAS Build." >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild was not found. Install Xcode and run 'xcode-select --install'." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
OUT="${1:-versions/v${VERSION}-unsigned.ipa}"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

echo "==> Prebuilding iOS project (Expo)"
CI=1 npx expo prebuild --platform ios --clean --no-install

if command -v pod >/dev/null 2>&1; then
  echo "==> Installing CocoaPods"
  (cd ios && pod install)
else
  echo "==> CocoaPods not found; trying npx pod-install"
  npx pod-install ios
fi

PROJECT="$(find ios -maxdepth 1 -name '*.xcodeproj' -print -quit)"
WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
if [[ -z "$PROJECT" || -z "$WORKSPACE" ]]; then
  echo "Could not find the generated Xcode project/workspace under ios/." >&2
  exit 1
fi

SCHEME="$(node -e '
  const { execFileSync } = require("node:child_process");
  const raw = execFileSync("xcodebuild", ["-list", "-project", process.argv[1], "-json"], { encoding: "utf8" });
  const parsed = JSON.parse(raw);
  const schemes = parsed?.project?.schemes ?? parsed?.workspace?.schemes ?? [];
  if (!schemes.length) process.exit(1);
  process.stdout.write(schemes[0]);
' "$PROJECT")"

echo "==> Archiving $SCHEME (unsigned)"
ARCHIVE="$BUILD_DIR/CadNav.xcarchive"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  EXPANDED_CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM="" \
  archive

APP="$(find "$ARCHIVE/Products/Applications" -maxdepth 1 -name '*.app' -print -quit)"
if [[ -z "$APP" ]]; then
  echo "Archive succeeded but no .app was produced." >&2
  exit 1
fi

echo "==> Packaging $OUT"
mkdir -p "$BUILD_DIR/Payload"
cp -R "$APP" "$BUILD_DIR/Payload/"
mkdir -p "$(dirname "$OUT")"
OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
(cd "$BUILD_DIR" && ditto -c -k --sequesterRsrc --keepParent Payload "$OUT_ABS")

echo "==> Done: $OUT"
echo "This IPA is unsigned. Install on a jailbroken/TrollStore device or re-sign it before use on a stock device."
