# Cypress Launchpad Demo - CLAUDE.md

Quick reference for AI agents working on the Cypress Launchpad web app. Read this first to avoid re-reading full source files.

**Last Updated:** 2026-04-23  
**Changes:** Explicitly set `stepDefinitions` in `package.json` to fix Cucumber step discovery; created comprehensive project `README.md`

## AI Agents for Launchpad Development

All agents live in `.claude/agents/`. When working on Launchpad code, use:

- **launchpad-dev**: Expert FANG-level developer. Use this for any code changes, bug fixes, or new features in the Launchpad. Knows the full architecture, handles all platform-specific concerns (Windows/Mac/Linux).
- **launchpad-monitor**: Automatically detects code changes and triggers documentation updates. Can be invoked manually to sync documentation.
- **launchpad-docs-writer**: Dedicated writer for `cypress-launchpad/docs/` (FLOWCHART.md, LAUNCHPAD_KT.md, POC.md). Updates Mermaid diagrams and KT content when Launchpad code changes. Triggered by `docs-sync-orchestrator`.
- **claude-md-syncer**: Updates CLAUDE.md files to keep architecture docs in sync with code. Usually triggered by launchpad-monitor.
- **docs-sync-orchestrator**: Single entry point after any coding session — say "sync docs" to auto-detect changes and trigger the right agents.
- **super-dev-agent**: Generate new code, React components, or utility functions.
- **debug-agent**: Diagnose and fix errors in Node.js backend or JavaScript applications.
- **ultimate-code-reviewer**: Comprehensive code quality reviews.
- **optimization-agent**: Performance optimization and stability improvements.
- **project-readme-writer**: Create or update project documentation.

**Workflow**: Make code changes → say "sync docs" → docs-sync-orchestrator triggers launchpad-monitor + launchpad-docs-writer → all docs stay current.

## Architecture

- **Single-page React app** with no build step (Babel standalone + React 18 from CDN)
- **Backend**: Native Node.js `http` module (no Express), port **4500**
- **No template engine** — HTML shell served inline from `testdata-manager.js`, React app loaded as `<script type="text/babel" src="/app.js">`
- **Docker Runner**: Isolated container execution with real-time log streaming and Windows support

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `cypress-launchpad/testdata-manager.js` | ~1396 | HTTP server, all API routes, DB queries, test execution orchestration |
| `cypress-launchpad/app.js` | ~3456 | Full React UI — 5-step workflow components, all inline styles |
| `cypress-launchpad/docker-runner.js` | ~1035 | Docker image build, container lifecycle, report extraction, image pruning |
| `Dockerfile.base` | ~180 | Base image: MS Edge, Cypress deps, node_modules cache layer |
| `cypress-launchpad/reports/` | dir | Generated HTML test reports + `run.log` per report |
| `cypress-launchpad/issue-logs/issues.json` | json | Auto-logged issues and errors |

## UI Workflow (5 Steps)

1. **Entities** — Edit test data (categories, variants, users, carts) per environment
2. **Features** — Pick tests by @tag or custom spec file selection (tab autocomplete supported)
3. **Configure** — Run mode (local/docker), batch size (Docker), browser selection, device capacity info, headed/headless toggle (local only)
4. **Run Tests** — Execute with live SSE log streaming, Docker stats polling, real-time build logs
5. **Reports** — View HTML reports with failure details and screenshots

## Key State Variables (app.js, ~line 149-195)

