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
| Webview assets | `media/canvas.js` is **plain JavaScript**, via the lint allowlist — following upstream's own convention for this file class (`media-preview/media/*Preview.js`). TypeScript would need DOM lib types the package deliberately excludes, plus a second build target, to restate a convention that already exists. Logged in `PATCHES.md` row 5. |
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

Plus `typings-only-imports-zod`, `no-circular`, `no-orphans`, `no-unresolvable`. **All eight rules are
intact.**

> **`no-orphans` gained one `pathNot` entry in M2 — read it correctly.** It exempts
> `^extensions/vousoir-[^/]+/media/`. A webview script is fetched **by URL** through `asWebviewUri`
> (ADR-004), so it can never have an incoming import edge, and `no-orphans` was flagging it as dead
> code. That is a **misclassification of one file class**, in the same category as the existing
> `extension.ts` and `index.ts` exemptions — entry points the runtime loads rather than modules
> anything imports. **No boundary rule was relaxed, and none of the four walls was touched.** Do not
> cite this later as a weakened wall.

**Hitting a boundary error is a design signal, not an obstacle.** `vousoir/CONTRIBUTING.md:86-93`:
*"Do **not** route around it… Need a shape from another package? Move it to `@vousoir/typings`."*

---

## 3. Build and run

All commands measured in this worktree. **Match the command to the change** — running the wrong one
wastes minutes or reports a failure you did not cause.

| You changed | Run | Measured |
|---|---|---|
| `extensions/vousoir-core/**` — **the M2/M3/M5 inner loop** | `cd extensions/vousoir-core; node --experimental-strip-types ./esbuild.mts` | exit 0, **0.28 s** |
| Anything in the Vousoir layer — **the gate before every commit** | `cd vousoir; pnpm run verify` | exit 0, **66 tests** (22 at recon; M1 took it to 66) |
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

Use **`scripts/code.bat`** on Windows. `vousoir/PATCHES.md:317` confirms *"every §9 acceptance test
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

