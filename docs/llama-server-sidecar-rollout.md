# Rollout: llama-server sidecar for the LLM proxy (Qwen3.5-9B)

**Status:** working on the dev GPU box (hand-configured, not in any committed repo). This doc is the spec to productionize it into fresh installs (jarvis-installer) **and** existing installs (jarvis-admin reconcile route), plus the CI harness (install-e2e).

**Owner context:** written 2026-08-04 after building + validating the sidecar live. See also `jarvis-llm-proxy-api` memory / the `project_qwen35_mtp_serving` note for the debug history.

**Revised 2026-08-04 after a code-level review** — claims re-verified against the actual repos. Added **§4d** (CC prompt-provider wiring, which the original plan omitted entirely), **§9** (rollout safety: failure posture, weights, rollback, ordering), and corrected: the §7 env-var mapping, the §4a `serve.sh`/`RUN_MODEL_SERVICE` mechanism, the §2.1 Mac-exclusion mechanism, the §4c preset type, and the §8 G5 registry count. Corrections are marked ⚠️ inline.

---

## 0. What this is / why

The Qwen3.5-9B is a hybrid SSM+attention model. Served **in-process** (llama-cpp-python) it can't prefix-cache its recurrent state, so every voice turn re-prefills ~8k tokens (~2.2s) — too slow. Served via a **llama.cpp `llama-server` sidecar** it caches the recurrent state (context checkpoints + longest-common-prefix slot matching), so voice turns drop to **~0.3s cached / ~1.2–2.9s cold**. The existing proxy "model service" already supports a `REST` backend, so the sidecar is just a container the REST backend points at.

**Measured on dev (validated):** cold 10.8k-token prompt 2.86s, cached 0.27s, simple authed call through 7704 = 0.58s, correct native tool calls, no thinking.

### What already works on the dev box (do NOT redo — this is the reference)
- Sidecar `llama-server-9b` running on `alex@10.0.0.122` (see §3 for the exact block).
- Proxy DB settings set: `model.{live,background}.backend=REST`, `model.{live,background}.rest_url=http://host.docker.internal:7799`, `model.live.reasoning_budget=0`, `rest.provider=openai`.
- CC `jarvis_command_center.settings`: `llm.interface=Qwen3_5_9B_Compressed`.

### Uncommitted enabling code (on the laptop `jarvis-llm-proxy-api` checkout, NOT committed)
These are prerequisites — they make the REST backend honor thinking-suppression + `max_tokens`. **Commit these first** (see §1):
- `backends/rest_backend.py` — new `_apply_reasoning()` helper; `chat_with_temperature` now takes `max_tokens`+`reasoning_budget`; tool path uses the helper.
- `managers/chat_types.py`, `models/api_models.py`, `services/model_service.py`, `services/chat_runner.py` — `reasoning_budget` plumbing.
- `services/settings_service.py` — `model.live.reasoning_budget` SettingDefinition.
- `tests/test_rest_backend.py` — fake-chat signature updated. (⚠️ 7 REST tests in this file, all green — the earlier "12" was wrong.)

---

## 1. Prerequisite proxy fix (small, do first) — `jarvis-llm-proxy-api`

**`rest.provider` defaults to `"generic"`, which is broken.** With `provider=generic`, `_parse_response_for_provider` falls through to `return str(response_data)` — it dumps the whole OpenAI response dict as the message content. Any OpenAI/llama-server/vLLM/LM-Studio server needs `"openai"`.

Change the default in **both** places:
- `services/settings_service.py:810` — `default="generic"` → `default="openai"`.
- `backends/rest_backend.py:66` — `get_setting("rest.provider", "JARVIS_REST_PROVIDER", "generic")` → `"openai"`.

(Also commit the enabling code listed in §0.)

Optional: declare `model.background.reasoning_budget` / `model.main.reasoning_budget` SettingDefinitions so they show in jarvis-admin (the live one is already declared).

---

## 2. Design decisions (read before touching generators)

