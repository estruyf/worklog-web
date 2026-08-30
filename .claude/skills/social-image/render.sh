#!/usr/bin/env bash
# Render a social card to PNG at 2x. Usage: render.sh <card.html> <out.png>
#
# Headless Chrome rather than a screenshot library: the card is one HTML file
# with no build step, and this repo already has no image toolchain to add to.
set -euo pipefail

CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
if [ ! -x "$CHROME" ]; then
  echo "No Chrome at: $CHROME — set CHROME=/path/to/chrome" >&2
  exit 1
fi

src=${1:?usage: render.sh <card.html> <out.png>}
out=${2:?usage: render.sh <card.html> <out.png>}
# Chrome resolves both against its own cwd, so hand it absolute paths.
src="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
case "$out" in /*) ;; *) out="$PWD/$out" ;; esac

# The window is the card: <body> is exactly 1200x630, so the viewport shot is the
# whole thing with nothing cropped and no page scroll. 2x because every network
# resamples what you upload, and a 1x card lands soft.
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1200,630 \
  --screenshot="$out" "$src" 2>/dev/null

echo "$out — $(file -b "$out")"
