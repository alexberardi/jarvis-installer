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
