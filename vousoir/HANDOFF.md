# Vousoir — Handoff

**Written:** 2026-07-23 · **Repo root:** `C:\Users\bjsea\Documents\Projects\vousoir\vousoir`

Read this before touching anything. It records state that is **not** recoverable from the code or
git history, and several traps that will cost you an hour each if you rediscover them.

Authoritative documents, in precedence order:

1. `vousoir-shell-work-order.md` (repo parent dir) — the executable spec. **§9 acceptance tests are
   the definition of done. §10 out-of-scope is binding — do not build ahead of it.**
2. `vousoir/PATCHES.md` — core-patch ledger, deviations (D1–D7), corrections (C1–C2),
   architectural decisions (A1–A3).
3. `BUILDING.md` — toolchain, build, troubleshooting.
4. `vousoir/CONTRIBUTING.md` — layer conventions.

---

## 1. ⚠️ Read this first — the three ways to destroy work

**1. Never run `git clean -xfd`.** The entire Vousoir layer is **untracked**. `-x` removes ignored
*and* untracked files, so it would delete `vousoir/`, `typings/`, `extensions/vousoir-core/`,
`.dependency-cruiser.cjs`, `.github/workflows/vousoir-ci.yml`, and `BUILDING.md`. To reset a bad
install remove **only** `node_modules`.

**2. The Vousoir layer is not committed.** Only 11 tracked files are modified (`product.json` +
10 under `resources/`). Everything else the project consists of is untracked. There is no second
copy. Do not `git checkout .`, `git stash`, or `git reset --hard` without understanding this.

**3. Do not commit or push unless the user explicitly asks.** Committing is the user's call.

---

## 2. Current state — verified, not claimed

Every item below was verified by running the command, not by trusting a report.

### Base

| | |
|---|---|
| Upstream | code-oss (`microsoft/vscode`), MIT |
| Base tag | **`1.130.0`**, commit `1b6a188127eeaf9194f945eb6eb89a657e93c54c` |
| Branch | `vousoir-base` |
| **Core patches** | **3 / 15** (budget per work order §4.5) |

Core patches spent: (1) `product.json` rebrand + Open VSX + telemetry removal, (2) 8 app-icon
binaries, (3) 2 branding-string text files. Full detail in `vousoir/PATCHES.md`.

### Build state — the app builds and runs

| | |
|---|---|
| Native `.node` modules | 18 built |
| Extensions with deps installed | **37 / 37** (only 37 of ~98 declare deps — `37/98` is *complete*) |
| `out/` | 7,577 files, `npm run compile` exit 0 |
| `extensions/vousoir-core/dist/extension.js` | built (67 KB) |
| Binary | `.build\electron\Vousoir.exe` |
| Window title | `Welcome - Vousoir Dev` |
| Data folder | `~/.vousoir-app-dev` + `~/.vousoir-app-shared` (no `.vscode-oss`) |

### Vousoir layer — green

`pnpm run verify` from `vousoir/` → **exit 0**: lint:strict, dep-check (49 modules / 109 deps),
typecheck, 22 tests across 4 packages.

---

## 3. Environment — non-obvious, required

### The Node junction is load-bearing

```
C:\Users\bjsea\nodejs  →  C:\Program Files\nodejs      (directory junction)
```

**`npm ci` fails without it.** `node-gyp-build@4.8.1` (lockfile-pinned) spawns builds with
`shell: true` *and* `process.execPath`; under `shell:true` that unquoted `C:\Program Files\...`
path breaks at the space (`'C:\Program' is not recognized`). Fixed upstream in 4.8.4. Only
triggers because a stray `C:\Users\bjsea\node_modules\node-gyp` makes the broken branch resolve.

**Always run root npm commands through the junction:**

```powershell
$env:PATH = "C:\Users\bjsea\nodejs;" + $env:PATH
& "C:\Users\bjsea\nodejs\node.exe" "C:\Users\bjsea\nodejs\node_modules\npm\bin\npm-cli.js" ci
```

### Toolchain (installed, verified)

