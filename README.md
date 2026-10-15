# jarvis-installer

The install page for [Jarvis](https://github.com/alexberardi/jarvis-server), a private,
self-hosted voice assistant, served by GitHub Pages at
[installer.jarvisautomation.io](https://installer.jarvisautomation.io).

It is one static page: the one-line install command for each OS, the supported platforms, what
to do after the installer finishes, and a pointer for people moving from the legacy Python
stack. The installers themselves (`install.sh`, `install.ps1`) and everything they install live
in [jarvis-server](https://github.com/alexberardi/jarvis-server) and are published as release
assets there; this repository only links to them.

> Before jarvisd, this repository was a React wizard that generated Docker Compose bundles for the
> legacy multi-service stack. That stack is replaced by the single `jarvisd` binary, so the
> wizard is gone; it is in the git history if you need it.

## Layout

| Path | What |
|---|---|
| `public/index.html` | The page |
| `public/style.css`, `public/copy.js` | Styles and the copy buttons |
| `public/404.html` | Sends any other path (such as the old `/configurator`) to `/` |
| `public/CNAME` | The custom domain |
| `public/*.png` | Logo, favicon, Apple touch icon |
| `scripts/check-site.py` | Checks the HTML is well formed and local links resolve (stdlib Python) |

## Working on it

No build and no dependencies. Serve `public/` and open it:

```sh
python3 -m http.server -d public 8000
python3 scripts/check-site.py
```

The install commands use `releases/latest/download/…`, which GitHub serves from the newest
non-prerelease. Keep them in step with jarvis-server's README and
`docs/install/00-installers.md` §4.1.

## Deploying

A push to `main` runs `.github/workflows/deploy.yml`: it runs the site check, injects the
Cloudflare Web Analytics beacon if the `VITE_CF_BEACON_TOKEN` repository variable is set (no
token, no beacon), and publishes `public/` to GitHub Pages. Pull requests run the site check
only (`check.yml`).

## License

AGPL-3.0 (see `LICENSE`).
