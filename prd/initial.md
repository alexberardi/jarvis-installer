# Jarvis Admin — Product Requirements Document

**Status:** Greenfield
**Last Updated:** February 2026

---

## 1. Overview

Jarvis Admin is two things:

1. **A static cloud configurator** (hosted on GitHub Pages at `jarvis.dev` or similar) that serves as the front door to Jarvis. Users configure their setup in the browser, and it generates a ready-to-run install command or downloadable bundle.

2. **A local admin dashboard** (containerized, ships as part of the Jarvis Docker Compose stack) that serves as the ongoing control plane for managing services, config, modules, and updates after installation.

The cloud site solves the cold-start problem. The local admin handles everything after that. Once Jarvis is running, the user never needs the cloud site again.

---

## 2. Architecture Overview

```
                    INSTALL TIME                          RUNTIME
                    
┌──────────────────────────┐          ┌──────────────────────────────────┐
│    jarvis.dev            │          │    Local Network                 │
│    (GitHub Pages)        │          │                                  │
│                          │          │  ┌────────────────────────────┐  │
│  ┌────────────────────┐  │  generates  │  Docker Compose Stack      │  │
│  │ Cloud Configurator │──┼──────────▶  │                            │  │
│  │ (Static React SPA) │  │  install    │  ┌──────────────────────┐  │  │
│  └────────────────────┘  │  bundle     │  │ jarvis-admin         │  │  │
│                          │          │  │  ├─ React frontend      │  │  │
│  ┌────────────────────┐  │          │  │  ├─ Node API backend    │  │  │
│  │ Landing Page       │  │          │  │  └─ Docker socket mount │  │  │
│  │ Docs               │  │          │  ├──────────────────────┐  │  │
│  └────────────────────┘  │          │  │ llm-service          │  │  │
│                          │          │  │ command-router        │  │  │
└──────────────────────────┘          │  │ redis                 │  │  │
                                      │  │ ...core services      │  │  │
                                      │  ├──────────────────────┤  │  │
                                      │  │ ocr-service    (opt)  │  │  │
                                      │  │ recipes        (opt)  │  │  │
                                      │  │ ...optional modules   │  │  │
                                      │  └────────────────────────┘  │
                                      └──────────────────────────────────┘
```

### Repo Structure

| Repo | Purpose | Deploys to |
|------|---------|------------|
| `jarvis-admin` (this project) | Cloud configurator + local admin dashboard (monorepo) | GitHub Pages (configurator), GHCR Docker image (admin) |
| `jarvis` | Main compose stack, service registry, shared config, install script | GitHub releases (install script + compose files) |
| `jarvis-llm`, `jarvis-ocr`, etc. | Individual microservice repos | GHCR Docker images |

This PRD covers the `jarvis-admin` repo only.

---

## 3. Users & Context

**Primary user:** Someone who found Jarvis online and wants to run a local-first voice assistant. Technically comfortable enough to open a terminal and paste a command, but shouldn't need to understand Docker internals, YAML, or env file syntax.

**Environment:**
- Local network, single host (Linux or macOS with Docker Desktop)
- Consumer hardware: anything from a laptop to a dual-GPU workstation
- Optional: Home Assistant instance on the same network
- Optional: Pi Zero endpoints for room-by-room voice capture

---

## 4. Cloud Configurator

### 4.1 What It Is

A static React SPA hosted on GitHub Pages. No backend, no database, no accounts. It runs entirely in the browser and generates output that the user takes to their terminal.

### 4.2 Pages

**Landing page** — What Jarvis is, feature overview, hardware requirements, demo video embed, "Get Started" CTA.

**Configurator** (the core flow):

**Step 1: Hardware Profile**
- GPU or CPU-only? If GPU, which card? (Dropdown of common cards with VRAM, or manual VRAM entry)
- How much system RAM?
- Auto-recommends model size and quantization based on answers
- Shows estimated performance: "~2s response time" or "~5s response time"

**Step 2: Integrations**
- Home Assistant: yes/no. If yes, prompt for URL and long-lived access token (explain how to get one, with a link to HA docs). Note: this gets baked into the generated `.env`, not sent anywhere.
- Wake word engine preference (if applicable)

**Step 3: Modules**
- Checklist of optional modules with descriptions, screenshots, disk/RAM cost
- Dependency resolution shown inline ("Recipes requires OCR — it'll be enabled automatically")
- Core services shown as always-on, greyed out toggles

**Step 4: Output**
Two options presented:

*Option A — Install command:*
```bash
curl -fsSL https://raw.githubusercontent.com/alexberardi/jarvis/main/install.sh | bash -s -- \
  --profile gpu \
  --gpu-layers -1 \
  --model llama-3.1-8b \
  --quantization q4_k_m \
  --modules ocr,recipes \
  --ha-url http://192.168.1.50:8123 \
  --ha-token "eyJ..."
```

