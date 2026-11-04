#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .espeak-debs .espeak-root
cd .espeak-debs
for pkg in espeak-ng espeak-ng-data libespeak-ng1 libpcaudio0 libsonic0; do
  apt-get download "$pkg" || echo "Optional package unavailable: $pkg"
done
for deb in ./*.deb; do [ -f "$deb" ] && dpkg-deb -x "$deb" ../.espeak-root; done
test -x ../.espeak-root/usr/bin/espeak-ng
echo "Local espeak-ng extracted"
