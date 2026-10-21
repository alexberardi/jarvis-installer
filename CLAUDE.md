# jarvis-installer

Static React SPA (GitHub Pages) that generates install configurations for the Jarvis voice assistant stack.

## Tech Stack

- React 19 + TypeScript, Vite, Vitest + React Testing Library + jsdom
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no config file)
- JSZip for client-side zip generation
- React Router for landing page / configurator routing

## Development

```bash
npm install
npm run dev       # Start dev server
npm test          # Run tests
npm run build     # Production build
```

## Testing

TDD is required: RED → GREEN → IMPROVE. Target 80%+ coverage.

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

## Project Structure

- `public/service-registry.json` — Source of truth for all Jarvis modules
- `src/types/` — TypeScript type definitions
- `src/data/` — Static data (GPU database, model recommendations)
- `src/lib/` — Pure logic (registry, detection, generators)
- `src/context/` — React context providers
- `src/components/` — UI components
- `tests/` — Test files mirroring src/ structure
- No `install.sh` lives here: the landing page's `curl -fsSL … | sh` line (`src/components/landing/LandingPage.tsx`) runs jarvis-admin's `install.sh` from `raw.githubusercontent.com/alexberardi/jarvis-admin/main/install.sh`

## Merging (agents)

**A merge to `main` deploys the live site.** `.github/workflows/deploy.yml` runs the tests and the build, boot-smokes the generated compose export against the umbrella repo's install-e2e harness, then publishes https://installer.jarvisautomation.io via GitHub Pages; `trigger-install-e2e.yml` also dispatches the umbrella repo's full install-e2e. What merges is what new users install.

**Verify** before opening a PR (what `.github/workflows/test.yml` runs on every PR, Node 24):

```bash
npm ci && npm test && npm run build
```

An agent may squash-merge **its own** PR into `main` once every CI check has passed, then check main's deploy run after the merge. **Hold for the user's review** instead, with a note saying why, when the PR:

- touches what generated installs contain or trust: `src/lib/secret-generator.ts`, `src/lib/*generator*.ts`, `src/data/image-digests.json`, `src/lib/image-digests.ts`, `public/service-registry.json`;
- touches `public/CNAME`, `scripts/**` or `.github/**`;
- changes the `curl … | sh` install line or any URL it points at;
- deletes, renames or weakens a test;
- is marked "needs review" by its author.

Never run a deploy or dispatch a workflow by hand, never merge someone else's PR, never force-push to `main`.

## UI work loads the design skills

Any change to how a page looks or behaves (layout, styling, copy, states, motion) loads the three skills in `.claude/skills/` before the first edit: **impeccable** (system rules, commands, the audit checklist), **emil-design-eng** (every motion decision) and **design-taste-frontend** (layout, type and spacing feel). Where they disagree, `.claude/skills/DESIGN-SKILLS.md` decides: accessibility and contrast first, then Impeccable's system rules, Emil for motion, Taste for layout feel.

They are copied unchanged from jarvis-server (`.claude/skills/`, at 1fd33737); change them there through DESIGN-SKILLS.md's process, then copy them here again. They were written for jarvis-server's `web/admin`, which has the same stack as this site (React 19, Vite, Tailwind 4, lucide-react). In this repo read them as:

- **Design system:** direction B ("Quiet Violet", chosen in jarvis-server #331; values in jarvis-server `docs/design/directions/tokens.py`, applied in jarvis-server `web/admin/src/index.css` and in jarvis-docs `docs/assets/stylesheets/theme.css`). This site still has the old dark-indigo variables in `src/index.css`; work that touches the look moves them to B's tokens, light and dark, so the installer, the docs and the admin look like one product. Where a skill says `web/admin/src/...`, read `src/`.
- **Mode:** the landing page is a download page: Persuade, held back (`impeccable/reference/mode-persuade.md`): one clear primary action per platform, plain copy, no hero effects.
- **Taste's dials here:** variance 4, motion 2, density 4.
- **No libraries:** use what `package.json` has (lucide-react for icons); add no icon, font, animation or component packages. System font stack; nothing fetched. `src/lib/analytics.ts` (the opt-in Cloudflare beacon) stays as it is; add no other tracking.
- **Rendered check:** there is no `scripts/screenshots` here. Run `npm run build` and look at the changed pages at phone (390 px), tablet and desktop widths in both themes with the headless browser the runner has; if none is available, say so and list the visual checks under "not verified".

Before a UI PR: run Impeccable's audit (`.claude/skills/impeccable/reference/audit.md`) over the changed pages and components, fix what it finds, and put its findings report (and the screenshots, if any) in the PR body.
