# jarvis-installer

A web-based installer/configurator for the [Jarvis](https://github.com/alexberardi) self-hosted voice assistant stack. It's a static React single-page app that walks you through picking which Jarvis services (modules) you want, configuring them, and then generates a ready-to-run Docker Compose deployment you can download and start.

It runs entirely in the browser — no backend — and is served from the `installer.jarvisautomation.io` domain.

## What it generates

Driven by `public/service-registry.json` (the source of truth for all Jarvis modules), the configurator produces:

- `docker-compose.yml` — the composed stack for your selected services
- `.env` — environment file with generated secrets and your chosen settings
- `init-db.sh` — database initialization script for the enabled services
- a downloadable `jarvis.zip` bundle containing all of the above (plus a generated README)

You can also copy/download just the `docker-compose.yml` directly from the output step.

## Tech stack

- React 19 + TypeScript
- Vite 6 (build/dev server)
- Tailwind CSS v4 (via `@tailwindcss/vite`, no config file)
- React Router 7 (landing page `/` + configurator `/configurator`)
- JSZip (client-side zip bundle generation)
- Vitest + React Testing Library + jsdom (tests)

Generator logic lives in `src/lib/` (`compose-generator`, `env-generator`, `init-db-generator`, `dependency-resolver`, `service-registry`, `zip-bundle`, etc.).

## Development

```bash
npm install
npm run dev        # start the Vite dev server
npm run build      # type-check (tsc -b) + production build
npm run preview    # preview the production build
```

## Testing

```bash
npm test            # run all tests once (vitest run)
npm run test:watch  # watch mode
npm run test:coverage
```

## License

AGPL-3.0 (see `LICENSE`).