1. **GPU-lane only; keep in-process GGUF as the non-GPU fallback.** The image is CUDA-only. This is "add a GPU serving *variant*", not "replace in-process everywhere." ⚠️ **Correction:** the admin darwin filter (`compose-generator.ts:97`, `gpu && !cpuFallback`) only runs over **registry rows** returned by `getAllEnabledServices`. Per decision 3 the sidecar is a hand-emitted **special-cased block**, so it is *not* passed through that filter — the filter gives it **zero** exclusion. What actually keeps the sidecar off a Mac is a **hand-written `state.gpuType==='nvidia'` guard on the block itself** (Macs detect as `apple`). Write that guard on every emitter (export, installer, admin); do not rely on the darwin filter.
2. **Config via ENV VARS, not DB seeds.** The installers configure the proxy backend through env (`compose-export-generator.ts:605` bakes `JARVIS_MODEL_BACKEND: "GGUF"`). All the new settings have `env_fallback`s, so reproduce the dev DB settings as env on the proxy container. `install-e2e/docker-compose.ci-override.yaml:17-31` already proves the REST env path (`JARVIS_MODEL_BACKEND=REST`, `JARVIS_REST_PROVIDER=openai`, `JARVIS_REST_MODEL_URL=…`) — just pointed at cloud OpenAI instead of a local sidecar.
3. **A sidecar can't be a registry row.** `ServiceDefinition` has no raw `command`/args field (only `workers[]` do). A registry service unconditionally gets an app-key seed (`compose-export-generator.ts:68-71`, all-but-admin) and a python-urllib healthcheck (`:745-755`) — both invalid for a python-less third-party image — and *conditionally* gets DB env (`if service.database`, `:525`) and a migrate entrypoint (`if service.migrate`, `:640`). None of this fits the llama.cpp image, so the sidecar is a **special-cased block** in each generator, like `mosquitto`/`postgres`.
4. **Networking:** on the dev box the sidecar has no shared network with the proxy, so `rest_url` uses the host-published port `http://host.docker.internal:7799`. **In the installers, put the sidecar on the shared `jarvis-net` and use `http://llama-server-9b:8080` directly** (no host round-trip, no `7799` publish needed except for debugging).
5. **Enablement must be an explicit, env-persisted per-install signal — never `gpuType` alone.** Reconcile re-detects the GPU live (`jarvis-admin/server/.../upgrade/state-reconstructor.ts:95` → `hardware-detect.ts`), returning `nvidia` whenever `nvidia-smi` or an nvidia docker runtime is present. If the sidecar + REST override are gated on `gpuType==='nvidia'` alone, **every** existing NVIDIA install auto-flips to REST + a Qwen3.5-9B sidecar on the next routine image-update reconcile — including boxes running some other model (→ missing-weights crash-loop, §9b). Define a dedicated key (e.g. `JARVIS_LLM_SERVING=llama-server-sidecar`) that round-trips through `generateEnv` → `reconstructWizardState`, and gate **both** the sidecar block and the REST backend override on it. Conversely, if the backend switch is *not* an override, `mergeEnv` keeps `JARVIS_MODEL_BACKEND=GGUF` while the sidecar still emits → split-brain (proxy in-process GGUF + idle sidecar both on the GPU).
6. **Exactly one of {proxy, sidecar} may hold the GPU reservation + `.models` mount.** The proxy is `gpu:true`+`modelVolume:true` today (`public/service-registry.json:153-154`) and gets the nvidia reservation via `pushExportGpuConfig`. When the sidecar is active, move the reservation **and** the `.models` bind onto the sidecar and drop them from the proxy (and worker) — otherwise both load a model on the same card (~2× VRAM + contention; a 24GB card with whisper-cuda co-resident can OOM). §4a states this for the export generator; **repeat it in §4b and §5.1** — it's easy to drop in 2 of the 3 generators.

---

## 3. The sidecar service spec (verified working block)

From the dev box compose (this exact block serves the model today):

```yaml
  llama-server-9b:
    image: ghcr.io/ggml-org/llama.cpp:server-cuda
    container_name: llama-server-9b
    # ports: only needed for host debugging; on a shared network the proxy uses
    #        http://llama-server-9b:8080 directly.
    volumes:
      - ${STORAGE}/models:/models:ro          # NOTE: /models, NOT /app/.models
    command: >
      -m /models/Qwen3.5-9B-Q4_K_M.gguf
      -ngl 99
      -c 16384                                 # see gotcha G3 — 8192 overflows real voice prompts
      --reasoning-budget 0                     # harmless; does NOT actually suppress thinking (G2)
      -ctxcp 32                                # context checkpoints (prefix cache)
      -cms 256                                 # checkpoint min spacing
      --host 0.0.0.0
      --port 8080
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    # Healthcheck: pin the image + add an EXPLICIT healthcheck (see note below); do NOT rely on the image's built-in one.
```

- **Mount mismatch:** the registry's `modelVolume` mounts to `/app/.models`; the sidecar command uses `-m /models/…`. Either mount to `/models` for the sidecar or change the `-m` path. Weights (`Qwen3.5-9B-Q4_K_M.gguf`) must already exist — **there is no model-download automation in the installer** (`modelPresets` are metadata only). ⚠️ A fresh/reconciled GPU install with the sidecar enabled but no weights present is **not** a soft failure here — see §9b (llama-server crash-loops).
- **⚠️ Pin the image + own the healthcheck.** `:server-cuda` is a floating tag; the "built-in HEALTHCHECK on /health" can't be verified from this repo and could vanish on a rebuild (same failure shape as the whisper.cpp unpinned-build CI incident). **Pin to a digest** (`llama.cpp@sha256:…`) or a dated tag, and add an **explicit** `healthcheck:` block so the contract is owned here — required if anything uses `depends_on: {condition: service_healthy}` (§9a).
- **VRAM:** ~5.75GB weights + KV. `-c 16384` only adds ~0.24GB over 8192 (hybrid SSM → KV on ~1/4 layers). Go 20480/24576 if long sessions overflow. See decision 6 — don't let the proxy *also* reserve the GPU.

---

## 4. jarvis-installer changes (fresh installs)

Two generators (both must emit the sidecar when GPU + REST is selected), plus the registry.

