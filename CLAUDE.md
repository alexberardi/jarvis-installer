# jarvis-installer

A single static page (GitHub Pages, `installer.jarvisautomation.io`) that shows how to install
`jarvisd` from [jarvis-server](https://github.com/alexberardi/jarvis-server). See `README.md`
for the layout.

- **No build, no npm.** `public/` is published as-is. Keep it plain HTML/CSS plus the small
  `copy.js`; don't add a framework or bundler.
- **The installers are not here.** `install.sh` / `install.ps1` live in jarvis-server
  (`scripts/`) and ship as release assets. The commands on the page must match jarvis-server's
  README and `docs/install/00-installers.md` §4.1 (download-then-run for `install.sh`, never
  `curl | sh`).
- **Check before committing:** `python3 scripts/check-site.py` (well-formed HTML, local links,
  copy-button targets). It does not fetch external URLs on purpose.
- **Preview:** `python3 -m http.server -d public 8000`.
- **Public repo:** no real hostnames, IPs, emails or keys.
