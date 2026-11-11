#!/usr/bin/env bash
# Rebuild generated files: icons and the downloadable extension zip.
# The OG image and screenshots are made with Playwright (see README).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ext="$here/../helm-newtab"

cp "$ext/icons/icon32.png" "$ext/icons/icon128.png" "$here/assets/"

tmp="$(mktemp -d)"
mkdir "$tmp/helm"
(cd "$ext" && cp -r manifest.json background.js newtab.html newtab.css newtab.js lib icons examples README.md screenshot.png "$tmp/helm/")
rm -f "$here/helm.zip"
(cd "$tmp" && python3 -c "
import os, zipfile
with zipfile.ZipFile('$here/helm.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk('helm'):
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, p)
")
rm -rf "$tmp"
touch "$here/.nojekyll"
echo "built helm.zip ($(du -k "$here/helm.zip" | cut -f1) KB)"
