"""Tests for scripts/build-site.py: release resolution and the rendered page's links.

Run with `python3 -m unittest discover tests` (standard library only, no network).
"""
import copy
import importlib.util
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "releases.json"

_spec = importlib.util.spec_from_file_location("build_site", ROOT / "scripts" / "build-site.py")
build_site = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_site)

BASE = "https://github.com/alexberardi/jarvis-server/releases/download/v0.1.0-rc17/"


def load_fixture() -> list[dict]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag, attrs) -> None:
        href = dict(attrs).get("href")
        if href:
            self.hrefs.append(href)


def hrefs(html: str) -> list[str]:
    p = Links()
    p.feed(html)
    return p.hrefs


class ResolveRelease(unittest.TestCase):
    def test_tag_version_and_every_asset(self) -> None:
        rel = build_site.resolve(load_fixture())
        self.assertEqual(rel.tag, "v0.1.0-rc17")
        self.assertEqual(rel.version, "0.1.0-rc17")
        self.assertTrue(rel.prerelease)
        self.assertEqual(rel.html_url, "https://github.com/alexberardi/jarvis-server/releases/tag/v0.1.0-rc17")
        want = {
            "server-dmg": "Jarvis-Automation-Server-0.1.0-rc17.dmg",
            "server-exe": "Jarvis-Automation-Server-Setup-0.1.0-rc17.exe",
            "server-deb-amd64": "jarvis-automation-server_0.1.0-rc17_amd64.deb",
            "server-deb-arm64": "jarvis-automation-server_0.1.0-rc17_arm64.deb",
            "agent-dmg": "Jarvis-Automation-Agent-0.1.0-rc17.dmg",
            "agent-exe": "Jarvis-Automation-Agent-Setup-0.1.0-rc17.exe",
            "agent-deb-amd64": "jarvis-automation-agent_0.1.0-rc17_amd64.deb",
            "agent-deb-arm64": "jarvis-automation-agent_0.1.0-rc17_arm64.deb",
            "install.sh": "install.sh",
            "install.ps1": "install.ps1",
            "install-agent.sh": "install-agent.sh",
            "install-pi.sh": "install-pi.sh",
            "SHA256SUMS": "SHA256SUMS",
        }
        self.assertEqual(rel.assets, {k: BASE + v for k, v in want.items()})

    def test_skips_drafts(self) -> None:
        releases = load_fixture()
        draft = copy.deepcopy(releases[0])
        draft.update(tag_name="v0.1.0-rc18", draft=True)
        rel = build_site.resolve([draft] + releases)
        self.assertEqual(rel.tag, "v0.1.0-rc17")

    def test_no_release_fails(self) -> None:
        with self.assertRaises(build_site.BuildError):
            build_site.resolve([])

    def test_missing_asset_is_left_out(self) -> None:
        releases = load_fixture()
        releases[0]["assets"] = [a for a in releases[0]["assets"] if not a["name"].endswith(".dmg")]
        rel = build_site.resolve(releases)
        self.assertNotIn("server-dmg", rel.assets)
        self.assertNotIn("agent-dmg", rel.assets)
        self.assertIn("server-exe", rel.assets)

    def test_asset_not_uploaded_is_left_out(self) -> None:
        releases = load_fixture()
        for a in releases[0]["assets"]:
            if a["name"] == "install.sh":
                a["state"] = "starter"
        rel = build_site.resolve(releases)
        self.assertNotIn("install.sh", rel.assets)

    def test_no_installer_at_all_fails(self) -> None:
        releases = load_fixture()
        releases[0]["assets"] = [a for a in releases[0]["assets"] if a["name"] == "SHA256SUMS"]
        with self.assertRaises(build_site.BuildError):
            build_site.resolve(releases)


class RenderPage(unittest.TestCase):
    def render(self, releases: list[dict] | None = None) -> str:
        return build_site.render(build_site.resolve(releases or load_fixture()))

    def test_every_asset_link_is_in_the_fixture(self) -> None:
        urls = {a["browser_download_url"] for a in load_fixture()[0]["assets"]}
        links = [h for h in hrefs(self.render()) if "/releases/download/" in h]
        self.assertGreaterEqual(len(links), 8 + 1)  # 8 download buttons and SHA256SUMS
        for h in links:
            self.assertIn(h, urls)

    def test_every_asset_url_in_the_text_is_in_the_fixture(self) -> None:
        # The one-liners are text in <code>, not hrefs: check those URLs too.
        import re

        urls = {a["browser_download_url"] for a in load_fixture()[0]["assets"]}
        found = re.findall(r"https://github\.com/[^\s\"'<>]*/releases/download/[^\s\"'<>]+", self.render())
        self.assertTrue(found)
        for u in found:
            self.assertIn(u, urls)

    def test_buttons_for_server_and_agent(self) -> None:
        links = set(hrefs(self.render()))
        for key in build_site.DOWNLOADS:
            self.assertIn(build_site.resolve(load_fixture()).assets[key], links, key)

    def test_one_liners_download_then_run(self) -> None:
        html = self.render()
        self.assertIn(f"curl -fsSLo install.sh {BASE}install.sh &amp;&amp; sh install.sh", html)
        self.assertIn(f"irm {BASE}install.ps1 | iex", html)
        self.assertIn(f"curl -fsSLo install-agent.sh {BASE}install-agent.sh &amp;&amp; sh install-agent.sh", html)
        self.assertIn(f"curl -fsSLo install-pi.sh {BASE}install-pi.sh &amp;&amp; sudo sh install-pi.sh", html)
        self.assertNotIn("| sh", html)

    def test_releases_fallback_and_no_latest_while_prerelease(self) -> None:
        html = self.render()
        self.assertIn("https://github.com/alexberardi/jarvis-server/releases", hrefs(html))
        self.assertNotIn("releases/latest", html)

    def test_prerelease_note_setup_link_and_docs(self) -> None:
        html = self.render()
        self.assertIn("pre-release", html)
        self.assertIn("v0.1.0-rc17", html)
        self.assertIn("http://&lt;host&gt;:7710/setup", html)
        links = hrefs(html)
        self.assertIn(build_site.DOCS_URL, links)
        self.assertIn(build_site.MIGRATION_URL, links)
        self.assertIn("Jarvis Automation", html)

    def test_missing_asset_renders_no_dead_link(self) -> None:
        releases = load_fixture()
        releases[0]["assets"] = [a for a in releases[0]["assets"] if not a["name"].endswith(".dmg")]
        html = self.render(releases)
        self.assertNotIn(".dmg", html)
        self.assertIn("https://github.com/alexberardi/jarvis-server/releases", hrefs(html))

    def test_no_placeholder_left(self) -> None:
        self.assertNotIn("{{", self.render())


class BuildDir(unittest.TestCase):
    def test_build_writes_a_site_that_passes_the_check(self) -> None:
        import tempfile

        spec = importlib.util.spec_from_file_location("check_site", ROOT / "scripts" / "check-site.py")
        check_site = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(check_site)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "_site"
            build_site.build(build_site.resolve(load_fixture()), out)
            self.assertTrue((out / "index.html").is_file())
            self.assertTrue((out / "CNAME").is_file())
            self.assertTrue((out / "style.css").is_file())
            self.assertEqual(check_site.check_dir(out), [])


if __name__ == "__main__":
    unittest.main()