**Shipped as `CustomTextEditorProvider`, not the full `CustomEditorProvider` this section originally
sketched** (PR #17). The `*.v6r` manifest genuinely **is** a text document, so the framework owns dirty
state, save, revert and backup, and the canvas reimplements none of it. The model is not in that
document — it is in `.vousoir/spec/`.

```ts
class V6rCanvasProvider implements vscode.CustomTextEditorProvider {
  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel, _t: vscode.CancellationToken): void { … }
}

context.subscriptions.push(
  vscode.window.registerCustomEditorProvider('vousoir.canvas', new V6rCanvasProvider(context, log), {
    webviewOptions: { retainContextWhenHidden: true },
  }),
);
```

The full `CustomEditorProvider` surface below is what you would need **only if** the editor owned a
binary or non-text model — six methods plus an event, all of which the text variant gets for free:
`openCustomDocument`, `resolveCustomEditor`, `saveCustomDocument`, `saveCustomDocumentAs`,
`revertCustomDocument`, `backupCustomDocument`, `onDidChangeCustomDocument`. If that ever becomes
necessary: `CustomDocument` needs only `{ readonly uri: Uri; dispose(): void }` (`:10377-10389`), and
`onDidChangeCustomDocument` must fire `CustomDocumentEditEvent` **or**
`CustomDocumentContentChangeEvent`, never both (`:10579`).

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
import { ELECTRON_RUN_AS_NODE_ENV_VAR } from '@vousoir/typings';

const child = spawn('claude', [
  '--print', '--input-format', 'text', '--output-format', 'stream-json',
  '--verbose', '--permission-mode', 'acceptEdits',
], {
  cwd: workspaceRoot,
  env: { ...process.env, [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
child.stdin.end(workOrder);   // NEVER argv — see below
```

**The work order goes to stdin, not argv.** Windows caps a command line at **~32,768 characters**, and
a work order with several contracts plus neighbour context clears that easily — so `['-p', workOrder]`
truncates or rejects prompts at some unpredictable spec size. `--input-format text` under `--print`
makes the CLI read stdin instead, which has no such limit. **Do not "simplify" this back.**

**Only `ELECTRON_RUN_AS_NODE` is set — deliberately not `PARENT_PID_ENV_VAR`.** The parent-pid watchdog
is for long-lived **supervised services** that must self-exit when orphaned. `claude` is a **short-lived
job**, and a run already writing files should be allowed to finish even if the editor closes.

**`--verbose` is required** with `--print --output-format stream-json` in Claude CLI **2.1.219** (debt
D12).

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

> **`.vousoir/` is not `.vousoir-app/`.** They are one hyphen apart and mean entirely different things.
> `product.json` defines `dataFolderName: ".vousoir-app"` (`:5`), `sharedDataFolderName:
> ".vousoir-app-shared"` (`:6`) and `serverDataFolderName: ".vousoir-server"` (`:15`) — those are the
> shell's **application state in the user's home directory** (`~/.vousoir-app`), inherited from
> code-oss's `.vscode-*` convention. `.vousoir/` is **per-repo project data at the repo root**, and it
> is Vousoir's own. Different location, different owner, no collision — but do not reach for one
> expecting the other, and never store project data under `dataFolderName`.

- **Work orders** are compiled artefacts. Write them under `.vousoir/cache/work-orders/` (derived and
  regenerable from the spec) and let M4 render to a user-chosen path on explicit save.
  **Confirmed 2026-07-24 after being challenged.** The distinction is reproducibility, not
  importance: a **trace** records something that *happened* and cannot be regenerated, so losing it
  loses information and it earns a committed directory. A **work order** is derived and regenerable
  byte-identically, because the compiler is pure. Committing them puts git churn into files no human
  authored, and lets a stale work order outlive the spec change that invalidated it with nothing
  signalling the drift. If a particular work order needs preserving as a record, that is **M5's
  dispatch artefact**, sitting beside the trace of the run that consumed it.
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
- **no `children`** (derived from `parent`), **no `position`** (positions live in `.vousoir/layout.json`).

**The markdown body is the canonical home for behaviour prose** (ADR-002 amendment, 2026-07-24). The
`behaviour` frontmatter field is a **deprecated fallback**, kept valid for files that already use it,
in the same shape ADR-008 uses for scalar `contract` beside `contracts[]`. A reader prefers the body
when it has content and falls back to the field when it does not —
`vousoir/shared/src/spec-store/resolve-spec-node.ts:44` is that reader, and it is the only one anyone
should write. **Text is never migrated between the two**, so no file gets a whole-file diff on first
save. M3's spec panel must bind its editor to the **body**.

> **`lineWidth: 0` on every YAML serialise. This is binding, not a tip.** The `yaml` package re-wraps
> any string past ~80 columns by default, which silently rewrites a long behaviour or contract body on
> every save — a direct Feature 10 violation, and invisible until a diff shows a file nobody edited.
> Enforced at `vousoir/shared/src/spec-store/spec-file.ts:24`
> (`const YAML_TO_STRING_OPTIONS: ToStringOptions = { lineWidth: 0 };`). Every future serialise call
> must honour it.

Golden fixtures live at `vousoir/shared/src/fixtures/spec-node-frontmatter.{valid,invalid}.json` and
must grow alongside the schema — including one asserting a legacy scalar-`contract` file still
validates. M1 added a **second** fixture set, a real `.md` tree at
`vousoir/shared/src/fixtures/spec-tree/`; the JSON goldens were not converted, and both sets are live.

---

## 6. Milestone plan M1–M6 (adjusted by recon)

All paths relative to the repo root. Every milestone's gate is `cd vousoir; pnpm run verify` green.

> **"Creates" is a prediction, not a commitment.** For unbuilt milestones these filenames are a
> sketch of the shape, not a checklist to satisfy. The 300-line soft cap decides how many files a
> milestone actually needs, and it has already made one of these predictions wrong: M4 was written
> here as one `compile.ts` and shipped as five modules. **Build what the work needs and correct this
> section afterwards** — do not split or merge files to match a guess made before the code existed.

### M1 — Model + spec store

**Creates:** extends `typings/vousoir/src/spec-node-frontmatter.ts` (contracts[], test-case fields);
re-exports in `typings/vousoir/src/index.ts`; reader/writer in `vousoir/shared/src/spec-store/`;
fixtures under `vousoir/shared/src/fixtures/`.
**Moved to M2:** `typings/vousoir/src/v6r-manifest.ts`. This document listed it as an M1 deliverable;
the M1 brief did not, and M1 correctly followed the brief. It belongs with M2, which has to answer the
`*.v6r` filename question anyway. **Not a dropped deliverable.**
**Acceptance:** `pnpm run verify` green with new tests covering — round-trip a node to disk and back;
a legacy scalar-`contract` file still validates; a `parent` cycle is rejected; tree assembled from
`parent` pointers matches folder nesting.
**Risk:** the YAML dependency. No Vousoir package declares one (`PATCHES.md` D7); adding it touches
the shared `vousoir/pnpm-lock.yaml`. Do it in one deliberate commit.
**Changed by recon:** the brief specified `src/vs/workbench/contrib/vousoir/common/vousoirModel.ts`
and a `ModuleNode` type. Both dropped — the model lives in `@vousoir/typings` and extends the existing
schema (ADR-001, ADR-008). `position` and `children` dropped.
**Changed by the 2026-07-24 ruling:** `V6R_ROOT_DIRNAME`'s **value** becomes `'.vousoir'` (ADR-002
amendment). The symbol keeps its name, as do `V6R_SUBDIRS`, `V6R_COMMITTED_SUBDIRS`,
`V6R_GITIGNORED_SUBDIRS` and `V6R_GITIGNORE_*`; so do the filenames `v6r-layout.ts` and `v6r-init.ts`.
The `*.v6r` manifest extension is unchanged, and the manifest is **JSON** (open question 2). Doing the
rename in M1 is what keeps M2 from having to migrate a directory that already exists in a user repo.

### M2 — Canvas custom editor + auto-layout

**Created** (actual, PR #17 — this section predicted the layout engine in the extension and a second
esbuild entry; **both were wrong**): the layout engine is in **`@vousoir/shared`** —
`vousoir/shared/src/layout/layout-spec-tree.ts` and `layout-store.ts` — as a pure function, which is
exactly **why it has 26 tests**: the extension has no test runner, so anything testable belongs in
`shared` (the same rule M5 established). The extension holds only
`extensions/vousoir-core/src/canvas/` — `v6r-canvas-provider.ts`, `canvas-html.ts`,
`canvas-mutations.ts` — plus `media/canvas.{js,css}`. **No second esbuild entry exists**: the webview
imports no modules, so `esbuild.mts` still has the single `extension` entry point.
**Acceptance:** open a `*.v6r` file → nested boxes render for the tree in `.vousoir/spec/`; add, delete and
re-nest a node → the file on disk updates; drag a node → its position persists to
`.vousoir/layout.json` and survives a `.vousoir/cache/` wipe; run auto-tidy → layout re-runs;
**no other action moves a node the user placed**; the layout function has direct unit tests.
**Risk:** ~~layout thrash / mutation classifier~~ — **void, see R1.** Layout runs on command, not on
mutation.

**Every structural edit routes through the M1 `SpecStore` — this is the most consequential decision in
M2, and it is a principle, not an implementation note.** Delete re-parents orphans to the grandparent
and refuses roots; re-parent refuses cycles. **The canvas invents no rules of its own.** The canvas and
the MCP server therefore enforce **one** rule set rather than two that drift — which is the same
argument ADR-008 makes about one schema, applied to behaviour rather than shape.

**Auto-tidy is a thin wrapper over placement-clearing, not a second layout path.** Clearing a
placement already returns a node to its auto position; Tidy just persists that clearing. A test asserts
a cleared placement lands the node **byte-identically** where auto-layout would have put it. So there is
one layout implementation, not two that could disagree.

**Nothing in the codebase clears placements except Tidy.** That is how *"auto-layout never silently
overrides"* is enforced **structurally rather than by discipline** — there is no other code path that
could.

**`CustomTextEditorProvider`, not the full `CustomEditorProvider`** that ADR-001 sketches. The `*.v6r`
manifest genuinely **is** a text document, so the framework owns dirty state, save and revert, and the
canvas reimplements none of it. The model lives in `.vousoir/spec/`, not in that document.
**Changed by recon:** hand-rolled recursive layout, no ELK/dagre, no React Flow (ADR-003) — this
overrules the Stage 3 tech-stack selection. Approved by the user on 2026-07-24 **with a revisit
trigger**: reconsider a routing library only once the canvas renders contract edges *and* hand-rolled
routing is ugly.
**Changed by the 2026-07-24 ruling:** manual placement is supported and auto-layout is an explicit
auto-tidy command that **must never silently override a user's placement**. This **supersedes**
`vousoir-source-of-truth.md:86` (Feature 3), which says auto-layout *"has to work invisibly, not be a
separate 'clean up' action"*. **Do not implement Feature 3 as written** — see the ADR-003 amendment.

> ### ⚠️ The canvas has never been rendered
>
> All seven interactions — pan, zoom, create, rename, delete, drag-to-nest, drill-in, tidy —
> **typecheck, lint and bundle, and have never been exercised by a browser or a human.** The webview
> script, the CSP, and `asWebviewUri` resolution are **all unverified**. Every other leg of M2's DoD is
> verified end-to-end; this one needs a human to launch the dev build (`scripts/code.bat`) and open a
> `*.v6r` file. **Until then, do not describe the canvas as working.** 187 passing tests say the
> engine is correct; they say nothing about whether anything appears on screen.

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

**Created** (actual, as shipped in PR #13 — this section predicted `compile.ts` + template, and both
the count and the entry filename were wrong): `vousoir/shared/src/work-order/` holding **five**
modules — `work-order-context.ts` (context collector), `work-order-template.ts`,
`work-order-slug.ts`, `write-work-order.ts`, and `compile-work-order.ts` as the entry. One file could
not hold all of it under the repo's 300-line soft cap.

**Scope — settled 2026-07-24 (`ADR.md` open question 1). This is the compiler's specification.** A work
order for node *N* contains exactly three tiers and nothing else:

| Tier | Nodes | Fields emitted |
|---|---|---|
| 1 | *N* itself | **Full spec**: `behaviour`, every entry in `contracts[]` (or the legacy scalar `contract`), every `testCases[]` entry, and the markdown body. |
| 2 | *N*'s ancestor chain, root-most first, up to *N*'s parent | **Behaviour summary only.** Not their contracts, not their test cases, not their bodies. |
| 3 | *N*'s directly-contracted neighbours | **Contract blocks only** — the `contracts[]` entries that bind them to *N*. **Never** their behaviour, test cases, or body. |

A node is a "directly-contracted neighbour" if a contract link exists between it and *N*; containment
alone does not qualify a sibling. Tier 3 is a **hard boundary: neighbour internals never enter a work
order.** Rationale, in the user's terms: *"contracts, not substance" applies to the work order itself* —
the principle the product applies to modules applies to what an agent is handed. Bounded by construction,
so a deep tree cannot produce an unbounded prompt.

> ⚠️ **Tier 3 is not computable today, and M4 ships an approximation.** `specNodeContractSchema` is
> `{ id, kind, name, body }` with **no target reference**, so "contract link" does not exist in the
> model — `parent` is the only inter-node relationship. M4 uses a **structural stand-in** (parent,
> siblings, children), marked as such in code. It is too broad (an uncalled sibling leaks contracts in)
> and too narrow (a real dependency on another branch contributes nothing). **Accepted as an interim,
> not as the specification above.** `ADR.md` open question 10 — must settle before M6.

Note tier 2 is **behaviour summaries, not contracts** — this is where the ruling departs from the
proposal the ADR originally carried. An ancestor's contract is with the world outside the subtree; what a
child needs to know is what its parent is *for*.

**Acceptance:** a fully-specified node compiles to self-contained markdown; each of the three tiers is
covered by a unit test, including a negative one asserting a neighbour's `behaviour` and `testCases`
never appear in the output; the compiler is a pure function; output is reviewable before dispatch.
**Risk:** tier-3 leakage — the easy bug is emitting a neighbour's whole spec because it was already
loaded. Test for absence, not just presence. M4 answered this structurally: the context interfaces
physically cannot hold a neighbour's behaviour, test cases or body, so the renderer is never handed
the data and cannot leak it by accident. Keep it that way.

**"Fully specified" is M3's to define — decided 2026-07-24.** `vousoir-source-of-truth.md:93` has the
user *"select a node that's fully specified"*, but **nothing in the model defines that**, and `status`
is user-set rather than derived, so it cannot stand in. **M3 owns the definition**, because M3's own
requirement — node badges showing spec completeness — cannot ship without deciding what completeness
means. **Until then the compiler compiles anything**, including an `unspecified` node, and states the
node's status in the output rather than guessing. Once M3 defines it, revisit whether the compile
command should warn or refuse. A forward dependency on M3, not an open question.

**Interface decisions M4 made that no ADR covered**, recorded so they are not re-litigated:

| Case | Behaviour |
|---|---|
| Neighbour holds only the deprecated scalar `contract` | Included, rendered **untyped** — no `kind` is invented for it. |
| Neighbour has no contracts at all | **Omitted entirely** — no empty heading. |
| The node's **own** contract / test-case sections when empty | **Always render**, with an explicit *"declares no contracts"*. Silence in a node's own spec reads as an omission bug; silence in *context* sections does not, which is why those drop when empty. |
| "First paragraph" of an ancestor's behaviour | The first block of consecutive non-blank lines, after skipping leading blanks and `#` headings. |
| Co-roots (two nodes with `parent: null`) | Count as **siblings**. |
| Work-order slugs | Derived from `id`, with a SHA-256 suffix **only** when sanitising was lossy. Can never contain a path separator or `..`. |

### M5 — Dispatch to Claude Code

**Created** (actual, PR #14): the dispatch **engine** in `vousoir/shared/src/dispatch/` —
`claude-cli.ts`, `dispatch-work-order.ts`, `claude-stream-mapper.ts`, `trace-writer.ts`. The extension
holds only `extensions/vousoir-core/src/dispatch/build-with-claude-command.ts`, the command that needs
the editor.
**Acceptance:** dispatch a compiled work order → transient run status moves `idle → running →
done|failed`; stdout/stderr stream to the "Vousoir" output channel; `claude` absent from PATH fails
loudly with an actionable message; a JSONL trace lands under `.vousoir/traces/`.
**Risk:** **`ELECTRON_RUN_AS_NODE`** — no plain-Node test catches its absence. Second: `--permission-mode
acceptEdits` writes to the user's workspace (per-run worktree isolation is post-M6). Warn in the UI
before the first dispatch.
**Changed by recon:** no IPC service and no shared-process work — the extension host is already Node
(ADR-005). Removes an entire subsystem from the original design.

**The engine lives in `@vousoir/shared`, not the extension — and this is a general rule.**
`extensions/vousoir-core` has **no test runner**, and cannot cheaply get one while it imports `vscode`.
A dispatcher built there would be untestable, which would make the milestone gate meaningless. **The
extension keeps only what genuinely needs the editor**; everything else goes to `@vousoir/shared` where
it can be tested. **This applies to M6 too.**

**Run status is transient — see the ADR-005 amendment.** `DispatchRunStatus` is
`'idle' | 'running' | 'done' | 'failed'`, in memory and event-only; cancellation settles as `failed`
with `cancelled: true`, **not** a fifth status. Nothing writes a spec file. Whether a *successful* run
should persist `built` is deliberately **undecided**.

**Traces reuse `traceEventSchema` unchanged** — it already modelled everything needed. Lines are
appended **one at a time**, so a crash leaves a readable trace rather than a truncated buffer, and each
line is **schema-validated before queueing**, so "one valid JSON object per line" is enforced rather
than hoped for.

> **Known modelling gap, not a defect today.** `traceEventSchema` has no event kind for **raw agent
> output**, so an unrecognised `stream-json` line becomes `{ type: 'message', role: 'system' }`. That
> is lossless — nothing is dropped — but `role: 'system'` now does two jobs: genuine harness output,
> and a line the mapper could not classify. **If M6's trace viewer must tell them apart**, the fix is
> an additive kind (ADR-008 style, no migration): add a `raw` variant to the discriminated union and
> map unclassified lines to it. Nothing needs to change before then.

**`ELECTRON_RUN_AS_NODE` is verified three ways**, because no plain-Node test can see its absence —
under vitest `process.execPath` already *is* node. (1) a pure `claudeSpawnOptions` function reachable
without spawning, so the options object itself can be asserted on; (2) a test that the var survives
into the real `spawn` call; (3) the live smoke run.

**The Claude Code VS Code extension path was deliberately skipped.** The CLI path is solid and now
verified live; a second dispatch path doubles the surface for no capability the primary lacks.

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

**Shipped (PR #15) — decisions worth not re-litigating:**

- **No cached tree.** Every call opens the store, reads, and disposes. A cached snapshot would answer
  **stale** *and* clobber the user's concurrent edit, given ADR-002's last-write-wins posture. The cost
  is a re-read per call; the alternative is a correctness bug.
- **Writes go through the M1 `SpecStore`, never straight to disk.** That is what makes a hand-written
  YAML comment survive an agent changing one field, and it inherits id-uniqueness, parent validation
  and cycle rejection identically to the editor. Tested.
- **`get_work_order` calls the same `compileWorkOrder` the editor does**, asserted **byte-identical**
  against the same golden. The fixture and golden are **exported from `@vousoir/shared`, not copied** —
  a copy would drift while both tests still passed, which is the failure mode that makes two
  implementations diverge silently.
- **Two writers verified end-to-end:** an editor-side watcher fires when the MCP server writes
  underneath it, and reload picks the change up. That is the DoD path, exercised rather than assumed.
- **The orchestrator is sequential by default — a decision, not a simplification.** `acceptEdits`
  writes into the user's workspace and worktree isolation is post-M6, so concurrent siblings produce
  interleaved edits with no conflict detection and no way to attribute a bad change to a run. A
  `concurrency` option is exposed for when isolation lands.
- **Every `OrchestrationResult` carries `integrationTests: 'blocked-on-contract-edges'`** with a
  readable explanation naming open question 10 — so the gap is visible to anything inspecting a result
  and **cannot be mistaken for "ran, found nothing"**. Tested.
- **The DoD live run deliberately avoided `claude mcp add`**, which mutates the user's global CLI
  config outside the workspace. It used a temp `mcp.json` via `--mcp-config … --strict-mcp-config`,
  exercising the identical protocol path with nothing to clean up. **Use this pattern for future live
  verification.**
**Carries a deadline set 2026-07-24:** `get_contracts` returns a **free-form string** body per contract
kind (`ADR.md` open question 4). Structuring that body — additively, ADR-008 style — **must land before
the milestone that builds Feature 6, "Integration Testing Across Modules"**, because agent-run contract
integration tests need machine-readable contracts. **That deadline is not M6.** Feature 6 is integration
testing and is deferred out of M1–M6; M6 is this MCP server. Nothing here blocks M6 — but if you are
building M6 and the contract body is still a string, the debt is still outstanding and it is yours to
hand on.
**Blocked before build, not before start:** the orchestrator is specified to run *"contract-based
integration tests between siblings"*, which needs to know which node **provides** a contract and which
**consumes** it. Contracts carry **no target reference** today (`ADR.md` open question 10), so there is
no pair to test between — only per-node declarations. **Open questions 4 and 10 are two halves of one
prerequisite** — *what* a contract says, and *who is on each end of it*. They were deferred separately
and converge here. **Settle both before building this milestone, and land them together.**

---

## 7. Debt log

| # | Debt | Impact | Resolution |
|---|---|---|---|
| D1 | **Junctioned `node_modules`** across worktrees (ADR-007) | Already caused D2. The `launch` skill explicitly warns against it. Version drift between branches is silent. | `npm ci` in `vousoir-v6r`, or collapse to one worktree when `phase-2-links` lands. |
| D2 | **`compile-extensions` fails** — TS2688 in `grunt`, `notebook-renderers` | Cannot use it as a green-build gate. Do **not** mistake it for a regression. | `npm ci` here (runs the root postinstall). Not tsconfig patches. |
| D3 | **Packaged builds cannot find service-host** (`PATCHES.md` L1) | Dev builds only. Extension logs a clear diagnostic and degrades gracefully. | Deferred — needs a `build/gulpfile.vscode.*` core patch. |
| D4 | **Services spawned as raw `.ts`** relying on Node 24 type stripping (`PATCHES.md` A2, open risk) | Electron 42.6.0's bundled Node may differ; stripping only supports erasable syntax. | Fallback: esbuild service entries to `.js`. |
| D5 | ~~**No YAML dependency** anywhere in the Vousoir layer (`PATCHES.md` D7)~~ | — | **CLOSED by M1** (PR #12): `yaml@2.9.0`. The JSON frontmatter goldens were kept; a real `.md` tree fixture was added beside them. |
| D9 | **`vousoir/PATCHES.md:63` and `vousoir/HANDOFF.md:183` still say `.v6r/`** | Looks like a missed rename. It is not. | **Ruled 2026-07-24: leave them.** Both are historical records — a ledger row describing a past README rewrite, and a completed acceptance-test checklist. They accurately describe what was true when written, and rewriting a record of the past to match the present is how a ledger stops being trustworthy. **Do not "fix" these.** |
| D10 | **`vousoir-technical-spec.md:93` permits a contract leak, read literally** | It specifies the work-order output as *"spec + contracts + tests + neighbor/ancestor context"* **without saying whose**. Read literally that allows emitting a neighbour's test cases — precisely the leak the product must not have. The code does the right thing; the spec does not say so. | **The user must make this edit — do not edit that file.** One clause fixes it: *"…the node's **own** spec, contracts and tests, plus neighbour/ancestor context as **contracts only**."* Same standing as Feature 3 (R9): a user-owned product document that the ADRs cannot amend. |
| D11 | **Cancellation kills the direct child only** | If `claude` spawns grandchildren that survive the parent's `SIGKILL`, they are not reaped and keep writing to the user's workspace after the run reads as cancelled. | Process-group kill (`taskkill /T` on Windows, `kill(-pgid)` elsewhere). **Deliberately not built:** the failure could not be observed, and guessing at process-tree semantics is how you ship a killer that kills the wrong thing. Build it when it is reproducible. |
| D12 | **`--verbose` is required by Claude CLI 2.1.219** alongside `--print --output-format stream-json` | A version coupling. If a future CLI drops the requirement the flag is harmless — but if the *contract* changes, the symptom is an **empty trace**, which does not point at its own cause. | Findable here when someone upgrades the CLI and traces go empty. Re-check the flag combination against `claude --help` at that point. |
| D13 | **The MCP SDK pulls ~75 transitive packages**, including an Express path this stdio server never touches | The Vousoir layer's dependency surface roughly **doubled in one install**. Not a defect — but ADR-003 argued that the real cost of a dependency here is the shared `vousoir/pnpm-lock.yaml` and the surface it adds, and **that argument now cuts against a dependency we accepted**. Recorded because the inconsistency is the point. | Revisit if the surface becomes a problem: the server speaks stdio JSON-RPC and needs none of the HTTP transport. A hand-rolled stdio transport is plausible but is not worth doing on speculation. |
| D14 | **Husky pre-commit hygiene rejects curly apostrophes — and reads the git *index*, not the working tree** | A fix applied to the file does nothing until it is **re-staged**, so the same error repeats and looks like the fix failed. Cheap to record, annoying to rediscover. | Use straight quotes in source. After fixing a hygiene failure, `git add` the file again **before** re-committing. |
| D6 | **`launch` skill is stale and Windows-hostile** | Cannot be used here. References deleted `agentHost`. | Use `scripts/code.bat`. Rewrite the skill or delete it. |
| D7 | `CONTRIBUTING.md:116` still states the retired ≤15-patch budget | Contradicts `PATCHES.md:14`. Misleads readers. | One-line fix. |
| D8 | Deferred residue from the AI excision (`PATCHES.md:101-106`) | Dead but compiling: AI-search type surface, `_chatExtensionId`, three orphaned dirs. | Tracked in `DEAI-PROGRESS.md`. |

---

## 8. Risks, ranked

| # | Risk | Mitigation |
|---|---|---|
| R1 | ~~**Layout thrash in M2/M3** — spec-text edits re-run layout on every keystroke~~ | **VOID since the ADR-003 amendment (2026-07-24).** Layout runs **on command**, not on mutation, so no mutation can trigger a re-layout and no classifier exists to get wrong. **Do not build the `structural \| content` classifier.** A second-order consequence of the manual-placement ruling: it retired what these docs called the plan's highest-probability failure. |
| R2 | **Missing `ELECTRON_RUN_AS_NODE` in M5** — silently launches an Electron instance; no plain-Node test can catch it | Assert the env var in the spawn options in a unit test **and** verify once by hand in the real shell (`PATCHES.md:276`). |
| R3 | **ADR-003 overrules a made Stage 3 decision** (React Flow + ELK) | **Approved 2026-07-24 with a revisit trigger**: contract links create cross-edges the strict-tree argument does not cover, so reconsider a routing library once the canvas renders contract edges *and* hand-rolled routing is ugly — not before. Still reversible behind the same pure-function signature. |
| R9 | **Feature 3 is stale and says the opposite of ADR-003** — it forbids a manual "clean up" action (`vousoir-source-of-truth.md:86`); the 2026-07-24 ruling requires exactly that | Follow the ADR-003 amendment, not Feature 3. `vousoir-source-of-truth.md` needs its author's edit; until then the two documents disagree and the ADR is operative. |
| R10 | **Contracts have no edges** — `specNodeContractSchema` has no target reference, so M4's "contracted neighbours" is a structural approximation and M6's sibling contract tests have no provider/consumer pair | `ADR.md` open question 10, lean B (optional `provider`/`consumes`, additive). Must settle before M6, alongside the contract-body structuring — they are one prerequisite in two halves. M4's approximation is marked in code and is too broad *and* too narrow. |
| R4 | ~~**Work-order scope is unresolved** and gates M4's correctness~~ | **RESOLVED 2026-07-24.** Three tiers, specified in §6 M4. Residual risk is implementation, not scope: tier-3 leakage of neighbour internals. Test for absence. |
| R5 | ~~**`*.v6r` filename collides with the `.v6r/` directory**~~ | **RESOLVED 2026-07-24** by renaming the directory to `.vousoir/` (ADR-002 amendment). The manifest keeps its `*.v6r` extension; one name now means one thing, so no `filenamePattern` stem rule is needed. Lands with M1, before any user repo contains either. |
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
