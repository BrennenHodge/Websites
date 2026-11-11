#!/usr/bin/env bash
# Publish helm-site/ to the gh-pages branch (served by GitHub Pages).
# Adds a normal commit on top of gh-pages; never rewrites its history.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
"$here/build.sh"

tmp="$(mktemp -d)"
cleanup() { git -C "$repo" worktree remove --force "$tmp" 2>/dev/null || true; }
trap cleanup EXIT

if git -C "$repo" fetch -q origin gh-pages 2>/dev/null; then
  git -C "$repo" worktree add -q --detach "$tmp" FETCH_HEAD
else
  git -C "$repo" worktree add -q --detach "$tmp"
  git -C "$tmp" checkout -q --orphan gh-pages-new
fi

# Replace the published files with the current site.
git -C "$tmp" rm -rqf --ignore-unmatch . >/dev/null
tar -C "$here" --exclude ./build.sh --exclude ./deploy.sh --exclude ./README.md -cf - . | tar -C "$tmp" -xf -
git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then
  echo "Nothing changed; site is up to date."
  exit 0
fi
git -C "$tmp" commit -qm "Deploy Helm site from $(git -C "$repo" rev-parse --short HEAD)"
git -C "$tmp" push origin HEAD:refs/heads/gh-pages
echo "Published to gh-pages."
