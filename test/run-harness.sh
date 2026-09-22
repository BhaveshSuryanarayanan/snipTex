#!/bin/sh
# Runs test/harness.html in headless Chromium and prints each case's Markdown.
# Files are copied under ~/snap/chromium/common because snap browsers cannot
# read arbitrary paths.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
D="$HOME/snap/chromium/common/sniptex-harness"
rm -rf "$D" && mkdir -p "$D/test"
cp -r "$ROOT/vendor" "$ROOT/content.js" "$D/"
cp "$ROOT/test/harness.html" "$D/test/"
chromium --headless --disable-gpu --dump-dom "file://$D/test/harness.html" 2>/dev/null |
python3 -c '
import sys, html, re
s = sys.stdin.read()
m = re.search(r"<div id=\"results\">(.*?)</div>\s*<script", s, re.S)
out = re.sub(r"<h3>(.*?)</h3>", r"=== \1 ===\n", m.group(1))
out = out.replace("<pre class=\"out\">", "").replace("</pre>", "\n")
print(html.unescape(out))
'