```
selectedEnv, envs, dbEnvs              — Environment selection
existingFields, newFields              — Entity data for Step 1
featureMode, selectedTag, tagSpecs     — Feature selection for Step 2 (tag or custom files)
tagSpecsLoading                        — Boolean: true while /api/specs-by-tag fetch is in progress
selectedSpecs, loadingFeatures         — Custom spec file state for Step 2
runMode ('local'|'docker'|'debug')     — Run mode selection ('debug' = cypress open interactive)
batchSize (1-2), browser, headed       — Run configuration (max 2 in Docker)
installedBrowsers                      — Detected local browsers from /api/browsers
deviceCapacity                         — Device memory info from /api/device-capacity
dockerStatus, buildingImage            — Docker state (image status)
buildLogs                              — Real-time Docker build log lines
runId, runStatus, runLogs              — Active test run state
runReportDir                           — Report directory from completed run
pastReports                            — List of past reports (Step 5)
showReports                            — Boolean: controls persistent Reports drawer visibility
showLogOverlay, logOverlayReport       — Full-screen run log overlay state
autoScroll                             — Boolean (default true): controls auto-scroll in log panels
```

## API Routes (testdata-manager.js)

### Data Management
- `GET /api/envs` — Available environments
- `GET /api/data?env=X` — Load TestData JSON
- `POST /api/save` — Save entity names
- `GET /api/search?env=X&field=Y&q=Z` — DB entity search (unlinked)
- `GET /api/search-linked?env=X&field=Y&q=Z&categories=A&products=B` — Linked autocomplete
- `GET /api/db-envs` — Environments with DB credentials
- `GET /api/device-capacity` — Device memory info (total GB, free GB, recommended batch size, platform)

### Test Runner
- `GET /api/features` — Feature file tree as nested JSON
- `GET /api/tags` — All unique @tags with scenario counts
- `GET /api/specs-by-tag?tag=X` — Specs matching a tag
- `GET /api/browsers` — Detect locally installed browsers
- `POST /api/run/start` — Start test run
- `GET /api/run/logs/:runId` — SSE log stream
- `POST /api/run/stop/:runId` — Stop running test

### Docker
- `GET /api/docker/status` — Docker + image availability
- `POST /api/docker/build` — Build image (SSE progress)
- `GET /api/docker/stats/:runId` — Container CPU/memory stats
- `POST /api/docker/cleanup` — Remove image & containers

### Reports
- `GET /api/reports` — List past reports (`hasLogs` field indicates run.log presence)
- `GET /api/reports/:name/failures` — Failure summary
- `GET /api/reports/:name/logs` — Full run log as `{ ok, lines[], count }` JSON
- `DELETE /api/reports/:name` — Delete report
- `GET /reports/*` — Static file server for report HTML

## React Components (app.js)

| Component | ~Line | Purpose |
|-----------|-------|---------|
| `App` | 135 | Root — manages all state, step navigation, data loading |
| Entity step (inline) | ~700 | Step 1 — entity name editing with autocomplete |
| Feature step (inline) | ~1050 | Step 2 — tag picker or spec file tree with tab autocomplete |
| `RunConfig` | 1354 | Step 3 — run mode (local/docker/debug), batch, browser, headed toggle, device capacity |
| `parseLogs` | ~1958 | Helper — parses `[spec-X | name]` prefixes, spec-manifest, and completion lines |
| `SpecProgressTracker` | ~2000 | Step 4 — shows all specs with live status: pending/running/passed/failed |
| `SplitLogViewer` | ~2090 | Step 4 — priority-aware per-container log panels (max 2), layout by batchSize |
| `FullLogViewer` | ~2200 | Step 4 — Jenkins-style sequential log view across all containers |
| `CopyLogButton` | ~2250 | Reusable clipboard button — strips ANSI, joins lines, writes to clipboard |
| `RunLogBody` | ~2260 | Renders saved `run.log` lines inside the Reports log overlay |
| `RunPanel` | 1529 | Step 4 — execution control, live logs, Docker stats, post-run action bar |
| `ReportViewer` | ~2291 | Step 5 + drawer — report list, failure viewer, delete |
| Reports drawer (inline in App) | ~720 | Fixed right-side drawer (520px), always accessible via header button |
| Run log overlay (inline in App) | ~740 | Full-screen overlay for past report logs |

## Patterns & Conventions

