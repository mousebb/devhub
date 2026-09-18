# DevHub — A Lightweight Dev Project Launcher for Windows

[简体中文](README.md) | **English**

> **Remember how your projects start**, then start and stop them with one click.
>
> DevHub does not manage your environment (it never installs Node/Python, never touches PATH).
> It only manages "run *this command* in *that directory*".

![Project list](docs/screenshot-running.png)

_(Screenshots use demo data: a `dpv-shop` group whose frontend and backend are merged into one group card with one-click start/stop. The UI itself is Chinese-only for now.)_

## Screenshots

**Project detail / live logs** — service status, ports, PID, uptime, plus the real-time output of
`npm run dev` (stdout/stderr color-coded, filterable, selectable, auto-scroll).

![Project detail](docs/screenshot-detail.png)

**Settings** — run mode, port checks, log limits, tray behavior, and a read-only view of the
inherited environment and available tools. Config and logs live under DevHub's own `data/` folder.

![Settings](docs/screenshot-settings.png)

## Getting started (3 steps)

> Requirements: Windows 10/11 + Node.js 18+ (only needed to build DevHub itself — the environment
> of the projects you manage is still up to you)

Open a terminal in `E:\prj\devhub` and run:

```bash
npm install     # once: install dependencies (skip if node_modules is already there)
npm run build   # build (re-run after changing the source)
npm start       # launch the DevHub window
```

- For **development**, use `npm run dev`: the renderer hot-reloads and the main process restarts on change.
- For **daily use**, use `npm start`: it runs the already built app and starts faster.
- Other scripts: `npm run typecheck` (TypeScript check), `npm run build` (= `electron-vite build`).
- Prefer no typing: create `DevHub.bat` inside `E:\prj\devhub` containing `npm start` and double-click it
  (can later be packaged into an exe / Start-menu entry).

### Installing on another machine / `npm install` hangs

**Why:** the Electron binary (~100 MB) is downloaded from GitHub by default, which is often
extremely slow or times out on some networks. It looks like the install froze after warnings such as
`boolean@3.2.0 deprecated`.

**Option A (recommended):** a copied project already ships `.npmrc` and `install.bat` — just
double-click **`install.bat`** (it forces Chinese mirrors too). To write `.npmrc` by hand:

```ini
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
fetch-retries=5
fetch-timeout=120000
```

**Option B (temporary, no files written):** set environment variables in CMD first:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm i --registry=https://registry.npmmirror.com
```

In PowerShell use `$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`.

**If a previous install was interrupted**, clear the broken cache first or retries will keep failing:

```bat
Ctrl + C                                        :: interrupt first
rd /s /q %LOCALAPPDATA%\electron\Cache           :: delete the partial Electron download cache
rd /s /q E:\prj\devhub\node_modules              :: delete the half-installed dependencies
npm cache clean --force
npm i
```

Verify afterwards with `npx electron -v` — printing a version means the binary was downloaded.

### FAQ

- **`npm install` hangs forever** — see "Installing on another machine" above.
- **`Cannot read properties of undefined (reading 'getPath')`** — your terminal has set
  `ELECTRON_RUN_AS_NODE=1` (common in terminals nested inside an Electron app), which turns
  `electron.exe` into plain Node. `npm run dev` / `npm start` go through `scripts/start.mjs`,
  which clears it automatically; when running Electron directly, do
  `set ELECTRON_RUN_AS_NODE=` or `env -u ELECTRON_RUN_AS_NODE electron .`.
- **GPU process crashes / window flashes and disappears / `GPU process isn't usable. Goodbye.`** —
  happens in remote sessions, services, GPU-less or sandboxed environments. Just disable the GPU:
  `electron . --disable-gpu --no-sandbox`.
- **npm not found** — check that `node -v` and `npm -v` work first; DevHub will not install Node for you.

### First run

1. Click **+ Add project** in the top-right → pick your code root folder (e.g. `E:\Projects`)
2. Hit **Scan** → tick the detected projects → DevHub generates commands such as `npm run dev` for you
   - If the folder you picked is a **parent of several sub-projects** (a typical split frontend/backend
     repo), the parent folder name is pre-filled as the **group name**, so they end up as one group
3. Back in the list, click **▶ Start** on a project card or a group card; open a project card to see live logs

> To group projects you already added: edit each of them, type the **same group name** and save.

### Self-check script

```bash
node scripts/smoke-test.mjs   # no UI: verifies start command / live logs / process-tree kill / env untouched
```

## Features

### Project management

- Add / edit / delete / duplicate projects; each project can hold multiple **services**
  (name, working directory, command, ports, env vars)
- **Directory scanning**: detects package.json / requirements.txt / pyproject.toml / pubspec.yaml /
  go.mod / Cargo.toml / *.csproj / pom.xml / composer.json / index.html, and discovers npm scripts
  (dev / start:dev / start…) so you can adopt a command with one click
- **Tech-stack icons**: brand icons per project type (Node.js / Python / Flutter / Go / Rust /
  .NET / Java / PHP / static site), falling back to your custom emoji when unknown
- Search (name / path / service / command / tags), sorting, favorites, recently started, tag filters

### Groups and one-click start/stop

- Projects sharing a `group` are **merged into a single group card** in the list: collapsible,
  showing its members and each member's services