- Node **24.18.0** — hard gate in `build/npm/preinstall.ts` (same major, minor ≥ `.nvmrc`).
  Note it does **not** fail fast: npm 11 builds dependency natives *before* root lifecycle scripts,
  so a wrong Node dies inside a native module instead of printing the clear message.
- MSVC **14.44.35207** + **Spectre-mitigated libs** (separate VS component; without it
  `@vscode/deviceid` fails `MSB8040`), Windows 11 SDK **26100**, Python 3.13.14 + setuptools.
- **`vswhere` returns empty on this machine even though the toolchain works.** The VS instance
  lacks completion markers from an interrupted install. `node-gyp` finds MSBuild by path and never
  consults `vswhere`. Judge the toolchain by whether a native module compiles, not by `vswhere`.

### Two toolchains, deliberately separate

- **npm** governs the code-oss root (enforced by `build/npm/preinstall.ts`).
- **pnpm** governs the Vousoir layer from an isolated root at `vousoir/` (deviation D1).
  A root-level `pnpm-workspace.yaml` makes pnpm adopt `code-oss-dev` and collide with npm over
  root `node_modules` — empirically confirmed. Do not move it.

They never share a `node_modules`. pnpm's symlinks in `extensions/vousoir-core/node_modules/@vousoir/`
survive `npm ci` — verified.

---

## 4. Commands

```powershell
# Vousoir layer (from vousoir/) — run this before claiming any change is done
pnpm run verify          # lint:strict + dep-check + typecheck + test
pnpm run lint:strict     # warnings fail too (CI mode)
pnpm run dep-check       # dependency-cruiser boundaries

# code-oss layer (from repo root, via the junction — see §3)
npm ci
npm run compile
node extensions/vousoir-core/esbuild.mts   # vousoir-core is NOT built by `npm run compile`
.\scripts\code.bat                         # launch
```

`npm run compile` builds the client and *extension media* (`esbuild.*.mts`). A plain `esbuild.mts`
— which is what `vousoir-core` uses — is not matched. Build it separately.

---

## 5. Architecture — decisions you must not silently reverse

**A1 — service-host is a spawned process, not a library.** `extensions/vousoir-core` **spawns**
`vousoir/services/service-host` and speaks newline-delimited JSON over stdio. It must never
`import` it. dependency-cruiser enforces this. If a boundary rule blocks you, the design is
telling you something — escalate rather than loosening the rule.

**A2 — `ELECTRON_RUN_AS_NODE=1` on every spawned process.** Inside the extension host
`process.execPath` is the **Electron binary**, not node. Spawning it without this launches a whole
Electron instance. Unit tests run under plain Node and *cannot* catch this.

**A3 — `typings/vousoir` is the single source of the wire protocol.** Both sides import
`serviceHostRequestSchema` / `serviceHostResponseSchema` from `@vousoir/typings`. Two packages once
declared incompatible types under the same names; dependency-cruiser **cannot** catch that (it
tracks imports, not duplicate declarations). Never redeclare a protocol type locally.

**Confirmed:** Electron 42.6.0's bundled Node **strips TypeScript types**. Services run raw `.ts`
entry points in-app with no build step. The esbuild-the-services fallback is **not** needed.

### Enforcement walls (two, independent)

