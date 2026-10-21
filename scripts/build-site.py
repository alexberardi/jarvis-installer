#!/usr/bin/env python3
"""Build the site into _site/: public/ as-is, plus index.html rendered from
site/index.template.html with the newest jarvis-server release baked in.

    python3 scripts/build-site.py                                  # newest release, from the GitHub API
    python3 scripts/build-site.py --fixture tests/fixtures/releases.json --out _site

Standard library only. Every download link comes from the release's own
browser_download_url: an asset the release doesn't have gets no button (never a dead
link), and the Releases page link is always on the page as the fallback.
"""
import argparse
import html
import json
import os
import shutil
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
TEMPLATE = ROOT / "site" / "index.template.html"

REPO = "alexberardi/jarvis-server"
RELEASES_URL = f"https://github.com/{REPO}/releases"
# The newest release by creation date, prereleases included: every release so far is a
# prerelease, and GitHub's releases/latest skips those (it 404s today).
# TODO: switch to releases/latest (api .../releases/latest, and releases/latest/download/... in
# the page) once jarvis-server publishes a non-prerelease.
API_URL = f"https://api.github.com/repos/{REPO}/releases?per_page=1"

DOCS_URL = "https://docs.jarvisautomation.dev/"
# Planned page (jarvis-docs #381); it doesn't exist yet.
MIGRATION_URL = "https://docs.jarvisautomation.dev/install/migrating-from-docker/"
# The mobile app's store listings. Left empty until they are published: an empty one is not
# rendered.
APP_STORE_URLS = {"App Store": "", "Google Play": ""}

# Download buttons: key -> (product, label, asset name; {v} is the tag without its "v").
DOWNLOADS = {
    "server-dmg": ("server", "macOS (Apple silicon)", "Jarvis-Automation-Server-{v}.dmg"),
    "server-exe": ("server", "Windows", "Jarvis-Automation-Server-Setup-{v}.exe"),
    "server-deb-amd64": ("server", "Debian / Ubuntu (amd64)", "jarvis-automation-server_{v}_amd64.deb"),
    "server-deb-arm64": ("server", "Debian / Ubuntu (arm64)", "jarvis-automation-server_{v}_arm64.deb"),
    "agent-dmg": ("agent", "macOS (Apple silicon)", "Jarvis-Automation-Agent-{v}.dmg"),
    "agent-exe": ("agent", "Windows", "Jarvis-Automation-Agent-Setup-{v}.exe"),
    "agent-deb-amd64": ("agent", "Debian / Ubuntu (amd64)", "jarvis-automation-agent_{v}_amd64.deb"),
    "agent-deb-arm64": ("agent", "Debian / Ubuntu (arm64)", "jarvis-automation-agent_{v}_arm64.deb"),
}
SCRIPTS = ("install.sh", "install.ps1", "install-agent.sh", "install-pi.sh", "SHA256SUMS")


class BuildError(Exception):
    pass


@dataclass
class Release:
    tag: str
    version: str
    prerelease: bool
    html_url: str
    assets: dict[str, str]  # key (DOWNLOADS or SCRIPTS) -> browser_download_url


def resolve(releases: list[dict]) -> Release:
    """The newest published release in an API releases list, with the page's assets."""
    published = [r for r in releases if not r.get("draft")]
    if not published:
        raise BuildError("no published jarvis-server release")
    r = published[0]
    tag = r["tag_name"]
    version = tag[1:] if tag.startswith("v") else tag
    uploaded = {a["name"]: a["browser_download_url"] for a in r.get("assets", []) if a.get("state", "uploaded") == "uploaded"}
    assets: dict[str, str] = {}
    for key, (_, _, name) in DOWNLOADS.items():
        if name.format(v=version) in uploaded:
            assets[key] = uploaded[name.format(v=version)]
    for name in SCRIPTS:
        if name in uploaded:
            assets[name] = uploaded[name]
    missing = [k for k in [*DOWNLOADS, *SCRIPTS] if k not in assets]
    if missing:
        print(f"::warning::{tag} has no {', '.join(missing)}: left off the page", file=sys.stderr)
    if not any(k in assets for k in [*DOWNLOADS, "install.sh", "install.ps1"]):
        raise BuildError(f"{tag} has no server installer")
    return Release(tag, version, bool(r.get("prerelease")), r["html_url"], assets)


