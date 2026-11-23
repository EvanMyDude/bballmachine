#!/usr/bin/env bash
# Assemble the deployable static site (game files only).
#
# Every relative module import, the entry script and the stylesheet get a
# ?v=<version> stamp. Browsers cache GitHub Pages files for ~10 minutes, and an
# ES-module game breaks if a returning player gets a fresh main.js alongside a
# stale cached module from the previous deploy. Stamping makes every deploy a
# complete, self-consistent set of URLs.
#
#   scripts/build-site.sh [out_dir=_site] [version=<git short sha>]
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-_site}"
VER="${2:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"

rm -rf "$OUT"
mkdir -p "$OUT"
cp index.html styles.css "$OUT"/
cp -r src "$OUT"/

find "$OUT/src" -name '*.js' -print0 |
  xargs -0 perl -pi -e "s#(from\s+'(?:\./|\.\./)[^'?]+?\.js)'#\$1?v=$VER'#g"
perl -pi -e "s#src=\"src/main\.js\"#src=\"src/main.js?v=$VER\"#; s#href=\"styles\.css\"#href=\"styles.css?v=$VER\"#" "$OUT/index.html"

# sanity: nothing left unstamped
if grep -rnE "from '\.{1,2}/[^'?]+\.js'" "$OUT/src"; then
  echo "error: unstamped module import(s) above" >&2
  exit 1
fi
grep -q "src/main.js?v=$VER" "$OUT/index.html" || { echo "error: entry script not stamped" >&2; exit 1; }
echo "site built in $OUT (v=$VER)"
