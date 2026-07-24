# Building Vousoir

Vousoir is a fork of [code-oss](https://github.com/microsoft/vscode) (MIT) at tag **`1.130.0`**.
This document takes you from a clean Windows machine to a running Vousoir app.

**Windows is the primary target.** macOS and Linux build (code-oss is cross-platform), but only
the Windows path is exercised end to end here.

> **Two toolchains, on purpose.** code-oss builds with **npm** at the repo root, exactly as
> upstream does. The Vousoir layer (`typings/`, `vousoir/`, `extensions/vousoir-*`) is a separate
> **pnpm** workspace rooted at `vousoir/`, with its own isolated `node_modules`. They never share
> a `node_modules`. See `vousoir/PATCHES.md` (D1) for why.

---

## 1. Prerequisites

Install these **before** cloning. Versions below are the ones this build is verified against.

| Tool | Required version | Notes |
|---|---|---|
| **Node.js** | **`24.18.0`** (exact minor floor) | Pinned by `.nvmrc`. **Hard gate** — see below. |
| npm | `>=9 <12` | Ships with Node. `build/npm/preinstall.ts` rejects npm ≥ 12. |
| pnpm | `>=10` (verified `10.19.0`) | Vousoir layer only. `npm i -g pnpm` |
| Python | `3.12`–`3.13` (verified `3.13.14`) | For `node-gyp`. Needs `setuptools`. |
| **Visual Studio Build Tools 2022** | with **Desktop development with C++** | **Required.** Native modules build from source. |
| **VS component: Spectre-mitigated libs** | `...VC.Runtimes.x86.x64.Spectre` | **Required.** Not part of the C++ workload — see below. |
| Git for Windows | any recent (verified `2.51.0`) | |

### Node.js: install the **LTS** winget package

`winget install --id OpenJS.NodeJS -v 24.18.0` **fails** — the non-LTS feed tops out at 24.10.0.
Node 24 is the LTS line, so it lives in the LTS package:

```powershell
winget uninstall --id OpenJS.NodeJS          # if a non-LTS 24.x is installed
winget install --id OpenJS.NodeJS.LTS -v 24.18.0
```

Both packages install to `C:\Program Files\nodejs`; layering them leaves a broken PATH.

### Node.js is a hard gate

`build/npm/preinstall.ts` reads `.nvmrc` and **throws** unless your Node has the *same major* and
a *minor ≥* the pin. At tag `1.130.0` the pin is `24.18.0`, so Node `24.8.0` **fails** — same
major, older minor. Install `24.18.0` or newer 24.x.

Check: `node --version` → must be `v24.18.x` or higher 24.x.

> **The gate does not fail fast — check your version yourself first.** npm 11's `npm ci` builds
> dependency native modules (the *reify* phase) **before** running the root `preinstall` script.
> On a machine with the wrong Node and/or no MSVC, the install therefore dies partway through a
> native module (e.g. `bufferutil`) and the clear "Please use Node.js v24.18.0" message is never
> printed, because root lifecycle scripts never run. Verified against an actual failing run:
> the npm debug log contained no root-package script entries at all.
>
> Run `node --version` and the `vswhere` check below **before** `npm ci`, rather than relying on
> the build to tell you.

### Visual Studio Build Tools (the long pole)

`.npmrc` sets `build_from_source="true"` against Electron headers, so native modules
(`node-pty` for the terminal, `native-keymap`, `native-watchdog`, `@vscode/spdlog`, …) are
**compiled with MSVC**. Without it, `npm ci` fails partway through.

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

~5–7 GB, 15–40 minutes. **Open a fresh terminal afterward** so `node-gyp` can discover `cl.exe`.

#### Spectre-mitigated libraries (separate component)

code-oss compiles native modules with Spectre mitigation. Those libs are **not** in the base C++
workload; without them the build fails on `@vscode/deviceid` with:

```
error MSB8040: Spectre-mitigated libraries are required for this project.
```

```powershell
$vsArgs = @(
  'modify'
  '--installPath', '"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"'
  '--add', 'Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre'
  '--quiet', '--norestart'
)
Start-Process -FilePath "C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe" `
  -ArgumentList $vsArgs -Verb RunAs -Wait -PassThru
```

Two traps in that command, both of which cost us an hour:

* Use **`modify`**, not `install`, once Build Tools exists — `install` exits 1 with
  *"Visual Studio Build Tools 2022 is already installed"*.
* **Quote `--installPath` inside the array element.** PowerShell's `-ArgumentList` joins array
  elements with spaces and does *not* quote them, so an unquoted `C:\Program Files (x86)\...`
  arrives truncated at `C:\Program` and the installer reports *"An installed product matching the
  following parameters cannot be found"*.

Verify (exit 0 / non-empty output):
```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest `
  -requires Microsoft.VisualStudio.Workload.VCTools -property displayName
```

> **`vswhere` may print nothing even when the toolchain is fine.** If an earlier install was
> interrupted, the VS *instance* can lack its completion markers while every file is present.
> `node-gyp` locates MSBuild by path and never consults `vswhere`, so the authoritative check is
> whether a native module actually compiles — not what `vswhere` says. Verified on this machine:
> `vswhere` returned empty while `node-gyp` built a probe addon successfully.

---

## 2. Clone

```bash
git clone https://github.com/vousoir/vousoir.git
cd vousoir
```

---

## 3. Build the shell (code-oss layer — npm)

From the repo root:

```bash
npm ci        # installs root + every built-in extension (build/npm/postinstall.ts)
npm run compile
```

First install compiles native modules and takes a while. If it fails or the built app misbehaves,
remove **only** the root `node_modules` and reinstall:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

> ### ⚠️ Do NOT use `git clean -xfd` while the Vousoir layer is untracked
>
> Upstream's standard reset for a bad install is `git clean -xfd`. **Do not run it here** until
> the Vousoir layer has been committed. `-x` removes ignored *and* untracked files, and today
> `vousoir/`, `typings/`, `extensions/vousoir-core/`, `.dependency-cruiser.cjs`,
> `.github/workflows/vousoir-ci.yml`, and this file are all untracked — the command would delete
> the entire Vousoir layer along with `node_modules`.
>
> Once the layer is committed, `git clean -xfd` becomes safe again (it will still wipe
> `vousoir/node_modules`, so re-run `pnpm install` from `vousoir/` afterward).

Close any editor with this folder open before reinstalling. A running VS Code / Vousoir instance
holds handles inside `node_modules`, which surfaces as `EBUSY: resource busy or locked` during
npm's cleanup phase.

### Run it

```bash
./scripts/code.bat     # Windows
./scripts/code.sh      # macOS / Linux
```

---

## 4. Build the Vousoir layer (pnpm)

From `vousoir/` (the Vousoir workspace root — **not** the repo root):

```bash
cd vousoir
pnpm install
pnpm run verify
```

`verify` runs the full gate, and is what CI enforces:

| Script | What it does |
|---|---|
| `pnpm run lint` | ESLint over the Vousoir layer (§7.2 file/structure rules) |
| `pnpm run lint:strict` | same, but **warnings also fail** (CI mode) |
| `pnpm run dep-check` | dependency-cruiser boundary rules (§7.1) |
| `pnpm run typecheck` | strict `tsc --noEmit` across every package |
| `pnpm run test` | vitest unit tests |
| `pnpm run verify` | all of the above, in order |

`dep-check` and `lint` intentionally `cd ..` and run from the repo root: the Vousoir layer spans
`typings/`, `vousoir/`, and `extensions/`, and ESLint 9's flat config refuses to lint files
outside its config's base path.

---

## 5. Verification status

| Step | Status |
|---|---|
| Clone + checkout `1.130.0` | ✅ verified |
| Vousoir layer: install, lint, dep-check, typecheck, test | ✅ verified (`pnpm run verify` → exit 0) |
| Boundary + lint walls reject violations | ✅ verified (see `vousoir/PATCHES.md`) |
| code-oss `npm ci` + `npm run compile` | ✅ verified — 18 native `.node` modules built, 37/37 extensions with deps installed, compile exit 0 |
| App launches branded as Vousoir | ✅ verified — window title `Welcome - Vousoir Dev`, binary `.build\electron\Vousoir.exe`, data folder `~/.vousoir-app-dev` (no `.vscode-oss`) |
| service-host + dummy-service spawn in-app | ✅ verified — correct parent→child process tree under `ELECTRON_RUN_AS_NODE` |
| Electron's Node strips TypeScript types | ✅ **confirmed** — services run raw `.ts` entry points under Electron 42.6.0 with no build step; the esbuild fallback is not needed |

---

## Troubleshooting

**`Please use Node.js v24.18.0 or newer with the same major version`** — your Node is too old.
See §1. (`VSCODE_SKIP_NODE_VERSION_CHECK=1` exists but is not recommended.)

**`Please use npm version < 12.0.0`** — downgrade npm, or use the one bundled with Node 24.

**`gyp ERR! find VS`** — VS Build Tools missing or the terminal predates the install. Install
per §1, then open a **new** terminal.

**`'C:\Program' is not recognized as an internal or external command`** during `npm ci`
(fails on `bufferutil`, ~45s in) — **not** a missing-compiler problem. `node-gyp-build@4.8.1`,
pinned by the lockfile, spawns the build with `shell: true` **and** `process.execPath`:

```js
args = [process.execPath, <node-gyp path>, 'rebuild']   // "C:\Program Files\nodejs\node.exe"
proc.spawn(args[0], args.slice(1), { shell: win32 })     // shell always true on Windows
```

Under `shell: true` that path is passed to `cmd.exe` unquoted and breaks at the space.
(Fixed upstream in 4.8.4, which adds `shell = false` on that branch.) The broken branch only runs
when `require('node-gyp/package.json')` *resolves* — e.g. because a stray `node_modules` exists in
your home directory.

Fix without touching the repo or the lockfile — give Node a space-free path:

```powershell
cmd /c mklink /J "$env:USERPROFILE\nodejs" "C:\Program Files\nodejs"   # no admin needed
$env:PATH = "$env:USERPROFILE\nodejs;" + $env:PATH
& "$env:USERPROFILE\nodejs\node.exe" "$env:USERPROFILE\nodejs\node_modules\npm\bin\npm-cli.js" ci
```

`process.execPath` then contains no spaces, so the unquoted spawn works — for every native
module, not just `bufferutil`. Remove with `rmdir "$env:USERPROFILE\nodejs"`; the real install is
untouched.

**`npm error code ECONNRESET` during the extension install phase** — transient registry flakiness,
not a build failure. `build/npm/postinstall.ts` is **resumable**: re-run it directly rather than
redoing the whole `npm ci` (already-installed extensions become no-ops):

```powershell
$env:npm_config_fetch_retries = "8"
$env:npm_config_fetch_retry_mintimeout = "20000"
$env:npm_config_fetch_retry_maxtimeout = "120000"
node build/npm/postinstall.ts
```

Only 37 of the ~98 built-in extensions declare dependencies; the rest are themes and grammars.
`37/37` is complete — do not read `37/98` as a partial install.

**`vousoir-core` shows no `dist/`** — `npm run compile` builds the client and *extension media*
(`esbuild.*.mts`) but not a plain `esbuild.mts`. Build it directly:

```powershell
node extensions/vousoir-core/esbuild.mts
```

**node-gyp errors mentioning `distutils`** — Python 3.13 removed `distutils`; it is provided by
`setuptools`. `python -m pip install --upgrade setuptools`, or install Python 3.12 and point at
it with `npm config set python <path>`.

**`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` on a `@vousoir/*` package** — real failure in that package;
scroll up for the underlying `tsc`/`eslint` error.

**`ERR_PACKAGE_PATH_NOT_EXPORTED`** — this is the boundary seal working as designed (§6.3). You
deep-imported a package's internals. Import the package root instead (`@vousoir/shared`, not
`@vousoir/shared/src/...`); if you need something not exported, widen that package's `exports`
deliberately.
