#!/usr/bin/env bash
# Tag a release from main and push the tag; the Release workflow does the rest.
#
#   scripts/release.sh patch|minor|major
#
# Works out the next version from the latest vX.Y.Z tag, shows what's going
# out, asks for confirmation, then pushes an annotated tag.
set -euo pipefail

bump=${1:-}
case "$bump" in
  patch | minor | major) ;;
  *) echo "Usage: $0 patch|minor|major" >&2; exit 1 ;;
esac

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then
  echo "Releases are tagged from main (you are on '$branch')." >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "You have uncommitted changes; commit or stash them first." >&2
  exit 1
fi

git fetch --quiet --tags origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Local main differs from origin/main; pull (or push) first." >&2
  exit 1
fi

last=$(git tag -l 'v*' --merged origin/main --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)
last=${last:-v0.0.0}
IFS=. read -r major minor patch <<<"${last#v}"
case "$bump" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac
tag="v${major}.${minor}.${patch}"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "Tag $tag already exists but isn't on main; delete it first (git push origin :refs/tags/$tag)." >&2
  exit 1
fi

if [ "$last" != "v0.0.0" ]; then
  if [ -z "$(git rev-list "$last"..HEAD)" ]; then
    echo "Nothing to release: main has no commits since $last." >&2
    exit 1
  fi
  echo "Changes since $last:"
  # One line per PR: GitHub merge commits carry the PR title in their body.
  git log --first-parent --format='%H' "$last"..HEAD | while read -r sha; do
    subject=$(git log -1 --format=%s "$sha")
    case "$subject" in
      "Merge pull request #"*)
        number=${subject#Merge pull request #}
        title=$(git log -1 --format=%b "$sha" | sed '/^[[:space:]]*$/d' | head -n1)
        echo "  ${title:-$subject} (#${number%% *})" ;;
      *) echo "  $subject" ;;
    esac
  done
  echo
fi

read -r -p "Release $tag ($bump, previous $last)? [y/N] " answer
case "$answer" in
  y | Y) ;;
  *) echo "Aborted."; exit 1 ;;
esac

git tag -a "$tag" -m "Release $tag ($bump)"
git push origin "$tag"
echo "Pushed $tag. Follow the build with: gh run watch"
