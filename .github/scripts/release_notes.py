"""Check a release tag and write its release notes.

Run by the Release workflow when a vX.Y.Z tag is pushed:

    python3 .github/scripts/release_notes.py v2.4.0 --repo owner/name \
        --image-prefix ghcr.io/owner/name --out notes.md

It fails if the tag isn't a valid next version after the previous release
(e.g. v2.3.2 -> v2.5.0 skips v2.4.0), or isn't on main. Otherwise it works
out the bump type from the two versions, writes the notes and prints
version / prev_tag / bump as KEY=value lines for $GITHUB_OUTPUT.

The notes list the PRs merged into main since the previous release, grouped
by their conventional-commit title (feat, fix, ...), and say which database
migrations the release adds.
"""
import argparse
import re
import subprocess
import sys

TAG_RE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
TITLE_RE = re.compile(r"^(?P<type>[a-z]+)(?:\([^)]*\))?(?P<bang>!)?:\s*(?P<text>.+)$")
MERGE_RE = re.compile(r"^Merge pull request #(\d+) from ")
SQUASH_RE = re.compile(r"^(?P<title>.+) \(#(?P<num>\d+)\)$")

BUMP_INTRO = {
    "major": "**Major release**: contains breaking changes. Read the notes before deploying.",
    "minor": "**Minor release**: new features, backwards compatible.",
    "patch": "**Patch release**: fixes and small improvements, no new features.",
    "initial": "**First release.**",
}

# Section order in the notes; types not listed go under "Other changes".
SECTIONS = [
    ("breaking", "Breaking changes"),
    ("feat", "New features"),
    ("fix", "Fixes"),
    ("perf", "Performance"),
    ("internal", "Under the hood"),
    ("other", "Other changes"),
]
INTERNAL_TYPES = {"chore", "ci", "build", "refactor", "test", "docs", "style"}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def parse_version(tag: str) -> tuple[int, int, int]:
    m = TAG_RE.match(tag)
    if not m:
        raise SystemExit(f"Tag {tag!r} is not of the form vMAJOR.MINOR.PATCH (e.g. v2.4.0)")
    return tuple(int(x) for x in m.groups())


def previous_tag(tag: str) -> str | None:
    """The highest vX.Y.Z tag below this one in its history (stray tags elsewhere are ignored)."""
    current = parse_version(tag)
    reachable = git("tag", "-l", "v*", "--merged", tag).split()
    older = [t for t in reachable if TAG_RE.match(t) and parse_version(t) < current]
    return max(older, key=parse_version) if older else None


def bump_type(prev: str | None, tag: str) -> str:
    if prev is None:
        return "initial"
    (a, b, c), new = parse_version(prev), parse_version(tag)
    expected = {"major": (a + 1, 0, 0), "minor": (a, b + 1, 0), "patch": (a, b, c + 1)}
    for bump, version in expected.items():
        if new == version:
            return bump
    options = ", ".join(f"v{x}.{y}.{z} ({k})" for k, (x, y, z) in expected.items())
    raise SystemExit(f"{tag} is not the next version after {prev}. Expected one of: {options}")


def changes(prev: str | None, tag: str) -> list[dict]:
    """One entry per PR (or direct commit) on main's first-parent history."""
    rev_range = f"{prev}..{tag}" if prev else tag
    log = git("log", "--first-parent", "--reverse", "--format=%s%x1f%b%x1e", rev_range)
    entries = []
    for record in filter(None, (r.strip("\n") for r in log.split("\x1e"))):
        subject, _, body = record.partition("\x1f")
        number = None
        if m := MERGE_RE.match(subject):
            # GitHub merge commit: the PR title is the first line of the body.
            number = m.group(1)
            title = next((line for line in body.splitlines() if line.strip()), subject)
        elif m := SQUASH_RE.match(subject):
            number, title = m.group("num"), m.group("title")
        else:
            title = subject
        entries.append({"title": title.strip(), "number": number, "body": body})
    return entries


def section_of(entry: dict) -> tuple[str, str]:
    m = TITLE_RE.match(entry["title"])
    if not m:
        return "other", entry["title"]
    text = m.group("text")
    if m.group("bang") or "BREAKING CHANGE" in entry["body"]:
        return "breaking", text
    kind = m.group("type")
    if kind in ("feat", "fix", "perf"):
        return kind, text
    return ("internal" if kind in INTERNAL_TYPES else "other"), text


def new_migrations(prev: str | None, tag: str) -> list[str]:
    if prev is None:
        return []
    out = git("diff", "--name-only", "--diff-filter=A", prev, tag, "--", "backend/alembic/versions/")
    return sorted(p.rsplit("/", 1)[-1].removesuffix(".py") for p in out.split() if p.endswith(".py"))


def warn(message: str) -> None:
    print(f"::warning title=Release bump::{message}", file=sys.stderr)


def build_notes(tag: str, prev: str | None, bump: str, repo: str, image_prefix: str) -> str:
    version = tag[1:]
    grouped: dict[str, list[str]] = {key: [] for key, _ in SECTIONS}
    for entry in changes(prev, tag):
        key, text = section_of(entry)
        ref = f" (#{entry['number']})" if entry["number"] else ""
        grouped[key].append(f"- {text[:1].upper()}{text[1:]}{ref}")

    if bump == "patch" and grouped["feat"]:
        warn(f"{tag} is a patch release but includes new features; a minor bump may fit better.")
    if bump in ("patch", "minor") and grouped["breaking"]:
        warn(f"{tag} is a {bump} release but includes breaking changes; a major bump may fit better.")

    intro = BUMP_INTRO[bump] + (f" ({prev} → {tag})" if prev else "")
    parts = [intro]
    for key, heading in SECTIONS:
        if grouped[key]:
            parts.append(f"## {heading}\n\n" + "\n".join(grouped[key]))
    if len(parts) == 1:
        parts.append("No changes since the previous release.")

    migrations = new_migrations(prev, tag)
    migration_line = (
        "- **Database migrations:** "
        + ", ".join(f"`{m}`" for m in migrations)
        + ". They run automatically when the backend starts; take a backup before deploying."
        if migrations
        else "- **Database migrations:** none."
    )
    parts.append(
        "## Deployment\n\n"
        f"{migration_line}\n"
        f"- **Images:** `{image_prefix}-backend:{version}` and `{image_prefix}-frontend:{version}`\n"
        "- **Deploy:** set the image tags in server-config "
        "(`manifests/skilta-piikki/backend` and `frontend`)."
    )
    if prev:
        parts.append(f"**Full changelog:** https://github.com/{repo}/compare/{prev}...{tag}")
    return "\n\n".join(parts) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("tag")
    parser.add_argument("--repo", required=True)
    parser.add_argument("--image-prefix", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--branch", default="origin/main", help="branch the tag must be on")
    args = parser.parse_args()

    parse_version(args.tag)
    try:
        git("merge-base", "--is-ancestor", args.tag, args.branch)
    except subprocess.CalledProcessError:
        raise SystemExit(f"{args.tag} is not on {args.branch}; releases are tagged from main")

    prev = previous_tag(args.tag)
    bump = bump_type(prev, args.tag)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(build_notes(args.tag, prev, bump, args.repo, args.image_prefix))

    print(f"version={args.tag[1:]}")
    print(f"prev_tag={prev or ''}")
    print(f"bump={bump}")


if __name__ == "__main__":
    main()