*Option B — Download bundle:*
A generated `.zip` containing:
```
jarvis/
├── docker-compose.yml     (with selected profiles uncommented)
├── .env                   (populated with user's choices)
├── install.sh             (convenience script to docker compose up)
└── README.md              (quick start instructions)
```

**Docs section** — Separate pages (can be Markdown rendered or a simple docs layout):
- Getting started guide
- Hardware recommendations
- Module descriptions
- Troubleshooting
- Contributing a module

### 4.3 Technical Details

- Pure static site — React SPA built with Vite, deployed to GitHub Pages
- No analytics, no tracking, no cookies (aligns with privacy-first brand)
- The configurator generates config client-side only. Nothing leaves the browser.
- The install command points to the `jarvis` repo's install script, not this repo
- The download bundle is assembled in-browser (use JSZip or similar)
- Mobile-friendly (people will discover this on their phone and install on their server later)

### 4.4 Install Script (lives in `jarvis` repo, but specced here for completeness)

The `install.sh` that the configurator references should:

1. Check prerequisites: Docker, Docker Compose v2, `nvidia-container-toolkit` (if GPU flag)
2. Create `~/jarvis/` directory
3. Download `docker-compose.yml` and `service-registry.json` from the `jarvis` repo
4. Write `.env` from the passed flags
5. Write `profiles.json` from `--modules` flag
6. Run `docker compose --profile <modules> up -d`
7. Print: "Jarvis is running. Open http://localhost:8080 to manage your setup."

---

## 5. Local Admin Dashboard

### 5.1 What It Is

A containerized web app (React frontend + Node.js backend) that runs as `jarvis-admin` inside the Docker Compose stack. It is the ongoing management interface for Jarvis after installation.

### 5.2 Container Design

```dockerfile
# Multi-stage build
FROM node:22-alpine AS build
# Build React frontend + backend

FROM node:22-alpine AS runtime
# Serve static frontend + run API server
# Single port (8080): API under /api, frontend serves everything else
```

**Mounts:**
| Mount | Path in container | Access | Purpose |
|-------|-------------------|--------|---------|
| Docker socket | `/var/run/docker.sock` | read/write | Container management |
| Config directory | `/config` | read/write | Env files, profiles, settings |
| Compose file | `/compose/docker-compose.yml` | read-only | Service definitions |
| Service registry | `/compose/service-registry.json` | read-only | Schema for config UI |

### 5.3 Service Registry

The service registry is the contract between the Compose stack and the admin UI. It lives in the `jarvis` repo alongside `docker-compose.yml` and is mounted read-only into the admin container.

```json
{
  "version": "1",
  "services": {
    "llm-service": {
      "displayName": "Language Model",
      "description": "Core LLM inference engine",
      "category": "core",
      "profile": null,
      "container_name": "jarvis-llm",
      "docs_url": "https://jarvis.dev/docs/llm",
      "config": {
        "MODEL_NAME": {
          "type": "select",
          "label": "Model",
          "options": [
            { "value": "llama-3.1-8b", "label": "Llama 3.1 8B", "vram": "6GB" },
            { "value": "llama-3.2-3b", "label": "Llama 3.2 3B", "vram": "3GB" }
          ],
          "default": "llama-3.1-8b",
          "description": "Which model to load for inference",
          "restart_required": true
        },
        "QUANTIZATION": {
          "type": "select",
          "label": "Quantization",
          "options": ["q4_k_m", "q5_k_m", "q8_0", "f16"],
          "default": "q4_k_m",
          "description": "Lower = less VRAM, slightly lower quality",
          "restart_required": true
        },
        "GPU_LAYERS": {
          "type": "number",
          "label": "GPU Layers",
          "min": 0,
          "max": 99,
          "default": -1,
          "description": "-1 for all layers on GPU",
          "restart_required": true
        },
        "LOG_LEVEL": {
          "type": "select",
          "label": "Log Level",
          "options": ["debug", "info", "warn", "error"],
          "default": "info",
          "restart_required": false
        }
      }
    },
    "ocr-service": {
      "displayName": "OCR / Document Scanning",
      "description": "Tiered OCR pipeline for recipe scanning and document processing",
      "category": "optional",
      "profile": "ocr",
      "container_name": "jarvis-ocr",
      "dependencies": [],
      "config": {
        "OCR_DEFAULT_TIER": {
          "type": "select",
          "label": "Default OCR Tier",
          "options": ["tesseract", "easyocr", "cloud-llm"],
          "default": "tesseract",
          "restart_required": true
        }
      }
    },
    "recipes": {
      "displayName": "Jarvis Recipes",
      "description": "Recipe management with OCR-powered import",
      "category": "optional",
      "profile": "recipes",
      "container_name": "jarvis-recipes",
      "dependencies": ["ocr-service"],
      "config": {}
    }
  },
  "categories": {
    "core": {
      "label": "Core Services",
      "description": "Always running — the foundation of Jarvis",
      "order": 0
    },
    "optional": {
      "label": "Optional Modules",
      "description": "Enable what you need, disable what you don't",
      "order": 1
    }
  }
}
```

