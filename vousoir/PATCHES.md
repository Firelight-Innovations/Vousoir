# Vousoir — code-oss Divergence Ledger

> **Status change (2026-07-24): Vousoir is now a HARD FORK, not a bounded patch set.**
>
> This document began as a §4.5 "core patch ledger" with a **target of under 15 core patches**,
> on the assumption that Vousoir would be a thin branding layer over an otherwise-pristine
> code-oss that could still take upstream merges. That assumption no longer holds. On explicit
> user direction — *"delete it ALL, code and config … we want this very bare bones, we will
> rebrand this just like Cursor, they removed all of the microslop specific stuff"* — the entire
> Microsoft/GitHub AI surface was **physically excised** from the tree.
>
> **Actual divergence from `1.130.0`: ~8,150 files changed — ~7,900 deletions, ~180 core-file
> modifications, ~70 additions.** The ≤15 patch budget (work-order acceptance test #13) is
> therefore **deliberately and knowingly retired.** It is not a regression to be fixed; it was
> traded away for a clean-room base, with the cost stated and accepted at decision time.
>
> **Consequence for upstream merges:** a blanket `git merge` from `microsoft/vscode` is no longer
> viable — thousands of deleted files would conflict or silently resurrect AI surface. Upstream
> tracking, if desired later, becomes a *curated* activity: cherry-pick specific non-AI fixes, or
> re-apply the small branding set (below) onto a fresh base. See DEAI-PROGRESS.md for the full
> excision inventory.

Historically (and still, for the branding/config layer): every change to a code-oss core file
(anything outside `extensions/vousoir-*` and `vousoir/`) is logged here — file touched, what
changed, why, and merge risk. For **branding/config**, if a change can be made via `product.json`,
a built-in extension, or configuration instead of a core edit, it still must be. The **AI-excision**
edits do not follow that rule — they are deletions and dead-reference cleanups by design.

---

## Base

| | |
|---|---|
| Upstream | `microsoft/vscode` (MIT, code-oss) |
| **Base tag** | **`1.130.0`** |
| Base commit | `1b6a188127eeaf9194f945eb6eb89a657e93c54c` |
| Local branch | `vousoir-base` |
| Pinned Node (`.nvmrc` @ tag) | `24.18.0` |
| Electron target (`.npmrc` @ tag) | `42.6.0` |
| Base package manager | **npm** (`npm ci` / `npm run compile`) |

To enumerate core patches at any time:

```bash
git diff --name-status 1.130.0
```

---

## Layer 1 — Branding / config core patches (merge-relevant)

These are the small, curated set of edits that give code-oss the Vousoir identity. They are the
patches worth re-applying if the fork is ever rebased onto a newer upstream base. This set is
**intentionally kept small**; the ≤15 spirit still governs *this layer*. (The base-tag and build
facts below are unchanged by the excision.)

| # | File | Change | Why | Upstream merge risk |
|---|------|--------|-----|---------------------|
| 1 | `product.json` | Rebrand identity (`nameShort`/`nameLong`/`applicationName`/`dataFolderName`/`sharedDataFolderName` → Vousoir; win32 dir/reg/mutex/AppUserModelId/shell-name/tunnel-mutex names; **4 fresh win32 installer GUIDs** replacing Microsoft's; `darwinBundleIdentifier` → `com.vousoir.vousoir` + 2 fresh darwin profile UUIDs; `linuxIconName`, `urlProtocol`, server/tunnel app names → vousoir); added `extensionsGallery` pointed at Open VSX (`serviceUrl`/`itemUrl`/`resourceUrlTemplate`); repointed `licenseUrl`/`serverLicenseUrl`/`reportIssueUrl` at `github.com/vousoir/vousoir` (see BUILDING.md, which already assumes this remote); removed the Microsoft-backend `voiceWsUrl` (`falcon-caas.mai.microsoft.com`) | §4.2 identity rebrand, §4.3 Open VSX gallery, §4.4 remove MS-backend service. `product.json` is the sanctioned customization point (§4.2) — every value here is data, no source logic touched | Low. `product.json` is a leaf config file; upstream's own edits to it are almost always additive (new keys) or to fields we didn't touch. A merge conflict is easy to resolve by keeping our values for the identity/gallery/URL keys and taking upstream's for any new key it introduces. |
| 2 | `resources/win32/code.ico`, `code_150x150.png`, `code_70x70.png`; `resources/darwin/code.icns`; `resources/linux/code.png`; `resources/server/code-192.png`, `code-512.png`, `favicon.ico` (8 files) | Replaced Microsoft's app-identity artwork with a rasterization of the Vousoir wedge mark. Filenames and container formats/sizes are unchanged (`code.ico` still embeds {16,32,128,256}, `favicon.ico` still embeds {16,24,32,48,64}, PNG dimensions match originals exactly) — only pixel content changed, per `build/lib/electron.ts` and `build/gulpfile.vscode*.ts` hardcoding these paths. Source of truth for the geometry is the same `<path d="M9 2H15L18.5 22H5.5L9 2Z">` used by `extensions/vousoir-core/media/vousoir-icon.svg` (copied verbatim into a standalone rasterization wrapper, not redrawn — the original needs a `currentColor` CSS context that doesn't exist during headless rendering), rasterized with `pnpm dlx sharp-cli` (transient, not added to any package.json) and packed into each target container with Pillow | §4.2 "generate a simple wedge/keystone mark", §9.2 "no Microsoft branding in user-visible chrome" — taskbar/dock/window icon is chrome, and shipping Microsoft's logo under the Vousoir name is a trademark problem, not just cosmetic | Low. Upstream only touches these bytes when it redesigns its own icon, which is infrequent; conflict resolution is "keep ours" every time. |
| 3 | `resources/win32/VisualElementsManifest.xml`; `resources/linux/code.appdata.xml` | Fixed hardcoded (non-templated) brand-name strings: `ShortDisplayName="Code - OSS"` → `"Vousoir"` (Windows Start tile text); `<summary>`/`<description>` "Visual Studio Code" → "Vousoir" (Linux software-center metadata). Left the `homepage`/screenshot/doc-setup URLs on `code.visualstudio.com` untouched — no live Vousoir equivalent exists yet and fabricating one would be worse than leaving Microsoft's; flagged for a later work order. `resources/linux/code.desktop`'s `Comment=Code Editing. Redefined.` tagline and all `@@NAME_LONG@@`/`@@NAME@@`/`@@EXEC@@`/`@@ICON@@` placeholders were left alone — the placeholders are already build-time-substituted from `product.json` (now Vousoir), and the tagline is marketing copy, not a name string | §9.2 no Microsoft branding in user-visible chrome — these are literal, non-templated occurrences the build does not substitute | Low. Small, isolated string literals; upstream rewording these is rare and a conflict is a one-line fix. |
| 4 | `README.md` | Replaced code-oss's README wholesale with Vousoir's: what the product is, the one-command `setup.ps1` quick start, prerequisites (including the Node **LTS**-package trap and the Spectre component), repo layout, the two-toolchain split, architecture (spawned services, `ELECTRON_RUN_AS_NODE`, single-source wire protocol, the two enforcement walls, `.v6r/`), `build.ps1`, patch discipline, a troubleshooting table, and a non-affiliation notice | The repo is now published at `Firelight-Innovations/Vousoir`; its landing page described Microsoft's product, linked Microsoft's issue tracker, and told contributors to file bugs against `microsoft/vscode`. A fork's README is user-visible chrome in the §9.2 sense and cannot advertise the upstream product | **High — but harmless.** Upstream edits its README regularly, so this file will conflict on most merges. Resolution is always "keep ours"; there is never a reason to take upstream's README into this fork. Consider `merge=ours` in `.gitattributes` if merges become frequent. |
| 5 | `.eslint-allowed-javascript-files` | Appended 4 entries: `.dependency-cruiser.cjs`, `vousoir/eslint.config.mjs`, `vousoir/boundary-tests/fixtures/deep-import-into-shared.fixture.mjs`, and (M2) `extensions/vousoir-core/media/canvas.js` (kept sorted, as upstream maintains it). The fourth is the canvas webview script: it is loaded by URL through `asWebviewUri` under a nonce CSP (ADR-004), which is exactly how upstream's own `extensions/media-preview/media/{audio,image,video}Preview.js` ship — plain JS under `media/`, not bundled TypeScript. The TypeScript alternative was considered and rejected: it would need DOM lib types that `extensions/vousoir-core/tsconfig.json` deliberately does not include (`"types": ["node"]`), a second browser-target esbuild entry, and the built asset moved out of `media/`, all to restate a convention upstream already follows for this exact file class | Upstream's husky `precommit` hook rejects new `.js`/`.cjs`/`.mjs` files and **names this allowlist as the sanctioned escape hatch** for files that genuinely must be JavaScript. All three qualify: dependency-cruiser's config format is `.cjs`; ESLint 9 flat config must be `.js`/`.mjs`/`.cjs`; and the deep-import fixture must be `.mjs` to exercise Node's real ESM `exports` resolution, which is the exact behaviour §9.9 requires it to prove. Taking the hook's prescribed route rather than `--no-verify` — bypassing a hook to land code it was written to catch is precisely the habit this project's enforcement exists to prevent | Low. Append-only to a sorted manifest; upstream's own edits are appends elsewhere in the file. Conflicts resolve by keeping both sides. |
| 6 | `build/hygiene.ts` | Replaced the blanket *"product.json: Contains 'extensionsGallery'"* error with a check that the gallery **is** Open VSX. Upstream forbids any gallery because the Microsoft Marketplace is not licensed for the OSS build; §4.3 *requires* Vousoir to ship one. Rather than delete the guard, it now fails if `extensionsGallery.serviceUrl` is anything other than `https://open-vsx.org/…` — so an accidental repoint at the Microsoft Marketplace still breaks hygiene, which is the risk the original check existed to prevent | The upstream rule and this fork's requirements are in direct conflict; hygiene fails on every commit otherwise. Inverting the check preserves its intent instead of discarding it | Medium. Small, self-contained block. If upstream rewrites this function the conflict is obvious and the resolution is to re-apply the inverted check. |
| 7 | `build/filters.ts` | Added `!extensions/vousoir-*/**`, `!typings/vousoir/**`, `!vousoir/**` to `copyrightFilter` | Hygiene requires the *Microsoft* copyright header on every source file. Asserting Microsoft's copyright over code they did not write is false attribution, so first-party Vousoir code is exempt. The **unicode and indentation** filters were deliberately *not* touched — those are reasonable conventions, and our files were fixed to comply instead | Low. Three appended lines in a long exclusion list; conflicts resolve by keeping both sides. |
| 8 | `eslint.config.js` | Appended a flat-config override setting `header/header: 'off'` for `extensions/vousoir-*/**`, `typings/vousoir/**`, `vousoir/**` | Same reason as #7 — the ESLint half of the same rule. Implemented as a trailing override rather than editing upstream's rule body: flat config is last-match-wins, so `src/` and every upstream extension still require the Microsoft header | Low. Purely additive block at the end of the array; nothing upstream is modified. |

## Layer 2 — Total AI / Microsoft-service excision (the hard divergence)

This is the bulk of the divergence and the reason the ≤15 budget no longer applies. It is a
*category* of change, not an enumerable patch list — the authoritative, file-by-file record lives
in [`DEAI-PROGRESS.md`](./DEAI-PROGRESS.md). Summary of what was **physically deleted** and what
core files were **modified** to remove the resulting dead references:

**Deleted extensions:** `copilot`, `github`, `github-authentication`, `microsoft-authentication`.

**Deleted `src/` surface** (~7,900 files): the agents window (`src/vs/sessions/`), all chat
(`contrib/chat`, `inlineChat`, `inlineCompletions`), agent runtime (`platform/agentHost`,
`services/agentHost`), MCP (`platform/mcp`, `contrib/mcp`, `services/mcp`), speech/voice, language
models, AI search (`aiRelatedInformation`, `aiSettingsSearch`, `aiEmbeddingVector`), default-account
+ Copilot enterprise managed-settings policy, `platform/browserView` + browser-tunnel-proxy,
`platform/sandbox`, `platform/otel` (GenAI spans), and ~90 `vscode.proposed.{chat,languageModel,
mcp,speech,ai,agent,browser,tool}*.d.ts`.

**Modified core files (~180)** to excise dead references — concentrated in `workbench/contrib/*`
(67), `workbench/api/*` (18), `build/azure-pipelines/*` (17), `workbench/services/*` (9), plus the
process entrypoints, policy/config, userDataSync (MCP made non-syncable), and the build pipeline.
One public-API reduction: **`src/vscode-dts/vscode.d.ts`** dropped `ExtensionContext.languageModel\
AccessInformation`.

**Config/CI:** `product.json` (removed `defaultChatAgent`, trusted-auth, sessions-window,
agents-telemetry keys), `package.json` + `remote/package.json` (copilot/mxc deps), the whole Azure
Copilot release-pipeline + SDK-canary subsystem, eslint agentHost/copilot rules, `.moduleignore`,
smoke-test agents-window area.

**Verification gate:** `npm run typecheck-client` was **exit 0 on a clean baseline** before any
deletion and is **exit 0 again** after the excision (peak 712 → 0). The count was the progress
metric throughout.

**Known deferred residue** (compiles, dead, AI-flavoured — listed in DEAI-PROGRESS.md): the
`ISearchService`/`ISearchResultProvider` AI-search *type* surface; leftover policy/account type
members; `_chatExtensionId`; `agentSessionsWorkspace`; the generated `build/lib/policies/policyData\
.jsonc` (regenerate via `npm run export-policy-data`, do not hand-edit). Three orphaned directories
(`platform/otel`, `contrib/welcomeOnboarding`, and empties) await physical deletion — blocked for
the agent by the permission classifier, pending a manual `rm` or a permission grant.

---

Everything else added so far is **purely additive** — new files and directories that do not exist
upstream, so `git diff 1.130.0` is empty for them:

- `.dependency-cruiser.cjs` (new)
- `.github/workflows/vousoir-ci.yml` (new; upstream workflows untouched)
- `extensions/vousoir-core/` (new)
- `typings/` (new)
- `vousoir/` (new)

Additive files are *not* core patches — they cannot conflict on an upstream merge.

---

## Deviations from the work order

Recorded per the orchestration rule that deviations are surfaced with justification rather than
made silently. **D8 is a scope change** (user-directed); D1–D7 are structural decisions forced by
what the `1.130.0` base actually looks like and do not change scope (§10).

### D8 — Total AI excision; ≤15 core-patch budget (acceptance test #13) deliberately retired

**The work order** framed Vousoir as a thin branding fork holding under 15 core patches so it could
keep merging from upstream. **The user overrode that scope** in successive instructions — remove the
agents window, all GitHub sign-in, and Copilot; then *"delete it ALL, code and config"*; then *"we
want this very bare bones, we will rebrand this just like Cursor, they removed all of the microslop
specific stuff."* When offered three excision depths, the user chose the deepest ("cut everything AI
out of the tree") with the cost — *"CORE PATCH BUDGET: 8/15 → ~120/15"* — stated explicitly and
accepted.

**Result:** ~180 modified core files and ~7,900 deletions (see the header and Layer 2). Acceptance
test #13 ("core patches ≤ 15") is now **intentionally failing** and is retired, not deferred. The
branding layer (Layer 1) still honours the ≤15 spirit; the AI-excision layer (Layer 2) is a hard
divergence by design. This is the one deviation that changes scope, and it does so on direct,
repeated, explicit user instruction.

### D1 — `pnpm-workspace.yaml` lives at `vousoir/`, not the repo root

**Work order §5** shows `pnpm-workspace.yaml` at the repo root, on the stated assumption that
"code-oss internally uses npm" and the root is therefore free.

**What the base actually is:** at `1.130.0` the repo root is itself a package (`code-oss-dev`,
105 devDependencies) shipping **both** a `package-lock.json` and a `pnpm-lock.yaml`. Verified
empirically: with a `pnpm-workspace.yaml` at the root, `pnpm` reports `code-oss-dev@1.130.0` as
a workspace project. A `pnpm install` would then adopt code-oss's root package and write to the
same root `node_modules` that code-oss's own `npm ci` owns — two package managers fighting over
one directory.

**Resolution:** root the Vousoir workspace one level down, at `vousoir/`. It gets an isolated
`vousoir/node_modules`; code-oss's toolchain is untouched (§4.5, §7.4). The `../` globs still
reach the spec-mandated repo-root `typings/` folder and the `extensions/vousoir-*` built-in
extensions, so the **layout in §5 is otherwise preserved exactly** — `typings/` and
`.dependency-cruiser.cjs` remain at the repo root as specified. Verified: `pnpm -r list` from
`vousoir/` shows the four Vousoir packages and excludes `code-oss-dev`.

### D2 — Vousoir contributor guide at `vousoir/CONTRIBUTING.md`

§5 lists `CONTRIBUTING.md` at the repo root, but code-oss ships its own root `CONTRIBUTING.md`.
Overwriting it would be a core patch with a guaranteed upstream merge conflict, to no benefit.
Vousoir's guide (including the §7.2 one-primary-export-per-file rule) lives at
`vousoir/CONTRIBUTING.md` instead. Core patch avoided.

### D3 — `vousoir-core` takes vscode types from `src/vscode-dts/`, not `@types/vscode`

`@types/vscode` is **not published past `1.125.0`**, so a `^1.130.0` dependency is unsatisfiable
and aborts `pnpm install`. Every code-oss built-in extension already solves this by `include`-ing
`../../src/vscode-dts/vscode.d.ts` in its tsconfig (see `extensions/git/tsconfig.json`);
`vousoir-core` follows that convention. This is an ambient **type** reference, not a runtime
import of core, so it does not breach §7.1.

### D4 — `no-unresolvable` boundary rule added beyond the §7.1 minimum

§7.1 lists a minimum rule set. Phase 1 negative-testing found that an import which fails to
resolve is silently ignored by every other rule — a real boundary violation can hide behind a
bad path and never be evaluated. `no-unresolvable` (severity `error`) closes that hole.

### D5 — `types: []` default in `vousoir/tsconfig.base.json`

TypeScript walks `node_modules/@types` up the entire filesystem. On the build machine this
absorbed a stray `C:/Users/<user>/node_modules/@types` (electron, fs-extra, …) and failed the
typecheck with errors from files no Vousoir package references. The base config now defaults to
no ambient types; packages opt in explicitly (`"types": ["node"]`).

### D6 — `--passWithNoTests` on package `test` scripts

The Phase 1 skeleton has no test files yet, and `vitest run` exits non-zero on "no test files
found", which would make the scaffold red before any code exists. Work-package D replaces the
placeholders with real tests; the flag is harmless once tests exist (it only affects the empty
case) and should stay so a new package is never born failing.

### D7 — spec-frontmatter golden fixtures are JSON, not `.md` with YAML frontmatter

*(Work-package D.)* §9.11 requires the spec-frontmatter schema to validate golden sample files.
Reading a literal `.md` frontmatter block needs a YAML parser, and no YAML library is a declared
dependency of any Vousoir package — adding one was barred to protect the shared pnpm lockfile
while three work-packages ran concurrently. Markdown/spec-tree handling is also out of scope
(§10 defines shapes only).

The schema validates the *parsed frontmatter object*, so a JSON fixture exercises it exactly as a
parsed `.md` would; the source format is irrelevant to what is being tested. Positive and negative
fixtures are checked in for both the trace-event and spec-frontmatter schemas. When a real spec
reader lands in a later work order, it will bring its own YAML dependency and can re-point these
fixtures at `.md` files.

---

## Phase 1 corrections

Fixes to the Phase 1 tooling itself, made after it met real code. Not deviations — defects.

### C1 — `kebab-filename` rejected conventional dotted filenames

The original rule stripped a single extension and then forbade any remaining dot, so
`v6r-init.test.ts` and `vitest.config.mjs` were flagged — and because `lint:strict` runs
`--max-warnings=0`, that was a hard CI failure. Work-package D hit this immediately and worked
around it with `-test.ts` filenames plus a custom vitest `include`, which would have made a
non-standard test convention project-wide by accident.

The rule now requires **every dot-separated segment** to be kebab-case, which is the actual §7.2
requirement. It still rejects camelCase and snake_case stems, but accepts the ecosystem's
conventional secondary extensions. The workaround was reverted: tests are named `*.test.ts` and
the custom vitest config was deleted (vitest's default include covers them).

### C2 — `no-unresolvable` rejected the `vscode` module

The `vscode` module is injected by the extension host at runtime and has no on-disk existence, so
it can never resolve through node resolution — exactly like a Node builtin. As originally written,
`no-unresolvable` therefore rejected *every* VS Code extension that imports the API it is built
against. Surfaced the moment work-package B wrote its first `import … from 'vscode'`. The rule now
carves out `^vscode$` and nothing else.

---

## Architectural decisions

### A1 — service-host is a spawned PROCESS; the extension never imports it

**The conflict.** Work-package B escalated a genuine collision between two work-order clauses:
§6.1 makes `vousoir-core` own "lifecycle of the service host … spawn on activation, health-check,
dispose on shutdown", while §7.1 permits `extensions/vousoir-*` to import "`@vousoir/typings` and
`@vousoir/shared` — nothing else from the `vousoir/` tree". Work-package C had built `service-host`
as a *library* whose `serviceHostLauncher.start()` the extension would call in-process — which is
precisely the import §7.1 forbids. Two proposals were on the table: loosen the boundary rule, or
invent a DI seam.

**Ruling: neither. Keep the wall; the design was wrong.** The work order's own text resolves it:

- §6.2 — service-host is "a small supervisor **process** (plain Node, TypeScript)".
- Technical spec §2.3 — services are "local, long-lived Node **processes** … **Spawned and
  supervised by a built-in extension**".
- §9.8 — "service-host spawns, dummy service registers … on app exit **both** terminate cleanly":
  two processes, not one.

So §6.1 and §7.1 were never in tension. "Owning the lifecycle" means spawning, health-checking, and
disposing a **child process**, not calling a library. The extension spawns service-host and speaks a
minimal newline-delimited JSON stdio protocol to it; it imports only types from `@vousoir/typings`.

Loosening `ext-imports-only-typings-and-shared` was rejected: §7 calls mechanical boundary
enforcement "a core deliverable of this work order, not a nicety", and routing around a boundary is
the exact antipattern [`CONTRIBUTING.md`](./CONTRIBUTING.md) forbids — *"Need behaviour from another
service? That is an MCP/IPC surface, not an import."*

### A2 — `ELECTRON_RUN_AS_NODE=1` is mandatory when spawning services

Found while reviewing A1. `service-supervisor.ts` spawned `process.execPath`, which inside the VS
Code extension host is the **Electron binary**, not node — in the real app that launches an entire
Electron instance instead of the service. The unit tests missed it because vitest runs under plain
Node, where `process.execPath` *is* node.

Every spawn in the chain must set `ELECTRON_RUN_AS_NODE: '1'`. It is inherited through the env, so
setting it when the extension spawns service-host also covers service-host spawning its children;
it is harmless under plain Node.

**Open risk (tracked, not yet resolved):** services are spawned as raw `.ts` entries relying on
Node 24's native type stripping. Electron 42.6.0's bundled Node may differ, and stripping supports
only *erasable* syntax (no enums, namespaces, or parameter properties). Fallback if it fails is to
esbuild the service entries to `.js` — the same tool the extension already uses. To be settled once
the base build runs.

### A3 — the service-host stdio protocol is canonical in `@vousoir/typings`

Work-packages B and C independently produced two incompatible wire formats for the same pipe
(`op` vs `type` discriminant; implicit pipe-buffered readiness vs an explicit one-shot `ready`;
folded vs standalone error responses). C's version also re-exported `ServiceHostRequest` /
`ServiceHostResponse` — the *same type names* `@vousoir/typings` exports, with different shapes.

Resolved in favour of `typings/vousoir/src/service-host-protocol.ts`, on two grounds: §7.3 forbids
a package redeclaring a shared cross-package shape locally, and the explicit `ready` handshake lets
the extension bound startup with `startupTimeoutMs` and distinguish a slow start from a dead one —
where the alternative depended on the OS pipe buffering an early request.

**Worth noting for the enforcement story:** dependency-cruiser could not catch this. It tracks
*imports*, not *duplicated declarations* — both packages imported legally. §7.3's "no package
redeclares a shared shape locally" is a review rule, not a mechanical one. The two walls are not
total, and this is the seam they don't cover.

---

## Known limitations (deferred to a future work order)

### L1 — packaged builds cannot locate the service-host entry

`vousoir-core` resolves the service-host entry from `vscode.env.appRoot` as
`vousoir/services/service-host/src/main.ts`. Correct in a dev build, where the running app *is* the
repo. A packaged build would need `build/gulpfile.vscode.*` taught to ship `vousoir/` into the
packaged app tree — a code-oss **core patch**.

Deliberately not spent. §10 excludes "signed installers (unsigned dev build is fine for v1)", and
every §9 acceptance test runs from source via `scripts/code.bat`, so packaging is exercised by none
of them. The patch would buy nothing this work order while adding a permanent upstream merge
conflict.

Mitigation: the extension logs a clear diagnostic naming the resolved path and stating that
packaged builds are unsupported, then degrades gracefully — the failure is loud, not silent.

---

## Enforcement proven in Phase 1

The compartmentalization walls were negative-tested before any feature code was written — a
wall that has never fired is not a wall.

| Wall | Deliberate violation | Caught by |
|---|---|---|
| Cross-service import | `dummy-service` → `service-host` | `no-cross-service-imports` (error) |
| Unresolvable import | broken relative path | `no-unresolvable` (error) |
| Extension boundary | `vousoir-core` → `service-host` | `ext-imports-only-typings-and-shared` (error) |
| File length | 501-line file | `max-lines` error @500 **+** soft warn @300 |
| `exports` seal | `@vousoir/shared/src/index.ts` | Node `ERR_PACKAGE_PATH_NOT_EXPORTED` |

The bare specifiers `@vousoir/shared` and `@vousoir/typings` still resolve normally, confirming
the seal blocks deep imports without breaking the public surface.
