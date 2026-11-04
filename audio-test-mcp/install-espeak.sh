#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD/.espeak-root"
CACHE="$PWD/.espeak-debs"
LISTS="$PWD/.apt-lists"
mkdir -p "$ROOT" "$CACHE" "$LISTS/partial"
export DEBIAN_FRONTEND=noninteractive
APT=(-o "Dir::State::lists=$LISTS" -o "Dir::Cache::archives=$CACHE" -o "APT::Get::List-Cleanup=0")
apt-get "${APT[@]}" update -qq
cd "$CACHE"
for pkg in espeak-ng espeak-ng-data libespeak-ng1 libpcaudio0 libsonic0; do
  apt-get "${APT[@]}" download "$pkg" || echo "Optional package unavailable: $pkg"
done
for deb in ./*.deb; do
  [ -f "$deb" ] && dpkg-deb -x "$deb" "$ROOT"
done
test -x "$ROOT/usr/bin/espeak-ng"
echo "Local espeak-ng extracted successfully"
