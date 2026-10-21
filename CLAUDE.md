# jarvis-installer

A single static page (GitHub Pages, `installer.jarvisautomation.io`) to download Jarvis
Automation (`jarvisd`, the server, and the desktop agent) from
[jarvis-server](https://github.com/alexberardi/jarvis-server)'s releases. See `README.md` for
the layout. User-facing text says "Jarvis Automation" for the product and "Jarvis" for the
assistant.

- **No framework, no dependencies.** `public/` is copied as-is; `scripts/build-site.py` (stdlib
  Python) renders `site/index.template.html` into `_site/index.html` with the newest
  jarvis-server release (prereleases included) baked in. Keep it plain HTML/CSS plus the small
  `copy.js`; don't add a framework or bundler. `package.json` has no dependencies: it only runs
  the Python scripts, so `npm test` / `npm run build` keep working.
- **Every release link comes from the GitHub API** (`browser_download_url`), never hand-built.
  A missing asset gets no button; the Releases page link is always on the page.
- **The installers are not here.** `install.sh`, `install.ps1`, `install-agent.sh` and
  `install-pi.sh` live in jarvis-server (`scripts/`) and ship as release assets. The commands on
  the page follow those scripts' headers: download, then run (never `curl | sh`).
- **TDD.** Tests are stdlib `unittest` in `tests/`, against `tests/fixtures/releases.json` (a
  real releases API response, trimmed). Write the failing test first.
- **Public repo:** no real hostnames, IPs, emails or keys.

## Verify

What `.github/workflows/check.yml` runs on every PR (no network):

```bash
python3 -m unittest discover tests
python3 scripts/build-site.py --fixture tests/fixtures/releases.json --out _site
python3 scripts/check-site.py _site
```

(`npm test` runs the same.) `python3 scripts/build-site.py` without `--fixture` builds against
the live API (`npm run build`). Preview: `python3 -m http.server -d _site 8000`.

## Merging (agents)

**A merge to `main` deploys the live site.** `.github/workflows/deploy.yml` runs the tests,
builds the page against the newest jarvis-server release, checks it and publishes
https://installer.jarvisautomation.io via GitHub Pages. It also rebuilds daily and on a
`jarvisd-release` repository_dispatch. What merges is what new users install.

An agent may squash-merge **its own** PR into `main` once every CI check has passed, then check
main's deploy run after the merge. **Hold for the user's review** instead, with a note saying
why, when the PR:

- touches `public/CNAME`, `scripts/**` or `.github/**`;
- changes an install command on the page or any URL it points at (the release resolution
  in `scripts/build-site.py` included);
- deletes, renames or weakens a test;
- is marked "needs review" by its author.

Never run a deploy or dispatch a workflow by hand, never merge someone else's PR, never
force-push to `main`.