### 4a. `src/lib/compose-export-generator.ts` (self-contained inline compose — what install-e2e stands up)
- **Add a special-cased `llama-server` block** next to the mosquitto/postgres special cases (`~132-280`), gated on `state.gpuEnabled && gpuType==='nvidia'` and the "use the 9B sidecar" flag (see 4c). Reuse the GPU device pattern from `pushGpuDevices` (`:410-431`) / `pushExportGpuConfig` (`:433`). Third-party images pass through `getExportImage` untouched (`:385`).
- **Flip the proxy off in-process serving** when the sidecar is active:
  - `:605` `JARVIS_MODEL_BACKEND: "GGUF"` → `"REST"`; add `JARVIS_REST_PROVIDER: "openai"`, `JARVIS_REST_MODEL_URL: "http://llama-server-9b:8080/v1/chat/completions"` (or set `model.live.rest_url` via env), `JARVIS_LIVE_REASONING_BUDGET: "0"`.
  - `:668-676` `command: ["bash","scripts/serve.sh"]` co-locates the model service in the proxy container. ⚠️ **Corrected mechanism:** `serve.sh` gates the in-container model service on **`RUN_MODEL_SERVICE`** (default `true`) and **never reads `JARVIS_MODEL_BACKEND`** — flipping the backend alone leaves it running. And with `backend=REST` the model service instantiates `RestClient`, **not** a GGUF loader (`model_manager.py:241`), so it does **not** load a GGUF on the GPU — it's just a redundant proxy→`localhost:7705`→sidecar hop. To actually drop it, **set `RUN_MODEL_SERVICE=false`** on the proxy (and the worker) when the sidecar is active. No generator sets this today.
  - `:602` `MODEL_SERVICE_URL: http://localhost:7705` — fine to keep (the proxy still talks to its own model-service process, which is now a REST client), but move the GPU reservation + `.models` mount **off the proxy** (`pushExportGpuConfig` currently attaches nvidia to the proxy because it's `gpu:true`; `modelVolume` bind `:715-719`) and **onto the sidecar**.
  - `:759-760` healthcheck `start_period: 120s` can shrink (no in-container model load).
  - **Worker mirror** (`:925-939`) duplicates the same env/command block — update it too (or confirm the worker doesn't need a model service when backend=REST).

### 4b. `src/lib/compose-generator.ts` (thin `.env`-templated bundle)
- Same special-cased sidecar block; GPU via `pushGpuDevices` (`:98-119`) / `pushGpuConfig` (`:121-150`), gated by `shouldUseGpuVariant` + `state.gpuEnabled`. This generator currently mounts nothing for the proxy — add the `.models` bind to the **sidecar**.

### 4c. `public/service-registry.json`
- Add a `Qwen3.5-9B` **modelPreset** (`~83-92`) with `hfRepo`/`hfFilename` for the GGUF, `contextWindow: 16384`, `interface: "Qwen3_5_9B_Compressed"`. ⚠️ **`backend: "REST"` does not fit the current type** — `ModelPreset.backend` is `"GGUF" | "VLLM"` (`src/types/service-registry.ts:42`); a raw `REST` value is a TS error. Either **extend the union** or (preferred) express serving via a **separate marker field** (`serving: "llama-server-sidecar"`) and leave `backend` for the in-process story.
- ⚠️ **This preset is NOT how CC gets its prompt provider.** The `interface` on a `modelPreset` configures the *proxy*; the *command-center* `llm.interface` is a **separate** thing wired via `llmInterfaceOptions` + `LLM_INTERFACE_SEED` — see **§4d**, which the original plan omitted entirely.
- Decide the enablement signal per **decision 5** (an env-persisted `JARVIS_LLM_SERVING`-style key). Keep the in-process GGUF path as the default so non-GPU installs are unaffected.

### 4d. Command-center prompt provider (`llm.interface`) — REQUIRED, omitted by the original plan
Serving Qwen3.5-9B on the proxy does **nothing** for how CC *prompts* it. §0/§7 list CC `llm.interface=Qwen3_5_9B_Compressed` as required, but §4a-c only touch compose/proxy/preset. The fresh-install path:
- The wizard's selectable interfaces come from the **command-center `llmInterfaceOptions`** array in the registry. **Neither registry lists any Qwen3.5 entry** (installer `public` = 8 options; admin `server/src/data` = 3 — already drifted, see G5). **Add `Qwen3_5_9B_Compressed` to `llmInterfaceOptions` in all registry copies.**
- The wizard writes `state.llmInterface` as env **`LLM_INTERFACE_SEED`** on the CC container (`compose-export-generator.ts:578`, `compose-generator.ts:381`), consumed **once** by alembic migration `jarvis-command-center/alembic/versions/f6a7b8c9d0e1_seed_settings.py:24` (`os.getenv('LLM_INTERFACE_SEED','JarvisAdapterModel')`). Wire the 9B-preset selection so it sets this seed.
- The provider class exists and auto-discovers (`jarvis-command-center/app/core/prompt_providers/medium/untrained/qwen3_5_9b_compressed.py`, `name='Qwen3_5_9B_Compressed'`), so it works at runtime once selected. **Verify** `model_factory.py:106` (which *also* reads `llm.interface` to resolve a MODEL class) tolerates it — there is no model class of that name, so it must fall back gracefully (likely `JarvisToolModel`).
- Without this, a fresh GPU install brings up sidecar+REST but CC keeps driving Qwen3.5 with the **default** prompt provider.
- **Existing installs are harder** — the seed is one-time; see §5 item 5.

---

## 5. jarvis-admin changes — the reconcile route (**how existing installs get the sidecar**)

This is the path you flagged. Existing installs don't re-run the wizard; they hit the **reconcile/regenerate** route, which re-derives compose from the registry via a *third, parallel* generator.

### The route (`server/src/routes/install.ts`)
- `GET /reconcile/options` (`:861`) — pre-populates from the existing `.env`.
- `POST /regenerate-download` (`:899`) and the `/reconcile` SSE (**`POST /reconcile` at `:933`**, streaming from the `text/event-stream` write at `:942` — the doc's earlier `:856` is just the comment above `/reconcile/options`) — build upgraded compose and run `docker compose up -d`.
- Engine: `server/src/services/upgrade/compose-upgrader.ts` — `regenerateComposeFilesLatest()` (`:170`) / `regenerateComposeFiles()` (`:151`) → `buildUpgradedComposeFiles()` (`:69`): reconstructs wizard state from existing env, calls `generateCompose(state, registry, digests)` (`:103`), merges env (existing values win unless overridden).

**Implication:** a new service added to the admin generator + registry **automatically flows to existing installs** on the next reconcile — as long as it becomes an enabled service for that state. `getAllEnabledServices` (`compose-generator.ts`) + the darwin/GPU filter decide inclusion.

### What to change
1. **`server/src/services/generators/compose-generator.ts`** — add the same special-cased `llama-server` sidecar block (mirror the installer; this file has its own mosquitto `:275/307` and postgres `:333` special cases and its own `pushGpuDevices` `:388` / `shouldUseGpuVariant` `:147`). Emit it only when `state.hardware.gpuType==='nvidia'` **and** the decision-5 enablement key is set. ⚠️ Because the sidecar is a *special-cased block*, the darwin filter (`:97`) does **not** apply to it (per decision 1) — the `gpuType==='nvidia'` guard is what keeps it off Mac, not the filter. Flip the proxy env to REST here too (as a decision-5-gated override), and move the GPU reservation + `.models` mount onto the sidecar (decision 6).
2. **`server/src/data/service-registry.json`** — a **separate copy** from the installer's `public/service-registry.json` (already drifted; see G5 — 4 tracked copies total). Add the same modelPreset + enablement marker **and** the `Qwen3_5_9B_Compressed` `llmInterfaceOption` on the command-center service (§4d) here.
3. **env merge:** `regenerateComposeFilesLatest` preserves existing `.env` values (`env-merger.ts:39-41`, "existing value wins"; the generator defaults `JARVIS_MODEL_BACKEND` to `GGUF`), so a stack previously on GGUF won't auto-switch to REST unless the reconcile overrides it. Express the backend switch as an **override** — the helper is **`upsertEnvVar`** (`compose-upgrader.ts:24`, ⚠️ *not* `setEnvVar`), used today for `MQTT_ALLOW_ANON` (`:118`) / `JARVIS_IMAGE_TAG` (`:129`); add an `UpgradeOverrides` field (there is none for backend/rest today, `:193`). **Gate this override on the decision-5 enablement key**, not on `gpuType` — otherwise every nvidia box flips.
4. **Optional — setup wizard (fresh installs via admin UI):** `jarvis-admin`'s React wizard (`src/components/wizard/LlmStep.tsx`) offers only `GGUF|VLLM`, single `live` slot, no `rest_url`. Add a REST/9B option + `rest_url` if you want first-run to offer it. `HardwareStep.tsx` hardcodes backend sets `['gguf']` / `['gguf','vllm']` / `['gguf','mlx']` (⚠️ it's `vllm`, not `vlm`); `src/data/models.ts` has **no** backend enum (only `hfRepoVllm`/`hfRepoGguf` repo fields, no `mlx`). Neither offers a REST path. (Not required to make the settings configurable — the generic Settings page already edits all the keys.)
5. **CC `llm.interface` on existing installs (the harder half of §4d).** `LLM_INTERFACE_SEED` is honored **once**, by migration `f6a7b8c9d0e1`; on an already-migrated stack re-emitting the env does nothing, and the setting has **no `env_fallback`** (`jarvis-command-center/app/services/settings_definitions.py`). So reconcile cannot flip the prompt provider via env. Flip it with an explicit **config-service settings write** during the reconcile flow — the admin server already does exactly this PUT elsewhere (`routes/llm-setup.ts:113`, `routes/quick-sets.ts:221` → `/v1/settings/jarvis-command-center/llm.interface`). Without this, an existing install gets sidecar+REST but a **stale** prompt provider, fixable only by a manual Settings edit (which the note below quietly assumes but never states).

> **jarvis-admin Settings page needs NO change** — it's a generic pass-through of config-service's aggregated settings. All keys (`model.*.backend` with a REST dropdown, `.rest_url`, `.reasoning_budget`, `rest.provider`) are already declared in the proxy's `settings_definitions`, so they're editable in the UI today.

---

## 6. Tests & CI (unit suites + install-e2e)

### 6.0 CI topology — know this first (it constrains everything below)
- **`install-e2e` is not a standalone repo** — it's the `install-e2e/` dir of the umbrella `alexberardi/jarvis` monorepo. Its only workflow is **`.github/workflows/install-e2e.yml`** at the umbrella root. `jarvis-installer` and `jarvis-admin` each have a `trigger-install-e2e.yml` that fires on push-to-main and does `repository_dispatch(event_type=service-commit)` into the umbrella (gated on `INSTALL_E2E_DISPATCH_TOKEN`).
- **PR-gating unit tests** (these run the generated-compose suites): installer `test.yml` (`npm test` = vitest over `tests/lib/*` **+ `tsc` build**), admin `test.yml` (`tsc --noEmit` + lint + `vitest` server tests).
- **CPU workflow — `install-e2e.yml` `e2e` + `sync-live` jobs** (and a second copy in installer `deploy.yml`'s `boot-smoke`, gating the Pages deploy) run on `ubuntu-latest` with **`--gpu none`**, faking REST via **cloud OpenAI** (`docker-compose.ci-override.yaml`). GHA hosted runners have no GPU.
- ✅ **There IS a GPU CI lane — `.github/workflows/install-e2e-gpu.yml`** (landed via jarvis#5/#14/#16/#19; not in a stale checkout). Nightly (`cron 23 7`) + `workflow_dispatch` + PR (spike-only unless a `gpu-live` label opts a PR into a live run). Per lane it **rents a Vast.ai KVM VM** (`provision_vast.py`), bootstraps it (`bootstrap_remote.sh` — GPU-visibility gate, docker, downloads a small test GGUF), points `DOCKER_HOST=ssh://` at the VM, **generates the installer export compose AND the admin SYNC compose with `--gpu`**, brings each up remotely, and runs `test_deployment` + `test_migrations` + **Phase G (`gpu/test_gpu_inference.py`)** — real chat completion + tts→whisper + **ggml offload markers** proving the GPU did the work (catches silent CPU fallback). Lanes are defined in **`gpu/lanes.py`** (`cuda`/`vulkan`/`rocm`; only `cuda` has Vast inventory today). Fully cost-gated on `VAST_API_KEY` (no key → no-op green), with a janitor + clean-gate so a green run means a clean account. *(The launchd nightly `benchmark_models.py` on the laptop is a separate model-accuracy **benchmark**, not this e2e.)*

> **Load-bearing implication:** the CPU workflow asserts the generators **emit** the sidecar correctly (static, `docker compose config`). The GPU workflow **actually runs the CUDA sidecar** on a rented Vast VM — so the sidecar gets real end-to-end coverage. **The task the user asked for is: add the sidecar to this existing `install-e2e-gpu.yml` harness — see §6.4.**

### 6.1 No snapshots — additive block is safe
All three layers (installer vitest, admin vitest, install-e2e Python) use **explicit string assertions** — no `.snap`/`toMatchSnapshot` anywhere. Adding a `llama-server-9b` block cannot churn a golden file. The friction is specific assertions, below.

### 6.2 Unit-test churn (installer + admin, PR-gating) — these WILL need edits
- **`tsc` build fails on `backend:"REST"`** — `ModelPreset.backend` is `"GGUF" | "VLLM"` (`src/types/service-registry.ts:42`). Use the `serving` marker (§4c) or widen the union, or the installer/admin `test.yml` build step goes red.
- **Existing "proxy keeps `.models` + nvidia reservation under nvidia" assertions must STAY GREEN** — installer `compose-export-generator.test.ts:145`, `compose-generator.test.ts:372`; admin `compose-generator.test.ts:146-167`. They run at plain `gpuType:nvidia` with **no** enablement key, so they now *double as the decision-5 guard* (nvidia alone must not flip). Add **new sidecar-ON cases** (enablement key set): assert the `llama-server-9b` block appears, the `.models` mount + nvidia reservation **move onto it**, the proxy env flips REST, and `RUN_MODEL_SERVICE=false` on proxy+worker.
- **Add non-emission guards** (net-new): darwin (`gpuType:apple`) never emits the block; nvidia-without-key never emits it.
- **`compose-env-contract.test.ts` (both repos)** polices that every bare `${VAR}` in the compose is defined non-empty in the generated `.env`. ⚠️ If the sidecar `.models` bind is written as a new bare `${STORAGE}/models`/`${MODELS_DIR}` (env-generator defines neither), this test **fails** — emit a defined var or a literal/relative path. Also add the enablement key to the maximal state, or the contract never exercises the sidecar path (false green).
- **Registry content tests** — the installer registry has **no** content test (`parseRegistry` is an unchecked `json as ServiceRegistry` cast), so add explicit assertions that the Qwen3.5-9B preset + `Qwen3_5_9B_Compressed` `llmInterfaceOption` exist. Land the data in installer `public/` + admin `server/src/data/` only (fixture is inert — G5). Keep admin registry `version:"3.0.0"` or `service-registry.test.ts:25` breaks.
- **Reusable analog for the reconcile override:** `compose-upgrader.test.ts` already proves an `UpgradeOverride` flips an env var via `upsertEnvVar`, **wins over an existing value**, and that a no-override regen **preserves** the existing value (the opt-out invariant). Copy the `mqttAllowAnon`/`whisperBackend` tests for the backend/serving flip. *(Note: `remote-llm.test.ts` is NOT a useful analog — it's a topology axis, CC pointing at a remote proxy, not the proxy's own REST backend.)*

### 6.3 install-e2e CPU lane — what to add (static, GPU-free)
- **`gen-sync-compose.mts:104,106`** hardcodes a CPU/no-GPU state (`hardware:null`, `llmInterface:"JarvisToolModel"`), so it can *never* emit the sidecar. Add `--gpu nvidia` / `--serving` flags that set `hardware.gpuType='nvidia'` + the enablement key, and emit a second (opt-in) and a third (nvidia-no-key opt-out) sync compose.
- **`test_sync_compose.py`** (today only asserts alembic migrate entrypoints): assert the nvidia+opt-in sync compose contains `llama-server-9b` (pinned image, nvidia reservation, `.models` mount) and that the sidecar is **excluded from `MIGRATE_SET`** (python-less, no alembic). ⚠️ **Caveat:** this test calls `generateCompose` **directly**, not the `upsertEnvVar` upgrader path, so an env-override REST flip is **invisible** here — "proxy is REST" is only statically assertable if the generator **bakes REST into the sidecar-active proxy block**. The **opt-out case is cleanly assertable** (no block + `${JARVIS_MODEL_BACKEND:-GGUF}` default preserved).
- **Opt-out safety** (checklist): nvidia **without** the key → no `llama-server-9b`, proxy stays GGUF. This is the guard against every NVIDIA box auto-flipping on reconcile (decision 5 / §9b).
- **`validate_matrix.py`** (Phase 0, pure `docker compose config`, CPU-safe — the best home for cheap sidecar checks): add a serving dimension; assert the block is present for nvidia+opt-in and absent otherwise. ⚠️ Its `check_images` will `docker manifest inspect` the `llama.cpp` image — **pin a digest/dated tag** (§3) or this lane goes red on upstream churn (the whisper.cpp failure shape).
- **`conftest.py` / `test_deployment.py`** — do **NOT** add `llama-server-9b` to the CPU service inventory (`ALL_CONTAINERS`): `test_no_crash_loop`/`healthy` would fail with no GPU + no weights. Gate any live sidecar inclusion behind a GPU-lane env flag; always keep it out of `MIGRATE_SET`.
- **`seed.py:98`** hardcodes CC `llm.interface='ChatGPTOpenAI'` → make it `SEED_LLM_INTERFACE` env (CPU keeps `ChatGPTOpenAI`; GPU sets `Qwen3_5_9B_Compressed`).
- **`ci-override.yaml`** stays cloud-REST — **no change**; never repoint it at a local sidecar (§6.0).

### 6.4 GPU e2e (`install-e2e-gpu.yml`) — add the sidecar to the real Vast harness ⬅ the user's ask
> ⚠️ **`install-e2e` lives in the umbrella `alexberardi/jarvis` monorepo** and this harness landed on `origin/main` after common local checkouts — do this work against **current `origin/main`**, not a stale tree.

How Phase G proves GPU use today: the export/SYNC compose comes up in **in-process GGUF** mode (`gpu/docker-compose.gpu-ci-override.yaml` points `JARVIS_MODEL_NAME` at the small `Qwen2.5-0.5B` GGUF `bootstrap_remote.sh` staged, sets `JARVIS_VERBOSE=true`), and `test_gpu_inference.py` greps **`docker logs jarvis-llm-proxy-api`** for `lanes.py`'s `device_markers` + `OFFLOAD_PATTERN` ("offloaded N/M layers to GPU", N>0). The sidecar changes *where the markers live*: in REST mode the proxy loads **no** GGUF, so the ggml offload lines appear only in the **`llama-server-9b`** container (llama.cpp → same ggml markers). Concrete additions:

1. **`gpu/lanes.py`** — add a `serving` + **`marker_container`** field to `Lane` (default `"jarvis-llm-proxy-api"`), and a **`cuda-sidecar`** lane (`gpu_type=nvidia`, `whisper_backend=cuda`, `serving="llama-server-sidecar"`, `marker_container="llama-server-9b"`, reuse `device_markers`/`OFFLOAD_PATTERN`). CUDA-only — no vulkan/rocm sidecar lane.
2. **`gpu/test_gpu_inference.py`** — read markers from `LANE.marker_container` instead of the hardcoded `"jarvis-llm-proxy-api"` (the one load-bearing change; otherwise Phase G falsely fails in REST mode). The chat-completion test (`model:"live"` → proxy REST → sidecar) works unchanged. Optionally assert the proxy env is REST and, if the 9B is used, no-thinking per G2.
3. **Generate WITH the sidecar** — pass the decision-5 enablement flag (`--serving llama-server-sidecar`, §4c) to `gen-export-compose.mts` **and** `gen-sync-compose.mts` so `docker-compose.gen.yaml`/`.sync.yaml` contain `llama-server-9b` + a REST proxy. This exercises the **real generated artifact** (the harness's whole philosophy) — both generators, as today.
4. **Model staging** — reuse the 0.5B (llama-server serves any GGUF; the e2e proves plumbing + GPU offload, not the hybrid-cache perf). ⚠️ **Requires the generator to template the sidecar's `-m` filename** (from the preset's `hfFilename` or an env var) so a `gpu-sidecar` override can point it at the staged 0.5B — otherwise the emitted `-m /models/Qwen3.5-9B…` isn't on disk. (Alternatively download the real 9B, ~5.7GB, fits the 100GB disk / 24GB card — more faithful, slower/pricier.)
5. **A `gpu/docker-compose.gpu-sidecar-override.yaml`** (or make the existing override serving-aware) — unlike the CPU override it does **not** flip REST (the generator already did); it just points the sidecar at the staged model + ensures offload logging. The sidecar needs the **explicit healthcheck** (§3/§9a) or `test_deployment`'s `wait_for_container_health` times out.
6. **`conftest.py`** — add `llama-server-9b` to the GPU-lane container inventory (there's precedent: `_container_exists` + `OPTIONAL_HTTP_SERVICES` conditionally append). Keep it out of `MIGRATE_SET` (no alembic) and out of the CPU inventory. `test_no_crash_loop` then catches the §9b missing-weights case for free.
7. **`install-e2e-gpu.yml`** — add `cuda-sidecar` to the matrix (or a `serving` dimension on `cuda`), pass `--serving` to both generators, select the sidecar override. Cost: one extra up/down cycle (~+10–15 min, ~+$0.15/night) within the 120-min timeout and the `VAST_API_KEY` gate; consider alternating nights. `provision_vast.py`'s cuda offer filter (RTX 4090/3090, ≤$0.60/hr) already fits a 9B.
8. **Pin the sidecar image** — the workflow's `compose pull` + the CPU `validate_matrix` image-existence check both hit `ghcr.io/ggml-org/llama.cpp`; pin a digest/dated tag (§3) or it goes red on upstream churn.

---

## 7. Config reference (setting ↔ env ↔ value)

| Setting key | Env fallback | Sidecar value | Notes |
|---|---|---|---|
| `model.live.backend` | `JARVIS_LIVE_MODEL_BACKEND` | `REST` | ⚠️ direct live var. `JARVIS_MODEL_BACKEND` sets `model.main.backend`, reaching live only via the main→live fallback. also `background` |
| `model.live.rest_url` | `JARVIS_LIVE_REST_MODEL_URL` | `http://llama-server-9b:8080` (or `…/v1/chat/completions`) | ⚠️ direct live var. `JARVIS_REST_MODEL_URL` is `model.main.rest_url` (reaches live via fallback). shared-network name, not host.docker.internal |
| `model.live.reasoning_budget` | `JARVIS_LIVE_REASONING_BUDGET` | `0` | 0=off, -1=unrestricted, N=cap |
| `rest.provider` | `JARVIS_REST_PROVIDER` | `openai` | **must** be openai (§1) |
| `rest.request_format` | `JARVIS_REST_REQUEST_FORMAT` | `openai` | default already openai |
| CC `llm.interface` | `LLM_INTERFACE_SEED` (one-time seed → alembic `f6a7b8c9d0e1`) | `Qwen3_5_9B_Compressed` | prompt provider, CC DB. ⚠️ **no live env_fallback** — reconcile must PUT the setting (§5 item 5) |

> **⚠️ Env-var nuance:** §2.2/§4a and the CI override use `JARVIS_MODEL_BACKEND` / `JARVIS_REST_MODEL_URL` — the `model.main.*` vars. These reach the live slot **only via the main→live fallback**, i.e. when `model.live.backend`/`.rest_url` are unset (true for a fresh install, so it works). If the live-specific `JARVIS_LIVE_*` vars are ever set, they win — prefer them for the sidecar to avoid ambiguity. (Also: `model_manager.py:610` in the hot-swap path pairs `model.live.rest_url` with `JARVIS_REST_MODEL_URL`, contradicting the canonical definition — a separate code bug worth flagging.)

---

## 8. Gotchas carried from the dev debug (don't re-learn these)

- **G1 — `rest.provider=generic` returns garbage** (whole dict as content). Must be `openai`. (§1)
- **G2 — `--reasoning-budget 0` does NOT suppress Qwen3.5 thinking** (neither the launch flag nor a `reasoning_budget` request field). The proxy's `_apply_reasoning()` sends `chat_template_kwargs:{"enable_thinking":false}` when budget==0 — that's the only thing that works. The launch flag is harmless/redundant. llama-server puts thinking in a separate `reasoning_content` field (not `content`), so "`<think>` in content" checks are useless — check `reasoning_content` length or `completion_tokens`.
- **G3 — `-c 8192` overflows real voice prompts (~8350 tok)** → HTTP 400 `exceed_context_size_error` → node voice fails. Use `-c 16384` (cheap on this hybrid model). This is why the dev voice "seemed to fail" even though tests passed (test prompts were smaller).
- **G4 — the non-tool REST path silently dropped `max_tokens`** (runaway 2000-token gens). Fixed in `chat_with_temperature`; make sure that fix is committed.
- **G5 — three generators + FOUR tracked registry copies drift.** Generators: installer `compose-generator.ts` + `compose-export-generator.ts`; admin `server/src/services/generators/compose-generator.ts` (install-e2e reuses the admin one via `gen-sync-compose.mts` — no 4th generator). Registries (all git-tracked): installer `public/service-registry.json`, admin `server/src/data/service-registry.json`, admin `server/tests/fixtures/service-registry.json`, admin `bundle/server/src/data/service-registry.json`. ⚠️ The two primary copies are **already drifted** (installer has 8 CC `llmInterfaceOptions`, admin has 3; admin has a `go2rtc` service the installer lacks). **Where the sidecar change must actually land: the 2 source copies** — installer `public/` and admin `server/src/data/`. The other two are inert for this change: `server/tests/fixtures/service-registry.json` is a **v1.0.0 legacy-schema** file that `registry.test.ts` *overwrites at `beforeAll`* (so editing it is unnecessary and won't break tests), and `bundle/server/src/data/…` is a **build artifact** regenerated at release. Still worth a sync-check test across the 2 source copies.

---

## 9. Rollout safety: failure posture · weights · rollback · ordering

These were missing from the original plan and change the implementation.

### 9a. Failure posture — flipping to REST is a single point of total voice failure
There is **no runtime REST→GGUF failover**. `rest_backend.py:396-398` re-raises on any transport error and `model_manager` has no fallback path — a REST slot stays a REST slot. So `proxy=REST` + sidecar unhealthy = **100% of completions raise** = full voice outage for that install. §0's "keep in-process GGUF as the non-GPU fallback" is a *platform* fallback (darwin), not a *runtime* one. Pick a posture explicitly:
- **(a)** keep an in-process GGUF slot loadable and add a REST→in-process circuit-breaker in `model_manager`, **or**
- **(b)** accept the coupling but make it loud: `depends_on: {llama-server-9b: {condition: service_healthy}}` on the proxy (needs the explicit healthcheck from §3) **and** a runbook line: *sidecar health == voice health*.

Do not ship the REST flip without one of these.

### 9b. Weights bootstrap — a missing GGUF is a crash-loop, and worse than today
§3 is right that there's **no model-download automation**. But the blast radius is under-reasoned:
- Today a missing **in-process** GGUF is **non-fatal**: `model_manager.py:481` keeps the container up, `/health` reports degraded, calls return 503.
- The third-party llama.cpp image has **no such handling**: a missing `-m /models/Qwen3.5-9B-Q4_K_M.gguf` makes `llama-server` exit → Docker restart-loops it → and the REST proxy errors on every call (§9a).
- **This bites existing GPU installs too:** an existing box runs some *other* model and won't have the 9B GGUF, so a reconcile that selects the 9B preset flips it straight into crash-loop + outage.

**Mitigation:** gate the REST flip on a **weights-present preflight** (check the GGUF on the model volume, or probe sidecar `/health`) before writing the backend override, and/or add a real 9B download step. At minimum, document that the operator stages the GGUF before reconciling, and keep the proxy on GGUF until the sidecar is healthy.

### 9c. Rollback
The plan is one-directional. Provide (and test) a revert path: (1) proxy backend override back to `GGUF`, (2) drop the `llama-server-9b` service, (3) move the GPU reservation + `.models` mount back onto the proxy (decision 6), (4) revert CC `llm.interface` (§5 item 5). These span env overrides, compose special-cases, and a CC DB setting, so a half-done rollback is easy — e.g. sidecar removed but proxy still REST → total outage.

### 9d. Cross-repo migration ordering (5 repos)
Land in this order, or reconcile/e2e will emit a sidecar the proxy image can't honor:
1. **jarvis-llm-proxy-api** — commit §0/§1 enabling code **and publish a new proxy image** (the REST reasoning/`max_tokens` fixes are uncommitted; generators referencing REST are useless until the image ships).
2. **jarvis-command-center** — confirm the deployed image has the `Qwen3_5_9B_Compressed` provider **and** the `f6a7b8c9d0e1` seed migration.
3. **registries + all 3 generators** — land together (one PR touching all 4 registry copies) with the `llmInterfaceOption`, preset, sidecar block, and REST override behind the decision-5 enablement key.
4. **install-e2e** — add the §6 assertions, including the CC provider flip.

---

## 10. Verification checklist

**Proxy / provider**
- [ ] Proxy `rest.provider` default = openai; enabling code committed + new proxy image published; REST tests green (there are **7** in `test_rest_backend.py`, not 12).
- [ ] Qwen3.5-9B preset + `Qwen3_5_9B_Compressed` `llmInterfaceOption` added to the **2 source registries** (installer `public/` + admin `server/src/data/`); fresh GPU install seeds `LLM_INTERFACE_SEED` and CC actually **runs** that provider end-to-end (not just the proxy).

**Behavior (fresh + reconcile)**
- [ ] Fresh GPU install (installer export compose) brings up `llama-server-9b` + proxy in REST mode; `curl :7704/v1/chat/completions` (authed) returns a clean answer, no thinking, correct tool call, < 3s.
- [ ] Existing-install reconcile (`/reconcile` or `gen-sync-compose.mts` → `docker-compose.sync.yaml`) includes the sidecar, flips the proxy to REST, **and** flips CC `llm.interface` — only when the decision-5 enablement key is set.
- [ ] **Opt-out safety:** an existing GGUF-on-nvidia stack that did NOT opt in stays GGUF after reconcile (no auto-flip). Assert in `test_sync_compose.py` (opt-out is cleanly generate-visible) + `compose-upgrader.test.ts`.
- [ ] Exactly one of {proxy, sidecar} carries the nvidia reservation + `.models` mount; `RUN_MODEL_SERVICE=false` on the proxy when the sidecar is active.
- [ ] Non-GPU / darwin install still uses in-process GGUF (sidecar absent — via the explicit `gpuType==='nvidia'` guard on the block, not the darwin filter).

**Weights / image**
- [ ] **Weights preflight:** the GGUF exists at `${STORAGE}/models` and the sidecar reaches its `/health` before install/reconcile is declared successful.
- [ ] Sidecar image pinned (digest/dated tag) with an explicit healthcheck; `-c` ≥ 16384; a ~10k-token prompt succeeds (no 400).

**Tests / CI (§6)**
- [ ] Installer + admin unit suites (`test.yml`): **`tsc` build passes** (preset uses a `serving` marker, not `backend:"REST"`); existing nvidia GPU-config tests **still green** (proving decision-5 gating); new sidecar-ON + darwin/opt-out non-emission cases added; `compose-env-contract` still resolves every `${VAR}`.
- [ ] `validate_matrix.py` (Phase 0, CPU-static) asserts the sidecar block is emitted for nvidia+opt-in and **absent** otherwise, with a **pinned** image (no GHCR-churn red).
- [ ] **GPU e2e (`install-e2e-gpu.yml`) exercises the sidecar** — a `cuda-sidecar` lane generates the compose with the sidecar enabled, brings it up on a Vast VM, and Phase G reads ggml offload markers from `llama-server-9b` (not the proxy). CPU e2e lane stays cloud-REST, sidecar out of its inventory.
- [ ] **Rollback** rehearsed: stack reverts to in-process GGUF and comes back healthy.