1. **Node `exports` sealing** (§6.3) — deep imports fail at runtime with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`. Anything a sibling needs must be re-exported from the barrel.
2. **dependency-cruiser** (§7.1) — 8 rules, all `error`, no severity downgrades.

`vousoir/boundary-tests/` proves both fire, asserting on *specific* rule names. Deliberately-broken
fixtures are quarantined so `pnpm run verify` stays green:

- `vousoir/boundary-tests/fixtures/` — excluded by path (scripts list `boundary-tests/src` only)
- `vousoir/services/__ci-fixtures__/` — excluded via the **CLI `-x` flag** on `dep-check`,
  deliberately *not* in `.dependency-cruiser.cjs`. If the exclusion lived in the config file, the
  proving test (which loads that same config) would inherit it and never see the violation.

**Do not "fix" a failing rule by editing `.dependency-cruiser.cjs` or `eslint.config.mjs` ignores.**

---

## 6. Acceptance tests (work order §9) — status

| # | Test | Status |
|---|---|---|
| 1 | Clean build | ✅ builds from source (see §3 for required env) |
| 2 | Launch & brand | 🟡 title / exe / data folder ✅ — **About dialog unverified** |
| 3 | Editor (TS + Python) | ⬜ manual |
| 4 | Terminal (PowerShell ×2) | ⬜ manual |
| 5 | Git UI | ⬜ manual |
| 6 | Open VSX search + install | ⬜ manual |
| 7 | Vousoir panel renders | ⬜ manual |
| 8 | Service host lifecycle | 🟡 spawn ✅ verified in-app — **shutdown/no-orphan unverified** |
| 9 | Boundaries fail correctly | ✅ |
| 10 | Linter + 501-line fixture | ✅ |
| 11 | `.v6r` scaffold + zod goldens | ✅ |
| 12 | CI green (Windows + mac + Linux) | ⬜ workflow exists, **never executed** |
| 13 | PATCHES.md complete, ≤ 15 | ✅ 3/15 |

Verified in-app process tree for §9.8:

```
Vousoir.exe (extension host)
└── Vousoir.exe  …\service-host\src\main.ts
    └── Vousoir.exe  …\dummy-service\src\index.ts
```

**The app may still be running.** Check for `Vousoir.exe` before rebuilding — a running instance
holds file locks in `node_modules` and causes `EBUSY` during install.

---

## 7. Open items

- **§9.8 shutdown half** — close the app, then confirm no `service-host` / `dummy-service`
  survives (`Get-CimInstance Win32_Process`).
- **Manual §9 checks** — 2 (About), 3, 4, 5, 6, 7.
- **§9.12** — CI has never run; no GitHub remote is configured.
- **`build/lib/builtInExtensions.ts:48`** hardcodes `~/.vscode-oss-dev` for a build-time control
  file, creating a stray folder. Build-time only, not user-visible chrome → §9.2 unaffected.
  Logged, deliberately **not** patched (would spend a core patch on a hidden folder).
- **`webviewContentExternalBaseUrlTemplate`** still points at `*.vscode-cdn.net`. It is the webview
  iframe-isolation origin — not telemetry, no self-hosted replacement, outside §4.4. Left alone.
- **`defaultChatAgent`** (GitHub Copilot Chat) left in place: it is non-optional in
  `IProductConfiguration`, and it is GitHub — not Microsoft-account — auth, so outside §4.4.
  `builtInExtensionsEnabledWithAutoUpdates` still lists `GitHub.copilot-chat`, which will not
  resolve on Open VSX — watch startup console for a noisy failure.
- **`v6r-init.test.ts` is self-referential** — it asserts `v6rInit()` matches `V6R_SUBDIRS`, both
  from the same source. The constants were hand-checked against §8 and are correct *today*, but a
  future edit to `V6R_SUBDIRS` would silently pass. Hardening = assert literal strings.
- **Stray `C:\Users\bjsea\node_modules`** has now caused two problems (the `@types` leak in
  typecheck, and the `node-gyp-build` trigger). Cleaning it is the user's call — it is in their
  home directory and its provenance is unknown.

---

## 8. Working agreements

- **Verify, don't trust.** Re-run claimed commands. Several sub-agent reports in this project were
  accurate; some were not, and two genuine config defects were found only by negative-testing.
- **A clean exit code is not proof.** The VS installer exited 0 with the workload missing;
  `postinstall` exited 0 at `37/98`. Check the artifact, not the status code.
- **Check the baseline before filing a defect.** Three PNGs looked wrong at 1024×1024 until
  `git show HEAD:` proved upstream ships them identically.
- **Core edits need a `PATCHES.md` entry** and should be escalated to the user first. Budget is
  ≤ 15 total; 3 spent. If it can be done via `product.json`, an extension, or config — do that.
- **`pnpm lint` + `pnpm dep-check` passing is part of done**, not cleanup for later.
