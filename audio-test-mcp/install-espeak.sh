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

# Force espeak-ng to use the extracted data, not its compiled system default.
mkdir -p "$PWD/../.espeak-bin"
cat > "$PWD/../.espeak-bin/espeak-ng" <<'WRAPPER'
#!/usr/bin/env bash
BASE="$(cd "$(dirname "$0")/.." && pwd)"
export ESPEAK_DATA_PATH="$BASE/.espeak-root/usr/share/espeak-ng-data"
export LD_LIBRARY_PATH="$BASE/.espeak-root/usr/lib/x86_64-linux-gnu:$BASE/.espeak-root/usr/lib:${LD_LIBRARY_PATH:-}"
exec "$BASE/.espeak-root/usr/bin/espeak-ng" "$@"
WRAPPER
chmod +x "$PWD/../.espeak-bin/espeak-ng"
"$PWD/../.espeak-bin/espeak-ng" --voices >/dev/null
"$PWD/../.espeak-bin/espeak-ng" -q -x "hello" >/dev/null
test -f "$ROOT/usr/share/espeak-ng-data/phontab"
