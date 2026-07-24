# Vousoir (v6r) — Architecture Map

## 1. Purpose, and how to use this document

Vousoir is a spatial canvas on which an engineer diagrams an application as **nested modules**. Each
node carries plain-language behaviour, typed **boundary contracts**, and exact test cases — and never
internal implementation. The name is a respelling of *voussoir*, the wedge stone in an arch, defined
entirely by its precisely-cut edges: **edges, not substance**. Nodes compile into self-contained
markdown work orders handed to AI coding agents, and generated code traces back to its spec node.

**Read order for a milestone agent:** this file → [`ADR.md`](./ADR.md) → your milestone's row in §6.

This file is the **how and where**. `ADR.md` is the **why** — it holds eight accepted decisions with
verified evidence. Nothing here restates an ADR's reasoning; where a rule has a rationale, it links
(`See ADR-003`). If this file and `ADR.md` disagree, `ADR.md` wins and this file is the bug.

Every `path:line` here was opened and confirmed. Line numbers drift; the surrounding quote is the
durable part.

> **Path convention.** The git repo root is `…/Projects/vousoir/vousoir` — a doubled directory name —
> and the Vousoir layer lives in a `vousoir/` subdirectory of it. So `vousoir/PATCHES.md` is
> `…/vousoir/vousoir/vousoir/PATCHES.md`: **three** `vousoir` segments. An agent that resolved it
> with two reported the file as nonexistent. Use absolute paths before ever writing "does not exist".

---

## 2. The fork

code-oss **1.130.0** (base commit `1b6a188127eeaf9194f945eb6eb89a657e93c54c`), **hard forked**, not a
patch layer. `vousoir/PATCHES.md:12` records the divergence: *"~8,150 files changed — ~7,900
deletions, ~180 core-file modifications, ~70 additions."* The old ≤15-core-patch budget is
**retired** (`PATCHES.md:14`), deliberately. A blanket `git merge` from upstream is no longer viable;
upstream tracking is a curated cherry-pick activity.

### Blacklist — never import, never resurrect

These were physically deleted. If you find a reference, it is dead code to remove, not a dependency
to restore. Full inventory in `vousoir/DEAI-PROGRESS.md`; summary at `vousoir/PATCHES.md:76-95`.

