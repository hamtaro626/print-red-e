#!/usr/bin/env bash
# Run every check: the byte-level suite in Node, then the real page in
# headless Chrome, then open the zip the page produced with Finder's unzip
# (ditto) and read each photo's DPI with sips.
#
# The probe loads index.html in an iframe, so it has to run same-origin. It
# and its fixtures are copied into the project root only for the length of a
# run, then removed -- including if the run dies partway.
#
# Usage: test/verify.sh
# Exit:  0 all assertions passed, 1 otherwise

set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port="${PORT:-8911}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
probe="$root/__probe.html"
fixtures="$root/__fixtures"
profile="$(mktemp -d)"
results="$(mktemp)"
zip="$(mktemp)"
unzipped="$(mktemp -d)"

[ -x "$chrome" ] || { echo "Chrome not found at $chrome" >&2; exit 1; }

server_pid=""
chrome_pid=""
cleanup() {
  [ -n "$chrome_pid" ] && kill "$chrome_pid" 2>/dev/null
  [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null
  # Chrome keeps writing to its profile for a moment after SIGTERM.
  sleep 1
  rm -f "$probe" "$results" "$zip"
  rm -rf "$profile" "$fixtures" "$unzipped"
  return 0
}
trap cleanup EXIT INT TERM

echo "== dpi.js and prints.js against real files =="
node "$root/test/dpi.test.js"
node_status=$?

echo
echo "== the page, in headless Chrome =="
mkdir -p "$fixtures"
python3 "$root/test/make-fixtures.py" "$fixtures/a.png"
sips -s format jpeg -s dpiWidth 72 -s dpiHeight 72 "$fixtures/a.png" --out "$fixtures/b.jpg" >/dev/null
sips -s format jpeg -z 2000 3000 "$fixtures/a.png" --out "$fixtures/c.jpg" >/dev/null
echo "a shopping list, not a photo" > "$fixtures/notes.txt"
printf '\0\0\0\030ftypheic' > "$fixtures/IMG_0001.HEIC"   # just the start of a real HEIC
cp "$root/test/probe.html" "$probe"

python3 "$root/test/serve.py" "$port" "$root" "$results" "$zip" &
server_pid=$!
for _ in $(seq 1 40); do
  curl -sf "http://localhost:$port/index.html" >/dev/null && break
  sleep 0.25
done

"$chrome" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$profile" \
  "http://localhost:$port/__probe.html" >/dev/null 2>&1 &
chrome_pid=$!

for _ in $(seq 1 60); do
  [ -s "$results" ] && break
  sleep 0.5
done

if [ ! -s "$results" ]; then
  echo "FAIL: probe never reported (browser did not run it)" >&2
  exit 1
fi
cat "$results"; echo
grep -q "FAILED 0$" "$results"
page_status=$?

echo
echo "== the downloaded zip, opened like Finder would =="
zip_failed=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; zip_failed=$((zip_failed + 1)); }
if [ -s "$zip" ] && ditto -x -k "$zip" "$unzipped" 2>/dev/null; then
  pass "zip opens"
  names="$(ls "$unzipped" | sort | tr '\n' '|')"
  [ "$names" = "a.png|b (2).jpg|b.jpg|c.jpg|" ] && pass "zip holds a.png, b.jpg, b (2).jpg, c.jpg" || fail "zip names -- got $names"
  for f in "$unzipped"/*; do
    dpi="$(sips -g dpiWidth -g dpiHeight "$f" | awk '/dpi/ {print $2}' | tr '\n' ' ')"
    [ "$dpi" = "300.000 300.000 " ] && pass "sips reads 300 DPI: $(basename "$f")" \
      || fail "sips DPI for $(basename "$f") -- got $dpi"
  done
else
  fail "zip opens -- probe sent no zip, or ditto rejected it"
fi
echo "FAILED $zip_failed"

[ $node_status -eq 0 ] && [ $page_status -eq 0 ] && [ $zip_failed -eq 0 ]