Adding a new service to the admin UI = adding an entry here. No frontend code changes.

### 5.4 Features

#### Dashboard (P0)

The landing page after login. Grid of service cards showing:

- Service name and status (Running / Stopped / Error / Restarting)
- Uptime
- CPU % and memory usage (from Docker stats API)
- Quick actions: Restart, Logs, Configure

System-wide summary bar at the top:
- GPU utilization and VRAM (if applicable)
- Total stack memory usage
- Jarvis version
- Host info

#### Service Configuration (P0)

Settings page, services grouped by category. Each service expands to show config fields rendered dynamically from the service registry schema.

**Supported field types:**
- `text` — free text, optional regex validation
- `number` — numeric with min/max
- `select` — dropdown from predefined options
- `boolean` — toggle
- `secret` — masked input with reveal toggle
- `url` — URL input with optional connection test

**Behavior:**
- Shows current values read from the service's env file
- Dirty state indicated visually
- "Save & Restart" writes env and restarts the container (only shown if any changed field has `restart_required: true`)
- "Save" writes env without restart
- Client-side and server-side validation
- Collapsible "Raw ENV" view for power users

#### Module Management (P0)

Toggle cards for each optional service.

- Toggle ON: pull image (show progress), start via `docker compose --profile <x> up -d`
- Toggle OFF: stop container, optionally remove image
- Dependency enforcement: warn if disabling a dependency of an enabled module
- Show image size / disk usage per module

#### Log Viewer (P1)

Per-service log viewer.

- Tail last N lines with auto-scroll
- Real-time streaming via WebSocket (Docker log stream)
- Service selector to switch between services
- Text search/filter
- Severity highlighting
- Download as text

#### Updates (P2)

- Check registry for newer image digests
- Per-service or "Update All"
- Pull → recreate container (preserving config)
- Show release notes (fetched from GitHub releases)

#### Backup / Restore (P2)

- Export: download all env files + profiles.json + admin.json as a zip
- Import: upload zip, validate, overwrite config, restart affected services

### 5.5 API Design

All endpoints require auth except `/api/auth/login` and `/api/setup/status`.

```
# System
GET    /api/system/info                  # Hardware, GPU, RAM, disk
GET    /api/system/health                # Aggregate health

# Services
GET    /api/services                     # All services + status
GET    /api/services/:id                 # Single service detail
GET    /api/services/:id/config          # Current config values
PUT    /api/services/:id/config          # Write config
POST   /api/services/:id/restart         # Restart container
GET    /api/services/:id/logs?lines=100  # Fetch logs
WS     /api/services/:id/logs/stream     # Stream logs
GET    /api/services/:id/stats           # Live CPU/mem

# Modules
GET    /api/modules                      # All modules + enabled state
POST   /api/modules/:id/enable           # Pull + start
POST   /api/modules/:id/disable          # Stop + optionally remove

# Auth
POST   /api/auth/login                   # Returns JWT in httpOnly cookie
POST   /api/auth/change-password

# Setup
GET    /api/setup/status                 # Is setup complete?
POST   /api/setup/complete               # Mark setup done

# Updates
GET    /api/updates/check                # Check for newer images
POST   /api/updates/pull/:id             # Pull new image
POST   /api/updates/apply/:id            # Recreate with new image

# Config backup
GET    /api/config/export                # Download config zip
POST   /api/config/import                # Upload + apply config zip
```

### 5.6 Docker Integration

Use `dockerode` for all Docker operations.

**Container filtering:** Only manage containers labeled `com.jarvis.managed=true`. The compose file must apply this label to all Jarvis services.

**Profile management:** Shell out to `docker compose --profile <x> up -d` and `docker compose --profile <x> stop` since the Docker API doesn't understand Compose profiles natively. The `docker-compose.yml` is mounted for this purpose.

### 5.7 Auth

Single-user, local-network auth.

- Password set on first login (or inherited from install script flags)
- Stored as bcrypt hash in `admin.json`
- JWT in httpOnly cookie, 24-hour expiry
- Rate limiting: 5 login attempts per minute
- Optional: disable auth entirely for trusted networks (explicit opt-in)

---

## 6. Frontend Shared Details

Both the cloud configurator and local admin are React + TypeScript + Vite apps. They share a design system but are separate build targets.