| Deleted | Paths |
|---|---|
| Chat & inline AI | `src/vs/workbench/contrib/chat`, `contrib/inlineChat`, `contrib/inlineCompletions` |
| Agent sessions | `src/vs/sessions/`, `platform/agentHost`, `services/agentHost` |
| MCP (upstream's own) | `platform/mcp`, `contrib/mcp`, `services/mcp` |
| Speech / language models | speech, voice, language models, `contrib/*speech*` |
| AI search | `aiRelatedInformation`, `aiSettingsSearch`, `aiEmbeddingVector` |
| Extensions | `copilot`, `github`, `github-authentication`, `microsoft-authentication` |
| Proposed APIs | ~90 `vscode.proposed.{chat,languageModel,mcp,speech,ai,agent,browser,tool}*.d.ts` |

Verified absent: `src/vs/workbench/contrib/{chat,inlineChat,inlineCompletions,mcp,speech}`,
`src/vs/sessions`, `src/vs/platform/agentHost` — all `Test-Path` → `False`. 85 workbench contribs
survive (git, debug, search, terminal, notebook, scm, …); treat those as normal upstream code.

**Vousoir's own MCP work (M6) is unrelated to the deleted upstream `platform/mcp`.** It is a
standalone server process, not a workbench service. See ADR-006.

### House conventions

| Rule | Detail |
|---|---|
| Namespace | `vousoir.*` for every command, setting, view and viewType. Today: viewsContainer `vousoir`, view `vousoir.panel`. **No commands are contributed yet** — M2 adds the first. |
| Module system | **ESM.** `extensions/vousoir-core/package.json` has `"type": "module"`; `esbuild.mts` sets `format: 'esm'`, `external: ['vscode']`. No `require()`, no `__dirname`. See ADR-001. |
| Indentation | Tabs. |
| Copyright header | Required on core files; **exempt** for `extensions/vousoir-*`, `typings/vousoir/**`, `vousoir/**` (`PATCHES.md` Layer 1 rows #7, #8 — `build/filters.ts` + `eslint.config.js`). Do not add Microsoft's header to Vousoir-layer files. |
| Naming | camelCase code, **kebab-case filenames** (every dot-segment kebab), SCREAMING_SNAKE constants, PascalCase types. |
| File length | 300 lines = warning, 500 = error. `lint:strict` runs `--max-warnings=0`, so **300 is the real budget** (`vousoir/CONTRIBUTING.md:35-41`). |
| One thing per file | Exactly one primary export (`vousoir/CONTRIBUTING.md:24-32`). |
| Types | Strict TS, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any` outside a `boundaries/` folder. |
| Commits | Imperative, lowercase `v6r:` / `docs:` prefix. History uses `Co-Authored-By:` trailers — keep them. |

### The boundary wall — the rule that shapes everything

Four dependency-cruiser rules, `severity: error`, enforced in CI (`.dependency-cruiser.cjs`):

- `core-not-import-vousoir` — `src/` may not import `vousoir/` or `typings/`. **This is why the canvas is an extension** (ADR-001).
- `vousoir-layer-not-import-core` — the Vousoir layer may not import `src/`. Bridge via the public `vscode` API only.
- `ext-imports-only-typings-and-shared` — `extensions/vousoir-*` may import `@vousoir/typings` and `@vousoir/shared`, nothing else from the tree.
- `no-cross-service-imports` — services talk over MCP/IPC, never imports.

Plus `typings-only-imports-zod`, `no-circular`, `no-orphans`, `no-unresolvable`.

**Hitting a boundary error is a design signal, not an obstacle.** `vousoir/CONTRIBUTING.md:86-93`:
*"Do **not** route around it… Need a shape from another package? Move it to `@vousoir/typings`."*

---

## 3. Build and run

All commands measured in this worktree. **Match the command to the change** — running the wrong one
wastes minutes or reports a failure you did not cause.

| You changed | Run | Measured |
|---|---|---|
| `extensions/vousoir-core/**` — **the M2/M3/M5 inner loop** | `cd extensions/vousoir-core; node --experimental-strip-types ./esbuild.mts` | exit 0, **0.28 s** |
| Anything in the Vousoir layer — **the gate before every commit** | `cd vousoir; pnpm run verify` | exit 0, **22 tests** (shared 6, service-host 10, boundary-tests 6) |
| `src/` (core) | `npm run typecheck-client` | exit 0, **6.48 s** |
| All built-in extensions | `npm run gulp compile-extensions` | **BROKEN — see below** |
| Run the app | `scripts/code.bat` | Windows |

`pnpm run verify` = `lint:strict && dep-check && typecheck && test` (`vousoir/package.json:21`). It is
exactly what CI runs (`.github/workflows/vousoir-ci.yml`). **Never commit Vousoir-layer changes
without it passing.**

`.claude/CLAUDE.md:56` says *"NEVER use `npm run compile`"* — that is inherited upstream guidance
(the file is a symlink to `.github/copilot-instructions.md`) and it governs the dev loop. CI does run
`npm run compile` in its cross-platform build job; that is not a contradiction to fix.

### `compile-extensions` is broken here, and the junctions are why

`error TS2688: Cannot find type definition file for 'node'` in `extensions/grunt` and
`extensions/notebook-renderers`. **This is not a pre-existing upstream defect and not a regression you
caused.** Traced: both tsconfigs pin `"typeRoots": ["./node_modules/@types"]` (their *own*
node_modules); those directories exist in the main worktree and **not** here, because the root
`"postinstall": "node build/npm/postinstall.ts"` (`package.json:22`) never ran in this worktree — its
root `node_modules` was junctioned in instead, and a junction shares only that one directory.

**Fix:** run a real `npm ci` here. **Not** by adding `@types/node` to two upstream tsconfigs — that
spends two core patches papering over a local environment gap. `vousoir-core` is unaffected because
it builds through its own `esbuild.mts`, which is why the 0.28 s loop works.

### Worktree and junctions (ADR-007)

```
…/Projects/vousoir/vousoir       phase-2-links   ← user's work. READ-ONLY.
…/Projects/vousoir/vousoir-v6r   v6r/mvp         ← all v6r work happens here
```

`node_modules` and `build/node_modules` are **Windows directory junctions** to the main worktree.
`out/` is a **real directory**, deliberately — a shared `out/` would silently overwrite the user's
build output.

```powershell
# create
git -C .../vousoir worktree add ../vousoir-v6r -b v6r/mvp
cmd /c mklink /J "...\vousoir-v6r\node_modules"       "...\vousoir\node_modules"
cmd /c mklink /J "...\vousoir-v6r\build\node_modules" "...\vousoir\build\node_modules"

# undo — rmdir the LINK; never delete through a junction, it deletes the target's contents
cmd /c rmdir "...\vousoir-v6r\node_modules"
cmd /c rmdir "...\vousoir-v6r\build\node_modules"
git -C .../vousoir worktree remove ../vousoir-v6r
```

**The two worktrees share one `node_modules`.** Any `package.json` / lockfile change is a
stop-the-world event: coordinate, reinstall once, re-verify both branches.

### Launching the app

Use **`scripts/code.bat`** on Windows. `vousoir/PATCHES.md:318` confirms *"every §9 acceptance test
runs from source via `scripts/code.bat`"*.

The `launch` skill at `.agents/skills/launch/` (tracked; `.claude/skills` is a junction to it) gives
an isolated throwaway profile with unique CDP/inspector ports:

```bash
LAUNCH=.agents/skills/launch/scripts/launch.sh
"$LAUNCH"                          # default workbench; prints a JSON line with cdpPort, pid, logFile
"$LAUNCH" -- <workspace-path>      # forward args to code.sh
"$LAUNCH" --repo <vscode-repo-root>
```

**Caveats before you reach for it.** `SKILL.md:21` requires *"macOS or Linux… `rsync`, `curl`,
`nohup`"* — on Windows it needs Git Bash **plus rsync**, which is not in a default install. It is also
stale: it seeds an authenticated Copilot profile and exposes `--inspect-agenthost` for
`src/vs/platform/agentHost/`, which no longer exists. And `SKILL.md:22` warns *"do **not** symlink from
a sibling worktree; that breaks builds in subtle ways"* — which is exactly the `compile-extensions`
failure above.

---

## 4. Extension points map

Every signature below was read from the real `.d.ts`. Nothing here is invented.

| Hook | Location | Use |
|---|---|---|
| `registerCustomEditorProvider` | `src/vscode-dts/vscode.d.ts:11781` | Bind the canvas to `*.v6r` |
| `customEditors` contribution | `extensions/media-preview/package.json:46-56` | Manifest side of the same |
| `CustomEditorProvider<T>` | `vscode.d.ts:10560` | Editable custom editor |
| `CustomReadonlyEditorProvider<T>` | `vscode.d.ts:10509` | Base — `openCustomDocument` + `resolveCustomEditor` |
| `CustomTextEditorProvider` | `vscode.d.ts:10348` | Simpler alternative; backed by a `TextDocument` |
| `CustomDocument` | `vscode.d.ts:10377` | `{ readonly uri: Uri; dispose(): void }` |
| `onDidChangeCustomDocument` | `vscode.d.ts:10581` | Drives the dirty dot |
| `saveCustomDocument` | `vscode.d.ts:10598` | `(document: T, cancellation: CancellationToken) => Thenable<void>` |
| `WebviewPanel` | `vscode.d.ts:10076` | The panel handed to `resolveCustomEditor` |
| `Webview.asWebviewUri` | `vscode.d.ts:10029` | `(localResource: Uri) => Uri` |
| `Webview.cspSource` | `vscode.d.ts:10032-10037` | CSP origin for `img-src` / `style-src` |
| `WebviewOptions.localResourceRoots` | `vscode.d.ts:9922` | `readonly Uri[]` — must include `media/` |
| esbuild auto-discovery | `build/lib/extensions.ts:418`, `:69` | `glob.sync('extensions/*/package.json')`, then `fs.existsSync(esbuild.mts)` |
| Sealed barrel | `typings/vousoir/src/index.ts:9-11` | The only import surface for `@vousoir/typings` |
| Spawning | `extensions/vousoir-core/src/service-host/service-host-process.ts:40-48` | `child_process` + `ELECTRON_RUN_AS_NODE` |

### Registering the canvas editor (ADR-001)

`package.json` — add beside the existing `viewsContainers`/`views`:

```json
"contributes": {
  "customEditors": [{
    "viewType": "vousoir.canvas",
    "displayName": "Vousoir Canvas",
    "priority": "default",
    "selector": [{ "filenamePattern": "*.v6r" }]
  }]
}
```

Extension host — signatures verified at `vscode.d.ts:10527`, `:10546`, `:10581`, `:10598`:

```ts
class V6rCanvasProvider implements vscode.CustomEditorProvider<V6rDocument> {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<V6rDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChange.event;

  openCustomDocument(uri: vscode.Uri, _ctx: vscode.CustomDocumentOpenContext, _t: vscode.CancellationToken): Thenable<V6rDocument> { … }
  resolveCustomEditor(document: V6rDocument, panel: vscode.WebviewPanel, _t: vscode.CancellationToken): Thenable<void> | void { … }
  saveCustomDocument(document: V6rDocument, _c: vscode.CancellationToken): Thenable<void> { … }
  saveCustomDocumentAs(document: V6rDocument, destination: vscode.Uri, _c: vscode.CancellationToken): Thenable<void> { … }
  revertCustomDocument(document: V6rDocument, _c: vscode.CancellationToken): Thenable<void> { … }
  backupCustomDocument(document: V6rDocument, ctx: vscode.CustomDocumentBackupContext, _c: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> { … }
}

context.subscriptions.push(
  vscode.window.registerCustomEditorProvider('vousoir.canvas', new V6rCanvasProvider(context), {
    supportsMultipleEditorsPerDocument: false,
    webviewOptions: { retainContextWhenHidden: true },
  }),
);
```

`CustomDocument` needs only `{ readonly uri: Uri; dispose(): void }` (`:10377-10389`).
`onDidChangeCustomDocument` must fire `CustomDocumentEditEvent` **or** `CustomDocumentContentChangeEvent`,
never both (`:10579`).

### Webview assets + CSP (ADR-004)

Pattern from `extensions/media-preview/src/audioPreview.ts:109-111` and `:79`, and Vousoir's own
`extensions/vousoir-core/src/panel/webview-html.ts:11-16`:

```ts
panel.webview.options = {
  enableScripts: true,
  localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
};
const nonce = crypto.randomBytes(16).toString('base64');
const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'canvas.js'));
```

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none';
  img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'nonce-${nonce}';
  script-src 'nonce-${nonce}';">
<script src="${script}" nonce="${nonce}"></script>
```

No CDN, no `unsafe-inline`, no `unsafe-eval`. Fresh nonce per render — generate it inside the
HTML-builder function, not at module scope.

### Spawning a child process (ADR-005)

```ts
import { spawn } from 'node:child_process';
import { ELECTRON_RUN_AS_NODE_ENV_VAR, PARENT_PID_ENV_VAR } from '@vousoir/typings';

spawn('claude', ['-p', workOrder, '--permission-mode', 'acceptEdits'], {
  cwd: workspaceRoot,
  env: { ...process.env, [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1', [PARENT_PID_ENV_VAR]: String(process.pid) },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
```

**`ELECTRON_RUN_AS_NODE: '1'` is mandatory on every spawn** (`vousoir/PATCHES.md:271`). Under the
extension host `process.execPath` is the Electron binary. **A plain-Node unit test cannot catch its
absence** — vitest runs under node, where `process.execPath` *is* node (`PATCHES.md:276`). Assert the
env var is present in the options object, and verify once by hand in the real shell.

### The sealed barrel

`typings/vousoir/package.json` maps `exports["."]` to `./src/index.ts` and nothing else. A deep import
(`@vousoir/typings/src/spec-node-frontmatter.ts`) fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
**Anything you add to `typings/` must be re-exported from `src/index.ts` or the extension cannot see
it.** Same for `@vousoir/shared`, whose barrel currently exports only `v6rInit`.

`@vousoir/typings` compiles with `"types": []` — **no ambient Node or DOM types**. Keep it to
primitives, zod and its own siblings (`service-host-protocol.ts:16-17`). Node-touching code goes in a
package that opts into `"types": ["node"]`.

---

## 5. Model and file layout

### `.vousoir/` — driven by `V6R_SUBDIRS`, never hardcoded

`typings/vousoir/src/v6r-layout.ts` is the single source of truth; `vousoir/shared/src/v6r-init.ts:34`
scaffolds by iterating it. **Add a directory there, never at a call site.**

```
<repo>/.vousoir/
├── .gitignore     # contents: "cache/\n"
├── layout.json    # node positions — user-authored, NOT regenerable (ADR-003 amendment)
├── spec/          # COMMITTED — one .md per node, nested folders mirror the hierarchy
├── whiteboards/   # COMMITTED — reserved for Feature 11 (deferred)
├── traces/        # COMMITTED — one JSONL per agent run
├── docs/          # COMMITTED — Vousoir-maintained module docs
└── cache/         # GITIGNORED — SQLite index: derived, regenerable
```

`V6R_COMMITTED_SUBDIRS = ['spec','whiteboards','traces','docs']`; `V6R_GITIGNORED_SUBDIRS = ['cache']`.
The directory was renamed from `.v6r/` on 2026-07-24 (ADR-002 amendment); `V6R_ROOT_DIRNAME` keeps its
name and changes value.

- **Work orders** are compiled artefacts. Write them under `.vousoir/cache/work-orders/` (derived and
  regenerable from the spec) and let M4 render to a user-chosen path on explicit save.
- **Node positions** → `.vousoir/layout.json`, **not** `.vousoir/cache/`. Manual placement is supported,
  so positions are user-authored and a cache clear must not destroy them (ADR-003 amendment
  2026-07-24). They are **never** written to spec frontmatter — that rule is unchanged (ADR-002,
  ADR-008).
- `layout.json` is a file, not a `V6R_SUBDIRS` member, and `V6R_GITIGNORE_CONTENTS` is `cache/\n`, so
  **it is committed by default unless someone acts.** Gitignored vs committed is open — `ADR.md` open
  question 7.
- The `*.v6r` file the editor binds to is a **thin manifest** (project name, schema version, spec-dir
  pointer), not the model (ADR-002). It is **JSON** (`ADR.md` open question 2, resolved 2026-07-24),
  and the directory rename removed the bare-`.v6r` filename collision.

### Spec-node frontmatter

Shipped today in `typings/vousoir/src/spec-node-frontmatter.ts`:

```ts
specNodeStatusSchema = z.enum(['unspecified','specified','building','built','verified'])
specNodeTestCaseSchema = z.object({ id, description, expected })          // all z.string().min(1)
specNodeFrontmatterSchema = z.object({
  id, title,                       // z.string().min(1)
  parent: z.string().min(1).nullable(),   // null at the tree root
  status: specNodeStatusSchema,
  behaviour: z.string().optional(),       // British spelling — shipped, tested, do not "fix"
  contract: z.string().optional(),        // single free-form string
  testCases: z.array(specNodeTestCaseSchema).optional(),
})
```

**M1 extends this in place — it never forks it** (ADR-008):

- add `contracts: z.array(contractSchema).optional()` with `kind: z.enum(['moduleApi','serviceApi','dbSchema'])`;
- keep scalar `contract` accepted as deprecated back-compat (`contracts[]` wins when both present);
- add optional `given` / `when` / `then` / `snippet` to test cases, keeping `description` + `expected` required;
- **no `children`** (derived from `parent`), **no `position`** (derived, cached).

The markdown body below the frontmatter is free-form prose the schema does not constrain. Golden
fixtures live at `vousoir/shared/src/fixtures/spec-node-frontmatter.{valid,invalid}.json` and must
grow alongside the schema — including one asserting a legacy scalar-`contract` file still validates.

---

## 6. Milestone plan M1–M6 (adjusted by recon)

All paths relative to the repo root. Every milestone's gate is `cd vousoir; pnpm run verify` green.

### M1 — Model + spec store

**Creates:** extends `typings/vousoir/src/spec-node-frontmatter.ts` (contracts[], test-case fields);
new `typings/vousoir/src/v6r-manifest.ts`; re-exports in `typings/vousoir/src/index.ts`; reader/writer
in `vousoir/shared/src/spec-store/`; fixtures under `vousoir/shared/src/fixtures/`.
**Acceptance:** `pnpm run verify` green with new tests covering — round-trip a node to disk and back;
a legacy scalar-`contract` file still validates; a `parent` cycle is rejected; tree assembled from
`parent` pointers matches folder nesting.
**Risk:** the YAML dependency. No Vousoir package declares one (`PATCHES.md` D7); adding it touches
the shared `vousoir/pnpm-lock.yaml`. Do it in one deliberate commit.
**Changed by recon:** the brief specified `src/vs/workbench/contrib/vousoir/common/vousoirModel.ts`
and a `ModuleNode` type. Both dropped — the model lives in `@vousoir/typings` and extends the existing
schema (ADR-001, ADR-008). `position` and `children` dropped.

### M2 — Canvas custom editor + auto-layout

**Creates:** `extensions/vousoir-core/src/canvas/` (provider, document, message protocol),
`extensions/vousoir-core/src/canvas/layout.ts` (**pure function, no `vscode` import**),
`extensions/vousoir-core/media/canvas.{js,css}`, `customEditors` + first `vousoir.*` commands in
`package.json` (including the auto-tidy command), a second browser-target entry in `esbuild.mts`,
and a `.vousoir/layout.json` reader/writer.
**Acceptance:** open a `*.v6r` file → nested boxes render for the tree in `.vousoir/spec/`; add, delete and
re-nest a node → the file on disk updates; drag a node → its position persists to
`.vousoir/layout.json` and survives a `.vousoir/cache/` wipe; run auto-tidy → layout re-runs;
**no other action moves a node the user placed**; `layout.ts` has direct unit tests.
**Risk:** **layout thrash.** Route every mutation through one classifier returning
`structural | content`; only `structural` triggers layout. Get this wrong and M3 typing re-lays the
canvas on every keystroke.
**Changed by recon:** hand-rolled recursive layout, no ELK/dagre, no React Flow (ADR-003) — this
overrules the Stage 3 tech-stack selection. Approved by the user on 2026-07-24 **with a revisit
trigger**: reconsider a routing library only once the canvas renders contract edges *and* hand-rolled
routing is ugly.
**Changed by the 2026-07-24 ruling:** manual placement is supported and auto-layout is an explicit
auto-tidy command that **must never silently override a user's placement**. This **supersedes**
`vousoir-source-of-truth.md:86` (Feature 3), which says auto-layout *"has to work invisibly, not be a
separate 'clean up' action"*. **Do not implement Feature 3 as written** — see the ADR-003 amendment.

### M3 — Per-node spec panel

**Creates:** `extensions/vousoir-core/src/canvas/spec-panel/`, frontmatter read/write wired to the M1
store.
**Acceptance:** select a node → panel shows Behaviour / Contracts / Test Cases; edit and save → the
node's `.md` changes on disk and only that file; edit the file externally → the canvas reflects it.
**Risk:** the structural/content split from M2. Also the file watcher — external edits are a stated
product requirement (`vousoir-technical-spec.md:91`), not a nice-to-have.
**Changed by recon:** contracts render as a typed list (`moduleApi | serviceApi | dbSchema`) rather
than one text box, per ADR-008.

### M4 — Work-order compiler

**Creates:** `vousoir/shared/src/work-order/compile.ts` + template.
**Acceptance:** a fully-specified node compiles to self-contained markdown; the compiler is a pure
function with unit tests; output is reviewable before dispatch.
**Risk:** scope. `ADR.md` open question 1 proposes: node's own full spec + **contracts only** of the
ancestor chain + **contracts only** of directly-contracted siblings. Confirm with the user before
building — this most affects whether generated code is correct.

### M5 — Dispatch to Claude Code

**Creates:** `extensions/vousoir-core/src/dispatch/` (spawn, stream, status).
**Acceptance:** dispatch a compiled work order → node status moves `specified → building →
built|failed`; stdout/stderr stream to the "Vousoir" output channel; `claude` absent from PATH fails
loudly and leaves status unchanged.
**Risk:** **`ELECTRON_RUN_AS_NODE`** — no plain-Node test catches its absence. Second: `--permission-mode
acceptEdits` writes to the user's workspace (per-run worktree isolation is post-M6). Warn in the UI
before the first dispatch.
**Changed by recon:** no IPC service and no shared-process work — the extension host is already Node
(ADR-005). Removes an entire subsystem from the original design.

### M6 — MCP server

**Creates:** `vousoir/services/spec-mcp/` — its own package (sealed `exports`, `main.ts`,
`parent-watchdog.ts`), schemas in `typings/vousoir/src/mcp-*.ts` re-exported from the barrel.
**Acceptance:** `claude mcp add` registers it; an external `claude` lists modules and edits a spec
with Vousoir **closed**; nine tools round-trip against a real `.vousoir/spec/`.
**Tool surface:** read — `list_modules`, `get_module`, `get_contracts`, `get_neighbor_context`,
`get_work_order`; write — `create_module`, `update_module`, `update_contract`, `add_test_case`.
**Risk:** two writers to `.vousoir/spec/` (canvas + MCP). Last-write-wins per file is acceptable at this
scale; do not build a lock. Also `types: []` — MCP payload schemas in `typings/` must stay primitives
+ zod, and the SDK can never be imported there (`typings-only-imports-zod`).
**Changed by recon:** stands alone; does **not** extend the service-host protocol, which says of
itself *"This is NOT MCP"* (ADR-006). Three drafted tool lists merged into one surface of nine.

---

## 7. Debt log

| # | Debt | Impact | Resolution |
|---|---|---|---|
| D1 | **Junctioned `node_modules`** across worktrees (ADR-007) | Already caused D2. The `launch` skill explicitly warns against it. Version drift between branches is silent. | `npm ci` in `vousoir-v6r`, or collapse to one worktree when `phase-2-links` lands. |
| D2 | **`compile-extensions` fails** — TS2688 in `grunt`, `notebook-renderers` | Cannot use it as a green-build gate. Do **not** mistake it for a regression. | `npm ci` here (runs the root postinstall). Not tsconfig patches. |
| D3 | **Packaged builds cannot find service-host** (`PATCHES.md` L1) | Dev builds only. Extension logs a clear diagnostic and degrades gracefully. | Deferred — needs a `build/gulpfile.vscode.*` core patch. |
| D4 | **Services spawned as raw `.ts`** relying on Node 24 type stripping (`PATCHES.md` A2, open risk) | Electron 42.6.0's bundled Node may differ; stripping only supports erasable syntax. | Fallback: esbuild service entries to `.js`. |
| D5 | **No YAML dependency** anywhere in the Vousoir layer (`PATCHES.md` D7) | M1/M3/M6 all need one; fixtures are JSON as a workaround. | M1 adds it and re-points the fixtures at real `.md`. |
| D6 | **`launch` skill is stale and Windows-hostile** | Cannot be used here. References deleted `agentHost`. | Use `scripts/code.bat`. Rewrite the skill or delete it. |
| D7 | `CONTRIBUTING.md:116` still states the retired ≤15-patch budget | Contradicts `PATCHES.md:14`. Misleads readers. | One-line fix. |
| D8 | Deferred residue from the AI excision (`PATCHES.md:101-106`) | Dead but compiling: AI-search type surface, `_chatExtensionId`, three orphaned dirs. | Tracked in `DEAI-PROGRESS.md`. |

---

## 8. Risks, ranked

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Layout thrash in M2/M3** — spec-text edits re-run layout on every keystroke | Single mutation classifier; only `structural` reaches layout. Keep `layout.ts` a pure function with direct tests. Highest-probability failure in the plan. |
| R2 | **Missing `ELECTRON_RUN_AS_NODE` in M5** — silently launches an Electron instance; no plain-Node test can catch it | Assert the env var in the spawn options in a unit test **and** verify once by hand in the real shell (`PATCHES.md:276`). |
| R3 | **ADR-003 overrules a made Stage 3 decision** (React Flow + ELK) | **Approved 2026-07-24 with a revisit trigger**: contract links create cross-edges the strict-tree argument does not cover, so reconsider a routing library once the canvas renders contract edges *and* hand-rolled routing is ugly — not before. Still reversible behind the same pure-function signature. |
| R9 | **Feature 3 is stale and says the opposite of ADR-003** — it forbids a manual "clean up" action (`vousoir-source-of-truth.md:86`); the 2026-07-24 ruling requires exactly that | Follow the ADR-003 amendment, not Feature 3. `vousoir-source-of-truth.md` needs its author's edit; until then the two documents disagree and the ADR is operative. |
| R4 | **Work-order scope is unresolved** and gates M4's correctness | `ADR.md` open question 1 has a proposed resolution. Get the user's call before building M4. |
| R5 | **`*.v6r` filename collides with the `.vousoir/` directory** | Decide the `filenamePattern` in M2, **before** any user repo contains a `.v6r` file. `ADR.md` open question 3. |
| R6 | **Worktree dependency drift** — two branches, one `node_modules` | Any lockfile change is stop-the-world. Re-verify both branches. |
| R7 | **Two writers to `.vousoir/spec/`** in M6 (canvas + MCP) | Plain files, per-file last-write-wins, file watcher on the canvas side. No lock. |
| R8 | **Schema fork** — a second model type shadowing `@vousoir/typings` | ADR-008 forbids it. Note `PATCHES.md` A3: dependency-cruiser **cannot** catch duplicate declarations — this is a review rule, so it needs human attention on every PR. |

---

## 9. Where to look next

| Question | File |
|---|---|
| Why is it this way? | [`ADR.md`](./ADR.md) — eight decisions with verified evidence |
| What is built, what is next? | [`PROGRESS.md`](./PROGRESS.md) |
| What diverged from code-oss? | `vousoir/PATCHES.md`, `vousoir/DEAI-PROGRESS.md` |
| Layer conventions and boundaries | `vousoir/CONTRIBUTING.md` |
| What is the product, in the user's words? | `vousoir-source-of-truth.md` (Stage 1/2), `vousoir-technical-spec.md` (Stage 3/4) — both outside the repo, in the parent directory |
