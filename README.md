# Vousoir

**An Agentic Development Environment (ADE), built on [code-oss](https://github.com/microsoft/vscode).**

Vousoir is a full editor — everything VS Code does — plus a layer for working *with* agents rather
than merely alongside them: a per-repo project-data folder (`.vousoir/`) holding specs, whiteboards, and
committed agent traces, and a supervised service host for long-running local services.

> **Status: v1 shell.** The shell is complete and runs. The canvas, spec tree, and agent runtime are
> future work orders. What ships today is the rebranded editor, the `vousoir-core` extension with a
> placeholder panel, a working service host, and the enforcement tooling that keeps the layer clean.

---

## Quick start

```powershell
git config --global core.longpaths true      # once per machine — see below
git clone https://github.com/Firelight-Innovations/Vousoir.git C:\dev\Vousoir
cd C:\dev\Vousoir
.\setup.ps1
.\scripts\code.bat
```

> **Clone to a short path, and enable `core.longpaths` first.** code-oss contains paths deeper than
> Windows' 260-character `MAX_PATH` limit. Without both, `git clone` reports success but **checkout
> fails partway** with `Filename too long`, leaving a half-populated tree that looks like a corrupt
> repo. `setup.ps1` warns if either is missing.

`setup.ps1` verifies your toolchain, installs both dependency layers, compiles everything, and runs
the verification suite. It is safe to re-run and skips work already done.

**Windows is the primary target.** macOS and Linux build (code-oss is cross-platform) but only the
Windows path is exercised end to end.

### Prerequisites

`setup.ps1` checks all of these and tells you exactly what to run if one is missing.

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **24.18.0+** (24.x only) | `winget install --id OpenJS.NodeJS.LTS -v 24.18.0` — must be the **LTS** package |
| pnpm | 10+ | `npm install -g pnpm` |
| Python | 3.12–3.13 | plus `setuptools` (3.12 removed `distutils`) |
| **VS Build Tools 2022** | Desktop development with **C++** | native modules compile from source |
| **Spectre-mitigated libraries** | VS component | separate from the C++ workload — see [BUILDING.md](BUILDING.md) |

> Node 24 is the **LTS** line. `winget install --id OpenJS.NodeJS -v 24.18.0` fails — that feed tops
> out at 24.10.0.

---

## Daily development

```powershell
npm run watch              # incremental rebuild on save (leave running)
.\scripts\code.bat         # launch Vousoir

cd vousoir
pnpm run verify            # lint + boundaries + types + tests — run before every commit
```

`npm run watch` covers the code-oss layer and built-in extensions. For the Vousoir layer:

```powershell
cd vousoir
pnpm --filter @vousoir/shared run test -- --watch
node extensions/vousoir-core/esbuild.mts --watch     # from the repo root
```

### `pnpm run verify` is the gate

It runs, in order: `lint:strict` (warnings fail too) → `dep-check` (architectural boundaries) →
`typecheck` (strict TS) → `test`. CI runs exactly this. **Passing it is part of "done", not cleanup
for later.**

---

## Repository layout

```
Vousoir/
├─ src/                     code-oss core            (upstream — patch sparingly)
├─ extensions/
│  ├─ vousoir-core/         the Vousoir extension    ← our code
│  └─ …                     ~97 built-in extensions  (upstream)
├─ typings/vousoir/         @vousoir/typings — zod schemas + shared types
├─ vousoir/                 the Vousoir layer (isolated pnpm workspace)
│  ├─ shared/               @vousoir/shared — .vousoir scaffolding, helpers
│  ├─ services/
│  │  ├─ service-host/      supervises spawned services
│  │  └─ dummy-service/     reference service implementation
│  ├─ boundary-tests/       proves the enforcement walls actually fire
│  ├─ PATCHES.md            core-patch ledger — read before editing src/
│  ├─ HANDOFF.md            current state, traps, open items
│  └─ CONTRIBUTING.md       layer conventions
├─ setup.ps1                one-command dev setup
├─ build.ps1                one-command distributable build
└─ BUILDING.md              toolchain detail + troubleshooting
```

### Two toolchains, deliberately

- **npm** owns the repo root, exactly as upstream does (enforced by `build/npm/preinstall.ts`).
- **pnpm** owns the Vousoir layer from an isolated root at `vousoir/`.

They never share a `node_modules`. A root-level `pnpm-workspace.yaml` makes pnpm adopt
`code-oss-dev` and collide with npm — verified empirically. Don't move it. See `vousoir/PATCHES.md`
deviation D1.

---

## Architecture

### Services are spawned processes, not libraries

`vousoir-core` **spawns** `service-host` and speaks newline-delimited JSON over stdio. It never
imports it. `service-host` in turn supervises each service listed by a `vousoir.service.json`
manifest and terminates the whole tree when the app exits.

```
Vousoir.exe (extension host)
└── service-host/src/main.ts
    └── dummy-service/src/index.ts
```

Two details that are easy to get wrong and hard to debug:

- **`ELECTRON_RUN_AS_NODE=1` is mandatory** on every spawned process. Inside the extension host,
  `process.execPath` is the *Electron binary* — spawning it without this launches a whole Electron
  instance. Unit tests run under plain Node and cannot catch this.
- **Services run raw `.ts`.** Electron 42.6's bundled Node strips TypeScript types, so service entry
  points need no build step. Verified in-app.

### The wire protocol has exactly one source

Both sides import `serviceHostRequestSchema` / `serviceHostResponseSchema` from `@vousoir/typings`.
Never redeclare a protocol type locally — two packages once declared incompatible types under the
same names, and dependency-cruiser **cannot** catch that (it tracks imports, not declarations).

### Two independent enforcement walls

1. **Node `exports` sealing** — deep imports fail at runtime with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
   Anything a sibling needs must be re-exported from the package barrel.
2. **dependency-cruiser** — 8 rules, all `error`: no cross-service imports, extensions may only reach
   typings and shared, the Vousoir layer must not import core, core must not import Vousoir, etc.

`vousoir/boundary-tests/` proves both fire, asserting on *specific* rule names rather than "something
failed". If a rule blocks you, the design is telling you something — **don't edit
`.dependency-cruiser.cjs` or the ESLint ignores to get around it.**

### The `.vousoir/` folder

Every repo opened with Vousoir gets a `.vousoir/` at its root, so a collaborator who clones sees the full
project state with no external database:

```
.vousoir/
├─ spec/          module tree, one Markdown node per file   [committed]
├─ whiteboards/   frontend/UX canvases                      [committed]
├─ traces/        one JSONL file per agent run              [committed]
├─ docs/          Vousoir-maintained module docs            [committed]
└─ cache/         SQLite index — derived, regenerable       [gitignored]
```

Traces are committed, portable JSONL — readable in any editor, diffable in git. `cache/` is only an
index rebuilt from them. Scaffold with `v6rInit()` from `@vousoir/shared`.

---

## Building a distributable

```powershell
.\build.ps1                      # minified, x64
.\build.ps1 -Arch arm64          # arm64
.\build.ps1 -NoMinify -Archive   # fast build + .zip
```

Output lands next to the repo at `..\VSCode-win32-x64\Vousoir.exe` (the folder name comes from
upstream's packaging task; the executable is rebranded). Expect 20–45 minutes — minification
dominates.

Builds are **unsigned**; signed installers are out of scope for v1. SmartScreen will warn on first
run on another machine.

---

## Patching upstream code

Vousoir tracks code-oss at tag **`1.130.0`**. Every edit to a file outside `extensions/vousoir-*` and
`vousoir/` is a **core patch** and must be logged in [`vousoir/PATCHES.md`](vousoir/PATCHES.md) with
the file, the change, the reason, and whether it will conflict on an upstream merge.

**Budget: ≤ 15 core patches. Currently 8.** If it can be done via `product.json`, an extension, or
configuration instead — do that. Adding new files is not a core patch; they cannot conflict.

Rebranding lives entirely in `product.json` (the sanctioned customization point) plus replaced icon
binaries. Telemetry endpoints and Microsoft-account services are removed; the extension gallery
points at [Open VSX](https://open-vsx.org).

```powershell
git remote -v
# origin    https://github.com/Firelight-Innovations/Vousoir.git
# upstream  https://github.com/microsoft/vscode.git
```

Full upstream history is preserved, so `git merge <upstream-tag>` works.

---

## Troubleshooting

Most problems are Windows toolchain issues, not Vousoir. [BUILDING.md](BUILDING.md) documents each
one with its exact error text. The greatest hits:

| Symptom | Cause |
|---|---|
| `'C:\Program' is not recognized` during `npm ci` | `node-gyp-build@4.8.1` spawns with `shell:true` + an unquoted `process.execPath`. `setup.ps1` fixes this with a space-free Node junction. |
| `error MSB8040: Spectre-mitigated libraries are required` | Separate VS component, not in the C++ workload. |
| `npm error code ECONNRESET` | Transient registry failure. `postinstall` is resumable — just re-run `setup.ps1`. |
| `EBUSY: resource busy or locked` | Vousoir or VS Code is running and holding `node_modules`. Close it. |
| `Please use Node.js v24.18.0 or newer` | Wrong Node. Note it fails *late* — npm builds native modules before root lifecycle scripts. |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Working as designed. You deep-imported a package's internals; import the barrel. |

> ⚠️ **Never run `git clean -xfd`** while any part of the Vousoir layer is untracked — `-x` removes
> untracked files and would delete it. To reset a bad install, remove only `node_modules`, or run
> `.\setup.ps1 -Clean`.

---

## License

Vousoir is [MIT licensed](LICENSE.txt), as is the code-oss source it derives from. Microsoft remains
the original copyright holder of the upstream code; that attribution stays in `LICENSE.txt` and is
correct, not an oversight.

Vousoir is **not** affiliated with, endorsed by, or supported by Microsoft. It does not use the
Visual Studio Code name, logo, or Marketplace.