- **No JSX in dynamic browser list** — uses `React.createElement()` for options inside `<select>` (Babel standalone limitation)
- **Unicode escapes in `React.createElement()`** — use `\u26A1`, etc. instead of `&#x26A1;`
- **Inline styles only** — no CSS files, all styles as JS objects in `style={}` props
- **SSE (Server-Sent Events)** for real-time log streaming and Docker build progress
- **Route matching** via `if (pathname === '...' && req.method === '...')` pattern
- **DB queries** use `pg` User with SSL, credentials from `DB_CREDENTIALS` map

## Docker Runner (docker-runner.js)

- Image name: `platform-cypress-runner`
- **BuildKit**: Disabled globally (`DOCKER_BUILDKIT=0`) for all platforms
- **`ensureDockerRunning(onLog, callback)`**: Auto-starts Docker Desktop/daemon on server startup
- **`pruneDanglingImages(onLog)`**: Removes `<none>:<none>` dangling images after builds
- **One-Container-Per-Spec**: Each spec gets an isolated container; `batchSize` = max parallel containers
- **Memory**: `--memory=4g --memory-swap=4g` per container on Linux/Mac; skipped on Windows
- **Stop**: `docker kill` (SIGKILL, 10s timeout) for fast container termination

## Platform-Specific Notes

### Windows (14GB Laptops)
- Docker memory allocation skipped (Docker Desktop manages dynamically)
- Batch size capped at 2
- Docker executable path quoted with double quotes if path contains spaces
- `DOCKER_BUILDKIT=0` set globally

### Linux/Mac
- Explicit memory limits: `--memory=batchSize*4g --memory-swap=batchSize*4g`
- Standard Unix path handling

**Linux Docker**: Prefer Docker Engine (`sudo apt install docker.io`) over Docker Desktop — Docker Desktop uses QEMU which can be OOM-killed under parallel container load.

## Protected Files (require approval)

`cypress.config.js`, `env.js`, `test.runner.js`, `package.json`, `.gitignore`

### cypress.config.js — Key Patterns

`setupNodeEvents` registers the Cucumber preprocessor using the v4.3.1 API. The correct pattern is:

```js
const cucumberPlugin = require('cypress-cucumber-preprocessor').default;

setupNodeEvents(on, config) {
  on('file:preprocessor', cucumberPlugin());
  return config;
}
```

The previously broken pattern (`require('cypress-cucumber-preprocessor/plugins')(on, config, options)`) does not exist in v4.3.1 and causes a module-not-found error at startup. Do not revert to that form.

### package.json — Cucumber JSON Output

The `cypress-cucumber-preprocessor` config block controls where Cucumber JSON result files are written after each run:

```json
"cypress-cucumber-preprocessor": {
  "cucumberJson": {
    "generate": true,
    "outputFolder": "cypress/cucumber-json",
    "filePrefix": "",
    "fileSuffix": ".cucumber"
  }
}
```

The Launchpad's local run report logic (in `testdata-manager.js`) reads from `cypress/cucumber-json/` to collect result files after a local or debug run completes. This path must match `outputFolder` above.

Step definitions are located in `cypress/support/step_definitions/`.

## Issue Logging

When Claude encounters errors or bugs, they are logged to `cypress-launchpad/issue-logs/issues.json` automatically.

## Docs

Architecture documentation lives in `cypress-launchpad/docs/`:
- `FLOWCHART.md` — Mermaid architecture and flow diagrams
- `LAUNCHPAD_KT.md` — Knowledge Transfer guide for all audiences
- `POC.md` — Proof-of-concept decisions and trade-off notes

Topic-specific guides live in `readme-docs/`:
- [AI Agents Guide](./readme-docs/ai-agents-guide.md) — How to use all 10 AI agents
- [Test Data Manager](./readme-docs/test-data-manager.md) — Managing test entities and running tests via the UI
- [Launchpad Docker Architecture](./readme-docs/launchpad-docker-architecture.md) — Deep dive: Docker internals, one-container-per-spec, build pipeline