### Monorepo structure

```
jarvis-admin/
├── packages/
│   ├── configurator/          # Cloud configurator SPA
│   │   ├── src/
│   │   ├── index.html
│   │   └── vite.config.ts
│   ├── dashboard/             # Local admin frontend
│   │   ├── src/
│   │   ├── index.html
│   │   └── vite.config.ts
│   ├── server/                # Local admin backend (Node.js)
│   │   ├── src/
│   │   ├── routes/
│   │   └── tsconfig.json
│   └── shared/                # Shared types, components, service registry parser
│       ├── types/
│       ├── components/
│       └── utils/
├── Dockerfile                 # Builds dashboard + server into admin image
├── package.json               # Workspace root
└── turbo.json (or nx.json)    # Monorepo orchestration
```

### Shared tech

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Lucide icons
- TanStack Query (dashboard only — configurator has no server state)

### Design principles

- Dark theme default (Jarvis aesthetic)
- No unnecessary animation — infrastructure UI, not consumer app
- Mobile-responsive (configurator especially — people will browse on their phone)
- Instant feedback: optimistic updates, loading skeletons, toast notifications
- Error states are first-class
- No telemetry, no tracking, no cookies on the configurator

---

## 7. Implementation Phases

### Phase 1: Core (target: April demo)

**Configurator:**
- [ ] Landing page with project overview and "Get Started" CTA
- [ ] Configurator flow: hardware → integrations → modules → output
- [ ] Generate install command with flags
- [ ] Generate downloadable zip bundle (JSZip)
- [ ] Deploy to GitHub Pages

**Dashboard:**
- [ ] Node.js backend with Docker socket integration via dockerode
- [ ] Service registry parser
- [ ] Config read/write (env files)
- [ ] API: service list, status, config CRUD, restart
- [ ] Frontend: dashboard with service health cards
- [ ] Frontend: schema-driven config editor
- [ ] Frontend: module enable/disable toggles
- [ ] Basic auth
- [ ] Dockerfile + integration into Jarvis compose stack

### Phase 2: Polish

**Configurator:**
- [ ] Hardware recommendation engine (input VRAM → suggest model + quantization)
- [ ] Animated/interactive module dependency visualization
- [ ] Documentation pages
- [ ] SEO and social meta tags

**Dashboard:**
- [ ] Log viewer with WebSocket streaming
- [ ] Resource monitoring (CPU/mem per service, GPU if present)
- [ ] Service restart with live status feedback
- [ ] Mobile-responsive layout
- [ ] Toast notification system

### Phase 3: Operations

**Dashboard:**
- [ ] Update checking + one-click updates
- [ ] Config backup/restore
- [ ] GPU monitoring panel
- [ ] Service crash notifications
- [ ] Changelog viewer (from GitHub releases)

### Phase 4: Ecosystem

- [ ] Portainer / CasaOS / Umbrel app template generation
- [ ] CLI wrapper (`jarvis up`, `jarvis status`) that shares config
- [ ] Community module browser (install third-party Jarvis commands)
- [ ] First-run setup wizard in the dashboard (for users who installed manually without the configurator)

---

## 8. Open Questions

1. **Monorepo tooling:** Turborepo vs Nx vs plain npm workspaces? Turborepo is lighter weight and sufficient for 4 packages. Recommendation: Turborepo.

2. **Backend framework:** Express vs Fastify vs Hono? Fastify has built-in schema validation which pairs well with the config schema approach. Recommendation: Fastify.

3. **Docker Compose in container:** The admin container needs the `docker compose` CLI binary for profile management. Options: install it in the image (adds ~50MB), or mount the host's binary. Recommendation: install in image for portability.

4. **Native macOS services:** Some Jarvis services run natively for macOS-specific features (Shortcuts, Apple Vision). The admin dashboard can show these as "unmanaged" status cards with a note, but can't control them. Defer deeper integration to Phase 4.

5. **Domain:** `jarvis.dev` is likely taken. Alternatives: `getjarvis.dev`, `jarvis-ai.dev`, `usejarvis.dev`. Or just use `alexberardi.github.io/jarvis` for now and worry about a domain later.

6. **Branding on the configurator:** The landing page is the first impression of the project. Worth investing in a logo and visual identity before the April demo, or ship minimal and iterate?

---

## 9. Success Criteria

- A non-technical-but-curious user can go from the landing page to a running Jarvis instance in under 10 minutes.
- The configurator works entirely client-side with zero backend infrastructure to maintain.
- A new Jarvis microservice can be added to the ecosystem by updating `service-registry.json` and `docker-compose.yml` — zero changes to the admin frontend or backend.
- The admin container adds < 100MB image size and < 50MB runtime memory to the stack.
- After initial install, all management happens locally — no cloud dependency.
