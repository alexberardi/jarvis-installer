#!/usr/bin/env python3
"""Minimal check of the static site in public/: the HTML parses with balanced tags,
every local href/src points at a file that exists, and copy buttons have a target.

Standard library only. External links are not fetched: the install URLs use
releases/latest, which 404s until jarvis-server's first non-prerelease.
"""
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "public"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Checker(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.stack: list[str] = []
        self.refs: list[str] = []
        self.ids: set[str] = set()
        self.copy_targets: list[str] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        if "id" in a and a["id"]:
            if a["id"] in self.ids:
                self.errors.append(f"duplicate id {a['id']!r}")
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append(a[key])
        if tag == "img" and not a.get("alt"):
            self.errors.append(f"<img src={a.get('src')!r}> has no alt text")
        if a.get("data-copy"):
            self.copy_targets.append(a["data-copy"])
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"unexpected </{tag}> at line {self.getpos()[0]} (open: {self.stack[-3:]})")
            return
        self.stack.pop()


def check(page: Path) -> list[str]:
    c = Checker()
    c.feed(page.read_text(encoding="utf-8"))
    c.close()
    errors = [f"{page.name}: {e}" for e in c.errors]
    if c.stack:
        errors.append(f"{page.name}: unclosed tags {c.stack}")
    for ref in c.refs:
        if ref.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target = SITE / ref.lstrip("/").split("#")[0].split("?")[0]
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            errors.append(f"{page.name}: broken local link {ref!r}")
    for t in c.copy_targets:
        if t not in c.ids:
            errors.append(f"{page.name}: copy button targets missing id {t!r}")
    return errors


def main() -> int:
    errors: list[str] = []
    for page in sorted(SITE.glob("*.html")):
        errors += check(page)
    if not (SITE / "CNAME").is_file():
        errors.append("public/CNAME is missing")
    for e in errors:
        print(f"::error::{e}")
    print("site check: ok" if not errors else f"site check: {len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