def fetch(token: str | None) -> list[dict]:
    req = urllib.request.Request(API_URL, headers={"Accept": "application/vnd.github+json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def _e(s: str) -> str:
    return html.escape(s, quote=True)


def _downloads(rel: Release, product: str) -> str:
    rows = []
    for key, (p, label, _) in DOWNLOADS.items():
        if p == product and key in rel.assets:
            rows.append(f'<a class="button dl" href="{_e(rel.assets[key])}">{_e(label)}</a>')
    if not rows:
        rows.append(f'<a class="button ghost" href="{_e(RELEASES_URL)}">See the Releases page</a>')
    return "\n              ".join(rows)


def _command(cid: str, cmd: str) -> str:
    return (
        '<div class="cmd">\n'
        f'              <pre><code id="{cid}">{_e(cmd)}</code></pre>\n'
        f'              <button type="button" class="copy" data-copy="{cid}">Copy</button>\n'
        "            </div>"
    )


def _advanced(rel: Release) -> str:
    a = rel.assets
    blocks = []
    if "install.sh" in a:
        blocks.append(
            "<h4>Server: Linux and macOS</h4>\n"
            "            <p class=\"hint\">In a terminal. It asks for <code>sudo</code>; "
            "<code>sh install.sh --help</code> lists the options (for example <code>--user</code> "
            "on Linux, for a per-user service without root).</p>\n            "
            + _command("cmd-unix", f"curl -fsSLo install.sh {a['install.sh']} && sh install.sh")
        )
    if "install.ps1" in a:
        blocks.append(
            "<h4>Server: Windows</h4>\n"
            "            <p class=\"hint\">In PowerShell, as Administrator (or it asks for elevation).</p>\n            "
            + _command("cmd-win", f"irm {a['install.ps1']} | iex")
        )
    if "install-agent.sh" in a:
        blocks.append(
            "<h4>Agent: other Linux (Fedora, Arch, …)</h4>\n"
            "            <p class=\"hint\">Run it as yourself, not with <code>sudo</code>: the agent is per user.</p>\n            "
            + _command("cmd-agent", f"curl -fsSLo install-agent.sh {a['install-agent.sh']} && sh install-agent.sh")
        )
    if "install-pi.sh" in a:
        blocks.append(
            "<h4>Voice node: Raspberry Pi <span class=\"badge\">preview</span></h4>\n"
            "            <p class=\"hint\">A Raspberry Pi with the ReSpeaker 2-mics HAT. A preview: "
            "it installs next to the current Pi node and stays off until you pass "
            "<code>--activate</code>.</p>\n            "
            + _command("cmd-pi", f"curl -fsSLo install-pi.sh {a['install-pi.sh']} && sudo sh install-pi.sh")
        )
    if "SHA256SUMS" in a:
        blocks.append(
            "<p class=\"hint\">The scripts check what they download against the release's "
            f'<a href="{_e(a["SHA256SUMS"])}">SHA256SUMS</a>; '
            "check a downloaded installer the same way.</p>"
        )
    return "\n            ".join(blocks)


def _apps() -> str:
    links = [f'<a href="{_e(url)}">{_e(name)}</a>' for name, url in APP_STORE_URLS.items() if url]
    if not links:
        return "The Jarvis mobile app is coming to the app stores; the docs say when."
    return "Get the Jarvis mobile app: " + " · ".join(links) + "."


def render(rel: Release, template: str | None = None) -> str:
    page = template if template is not None else TEMPLATE.read_text(encoding="utf-8")
    values = {
        "tag": _e(rel.tag),
        "release_url": _e(rel.html_url),
        "releases_url": _e(RELEASES_URL),
        "docs_url": _e(DOCS_URL),
        "migration_url": _e(MIGRATION_URL),
        "server_downloads": _downloads(rel, "server"),
        "agent_downloads": _downloads(rel, "agent"),
        "advanced": _advanced(rel),
        "apps": _apps(),
    }
    for key, value in values.items():
        page = page.replace("{{" + key + "}}", value)
    if "{{" in page:
        raise BuildError("unknown placeholder left in the template: " + page[page.index("{{"):][:40])
    return page


def build(rel: Release, out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(PUBLIC, out)
    (out / "index.html").write_text(render(rel), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--fixture", type=Path, help="a releases API response to use instead of the network")
    ap.add_argument("--out", type=Path, default=ROOT / "_site")
    args = ap.parse_args()
    try:
        if args.fixture:
            releases = json.loads(args.fixture.read_text(encoding="utf-8"))
        else:
            releases = fetch(os.environ.get("GITHUB_TOKEN"))
        rel = resolve(releases)
        build(rel, args.out)
    except BuildError as e:
        print(f"::error::{e}", file=sys.stderr)
        return 1
    print(f"built {args.out} for {rel.tag}{' (prerelease)' if rel.prerelease else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
