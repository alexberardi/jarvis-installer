# jarvis-installer

The download page for Jarvis Automation, the server and desktop agent of
[Jarvis](https://github.com/alexberardi/jarvis-server), a private, self-hosted voice
assistant. GitHub Pages serves it at
[installer.jarvisautomation.io](https://installer.jarvisautomation.io).

It is one static page: per-OS download buttons for the Server and the Agent (macOS `.dmg`,
Windows `.exe`, Debian/Ubuntu `.deb` for amd64 and arm64), the terminal one-liners
(`install.sh`, `install.ps1`, `install-agent.sh`, `install-pi.sh`), the setup step
(`http://<host>:7710/setup`), and links to the docs at
[docs.jarvisautomation.dev](https://docs.jarvisautomation.dev/). The installers and everything
they install live in [jarvis-server](https://github.com/alexberardi/jarvis-server) and are
published as release assets there; this repository only links to them.

> Before jarvisd, this repository was a React wizard that generated Docker Compose bundles for the
> old multi-service stack. That install is retired for new users, so the wizard is gone; it is in
> the git history if you need it.

## Layout

| Path | What |
|---|---|
| `site/index.template.html` | The page, with `{{placeholders}}` for the release |
| `scripts/build-site.py` | Resolves the newest release and renders `_site/` (stdlib Python) |
| `scripts/check-site.py` | Checks the built HTML is well formed and local links resolve |
| `public/style.css`, `public/copy.js` | Styles and the copy buttons |
| `public/404.html` | Sends any other path (such as the old `/configurator`) to `/` |
| `public/CNAME` | The custom domain |
| `public/*.png` | Logo, favicon, Apple touch icon |
| `tests/` | `unittest` tests and the releases API fixture |

## How the release is resolved

At build time, `scripts/build-site.py` asks the GitHub API for
`repos/alexberardi/jarvis-server/releases?per_page=1` (the newest release by creation date,
prereleases included; drafts are skipped) and bakes its tag and assets' `browser_download_url`s
into the page. Every release so far is a prerelease, and GitHub's `releases/latest` skips those,
so the page links the resolved tag's own `releases/download/<tag>/…` URLs. Once a
non-prerelease exists, switch to `releases/latest` (see the TODO at `API_URL`). An asset the
release lacks gets no button; the Releases page link is always shown.

## Working on it

No dependencies. Test, build from the fixture, check, and preview:

```sh
python3 -m unittest discover tests
python3 scripts/build-site.py --fixture tests/fixtures/releases.json --out _site
python3 scripts/check-site.py _site
python3 -m http.server -d _site 8000
```

Without `--fixture` the build uses the live API (set `GITHUB_TOKEN` to avoid rate limits).
`npm test` and `npm run build` run the same scripts.

## Deploying

`.github/workflows/deploy.yml` runs on a push to `main`, on a `jarvisd-release`
repository_dispatch (sent by jarvis-server's release workflow), daily, and by hand. It runs the
tests, builds against the newest release, checks the result, injects the Cloudflare Web
Analytics beacon if the `VITE_CF_BEACON_TOKEN` repository variable is set (no token, no
beacon), and publishes `_site/` to GitHub Pages. Pull requests run the tests and a fixture
build (`check.yml`).

## License

AGPL-3.0 (see `LICENSE`).
