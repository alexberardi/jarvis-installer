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

## UI work loads the design skills

Any change to how a page looks or behaves (layout, styling, copy, states, motion) loads the three skills in `.claude/skills/` before the first edit: **impeccable** (system rules, commands, the audit checklist), **emil-design-eng** (every motion decision) and **design-taste-frontend** (layout, type and spacing feel). Where they disagree, `.claude/skills/DESIGN-SKILLS.md` decides: accessibility and contrast first, then Impeccable's system rules, Emil for motion, Taste for layout feel.

They are copied unchanged from jarvis-server (`.claude/skills/`, at 1fd33737); change them there through DESIGN-SKILLS.md's process, then copy them here again. They were written for jarvis-server's `web/admin` (React 19, Vite, Tailwind 4, lucide-react); this site is plain HTML/CSS (`site/index.template.html`, `public/style.css`, `public/copy.js`). In this repo read them as:

- **Design system:** direction B ("Quiet Violet", chosen in jarvis-server #331; values in jarvis-server `docs/design/directions/tokens.py`, applied in jarvis-server `web/admin/src/index.css` and in jarvis-docs `docs/assets/stylesheets/theme.css`). `public/style.css` carries B's tokens as CSS variables (`:root`, and the dark values under `prefers-color-scheme: dark`), so the installer, the docs and the admin look like one product: use those variables, and take any new value from B, light and dark. Where a skill says `web/admin/src/...`, read `site/` and `public/`; where it shows Tailwind classes or React components, apply the same rule in plain CSS and HTML.
- **Mode:** the landing page is a download page: Persuade, held back (`impeccable/reference/mode-persuade.md`): one clear primary action per platform, plain copy, no hero effects.
- **Taste's dials here:** variance 4, motion 2, density 4.
- **No libraries:** the site has no dependencies; add no icon, font, animation or component packages (inline SVG where an icon is needed). System font stack; nothing fetched. The opt-in Cloudflare beacon (injected at `<!-- cf-beacon -->` by `deploy.yml` only when a token is configured) stays as it is; add no other tracking.
- **Rendered check:** there is no `scripts/screenshots` here. Build the page (`python3 scripts/build-site.py --fixture tests/fixtures/releases.json --out _site`) and look at it at phone (390 px), tablet and desktop widths in both themes with the headless browser the runner has; if none is available, say so and list the visual checks under "not verified".

Before a UI PR: run Impeccable's audit (`.claude/skills/impeccable/reference/audit.md`) over the changed pages, fix what it finds, and put its findings report (and the screenshots, if any) in the PR body.