- **Group-level start/stop**: bring up or tear down the whole frontend + backend at once, keeping
  each service's order and startup delay
- The sidebar "All projects" is a **group → project** tree, with a green dot next to running projects
- The sidebar can **collapse into an icon rail** (state persisted locally) — handy on small screens
- Project-level and service-level start/stop too; buttons follow the current state (shows "Stop" when everything is running)

### Logs

- Built-in log view: `stdout` / `stderr` / system messages in different colors, with filtering,
  auto-scroll, word wrap, copy whole log / copy selection / save / open log folder
- **Logs are persisted**: `<DevHub dir>\data\logs\<project>\<service>.log`, and are read back after
  restarting DevHub
- Python services automatically get `PYTHONUNBUFFERED=1`, so logs are not held back by pipe buffering
- Any service can still be launched in Windows Terminal / CMD / PowerShell instead (logs cannot be captured in that case)

### Runtime and safety

- **Port checks**: declared ports are checked before start and you are asked when one is occupied
  (DevHub never kills the occupying process)
- **Restore after restart**: services that were running when DevHub was closed show up as running
  again after reopening, and can be stopped
- Auto-restart on crash (per service), startup delay, config import/export (secret values stripped)
- System tray: list running services, stop one, stop all, quit; optionally minimize to tray on close
- Shortcuts: Open in VS Code / Open Folder

## Data and security

- Config, logs and runtime records all live under DevHub's **own** `data/` folder — **never inside the
  projects it manages**:

| Content | Location |
| --- | --- |
| Config file | `E:\prj\devhub\data\config.json` |
| Logs | `E:\prj\devhub\data\logs\<project>\<service>.log` |
| Orphan-process registry | `E:\prj\devhub\data\runtime.json` |
| Chromium cache / LocalStorage | `E:\prj\devhub\data\electron\` |

- How the data root is resolved: `DEVHUB_DATA_DIR` env var > the packaged exe's folder > the current
  directory when running from source, always with `data/` appended. Packaged as a portable exe, data
  travels with the exe.
- Config and logs from older versions (`%APPDATA%\DevHub`) are **migrated automatically on first launch**,
  so no project is lost.
- Env vars are only overridden inside the child process (`{...process.env, ...serviceEnv}`), and
  DevHub's own `NODE_ENV` / `ELECTRON_*` are stripped. The system PATH / NODE_PATH / PYTHONPATH /
  registry are **never modified**.
- Stop flow: close stdin and wait 3 seconds gracefully → `taskkill /PID x /T /F` kills the whole
  process tree (npm → node → children)
- Env vars marked as **secret** are masked in the UI and their values are stripped on export

## Project structure

```
devhub/
├── README.md / README.en.md    # Chinese / English docs
├── electron/
│   ├── main/
│   │   ├── index.ts            # main process: window / tray / IPC / data-dir redirect
│   │   ├── process-manager.ts  # spawn / state machine / process-tree kill / group start-stop / orphan recovery
│   │   ├── config-manager.ts   # config: <DevHub>/data/config.json (incl. legacy migration)
│   │   ├── log-store.ts        # logs: in-memory ring buffer + disk file + history read-back
│   │   ├── scanner.ts          # project / npm script detection
│   │   ├── system.ts           # port checks / where / open VS Code, etc.
│   │   └── icon.ts             # generates tray / window icon at runtime
│   ├── preload/index.ts        # exposes DevHubApi via contextBridge
│   └── shared/                 # types + IPC channel definitions (shared by main/renderer)
├── src/                        # React renderer
│   ├── components/             # Sidebar (collapsible tree) / GroupCard / ProjectCard / ServiceRow /
│   │                           # ProjectDetail / LogViewer / ProjectEditor / AddProjectWizard /
│   │                           # StackIcon (tech-stack icons) / SettingsPage
│   ├── lib/                    # api / store (global state) / format
│   └── App.tsx
├── docs/                       # UI screenshots used by the README
└── scripts/                    # start.mjs launcher / smoke-test.mjs core behaviour self-check
```

## Verification

| Case | Result |
| --- | --- |
| Case 1 — Node project `npm run start:dev` | ✅ verified inside the real app, logs captured live |
| Case 3 — multi-service Start All | ✅ in order, honoring `startupDelay` |
| Case 4 — Stop leaves no npm/node/child process | ✅ verified with `taskkill /T /F` |
| Case 5 — env safety (PATH/NODE_PATH/PYTHONPATH untouched) | ✅ asserted by `scripts/smoke-test.mjs` |
| Group one-click start/stop | ✅ verified in the real app (2 services started at once, each with live logs) |

Run `node scripts/smoke-test.mjs` any time to re-run the core behaviour self-check (no Electron needed).

## Notes and limits

- npm/npx/pnpm are `.cmd` files on Windows, so DevHub uses `spawn(cmd, { shell: true })`; the PID in
  the logs is the outer shell's PID, and stopping kills the whole tree
- DevHub will not fix your Node/Python environment: missing tools are shown explicitly as "not found"
  on the Settings page
- Services launched in the tray / external terminal cannot have their logs captured; DevHub says so in the UI
- An installer (NSIS) is not configured yet — for now use `npm run dev` / `npm start`
