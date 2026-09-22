#!/bin/sh
# Runs the offline checks in headless Chromium and prints their output:
#   harness.html     selection -> Markdown conversion cases
#   background.html  background.js loads against an API stub
#   options.html     options page shortcut capture, save/reset, format setting
# Files are copied under ~/snap/chromium/common because snap browsers cannot
# read arbitrary paths.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
D="$HOME/snap/chromium/common/sniptex-harness"
rm -rf "$D" && mkdir -p "$D"
cp -r "$ROOT/vendor" "$ROOT/options" "$ROOT/test" "$ROOT/content.js" "$ROOT/background.js" "$D/"

run() {
  echo "##### $1"
  chromium --headless --disable-gpu --allow-file-access-from-files \
    --virtual-time-budget=3000 --dump-dom "file://$D/test/$1" 2>/dev/null |
  python3 -c '
import sys, html, re
s = sys.stdin.read()
m = re.search(r"<div id=\"results\">(.*?)</div>\s*<script", s, re.S)
if m:
    out = re.sub(r"<h3>(.*?)</h3>", r"=== \1 ===\n", m.group(1))
    out = out.replace("<pre class=\"out\">", "").replace("</pre>", "\n")
else:
    m = re.search(r"<pre id=\"out\">(.*?)</pre>", s, re.S)
    out = m.group(1) if m else "NO OUTPUT"
print(html.unescape(out))
'
}

run harness.html
run background.html
run options.html
