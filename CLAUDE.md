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
- `install.sh` — Shell script executed by the generated curl command
