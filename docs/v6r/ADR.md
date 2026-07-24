# Vousoir (v6r) — Architecture Decision Record

Vousoir is a spatial canvas on which an engineer diagrams an application as **nested modules**. Each
module node carries plain-language **behaviour**, **boundary contracts** (module API, service API, DB
schema), and exact **test cases** — and never internal implementation. The name is a respelling of
*voussoir*, the wedge stone in an arch, which is defined entirely by its precisely-cut edges:
**edges, not substance**. Nodes compile into self-contained markdown **work orders** handed to AI
coding agents, and all generated code traces back to the spec node that produced it. Vousoir ships
as a de-branded fork of code-oss; the canvas is one surface inside that shell. The decisions below
bind all milestone work M1–M6 (model+service · canvas editor · spec panel · work-order compiler ·
dispatch · orchestration+MCP). Each was verified against the tree at commit `3cf0c77872d` on branch
`v6r/mvp` — every `path:line` in an **Evidence** block was opened and read, and citations that did
not survive that check are called out in the decision text rather than quietly dropped.

Four of these ADRs deviate from a brief or a prior document. Those deviations are stated in the
**Context** section of the ADR that makes them, not buried: ADR-001 deviates from the milestone
brief's core-contrib layout, ADR-002 from its `.v6r` JSON persistence, ADR-003 from an already-made
Stage 3 tech-stack selection, and ADR-008 from six of the brief's field names.

**All five deviations were reviewed and approved by the user on 2026-07-24 (PR #11)** — in each case
the repo's committed code and rules correctly overrule the brief. ADR-003 is approved **with a
revisit trigger**; see its amendment. The same review resolved all six open questions and amended
ADR-002 and ADR-003. Amendments are dated blocks inside the ADR they modify; the original text is
left standing so the reasoning survives.

**A path convention that has already produced one false finding.** The git repo root is
`…/Projects/vousoir/vousoir` — a doubled directory name — and the Vousoir layer lives in a `vousoir/`
subdirectory of it. So the repo-relative path `vousoir/PATCHES.md` resolves to
`…/Projects/vousoir/vousoir/vousoir/PATCHES.md`: **three** `vousoir` segments. An agent that
resolved it with two concluded the file did not exist and reported that as fact. In this worktree the
same file is `…/Projects/vousoir/vousoir-v6r/vousoir/PATCHES.md`. Every path in this document is
repo-relative in the conventional sense (`vousoir/PATCHES.md` means the Vousoir layer's ledger); use
absolute paths when checking, and never write "does not exist" without one.

This file is a new, purely additive document. Per `vousoir/PATCHES.md:110-119` — *"Everything else
added so far is **purely additive** — new files and directories that do not exist upstream … Additive
files are *not* core patches"* — it needs no `PATCHES.md` entry, even though `docs/` sits outside
`extensions/vousoir-*` and `vousoir/`. See "Note on patch ledger scope" at the end.

## Summary

| # | Title | Status | Decision in one line |
|---|-------|--------|----------------------|
| ADR-001 | Host the canvas as a built-in extension, not a core workbench contrib | Accepted | Canvas, spec panel and dispatch live in `extensions/vousoir-core` behind `registerCustomEditorProvider` bound to `*.v6r`; **not** `src/vs/workbench/contrib/vousoir/`. |
| ADR-002 | Specs are markdown + YAML frontmatter under `.vousoir/spec/`; `*.v6r` is a thin manifest | Accepted · **amended ×2, 2026-07-24** | Ratify the shipped `specNodeFrontmatterSchema` and `V6R_SUBDIRS`; the `*.v6r` file the editor binds to is a small project manifest, not the model. **Amended:** the directory is `.vousoir/`, not `.v6r/`; and the markdown **body** is canonical for behaviour prose, with the `behaviour` field a deprecated fallback. |
| ADR-003 | Hand-roll recursive tree layout; no ELK or dagre | Accepted · **amended 2026-07-24** | ~150 lines of recursive nested-box layout, no layout library — the model is a strict tree, not a general graph. **Amended:** manual placement is supported, auto-layout is an explicit auto-tidy command, positions live in `.vousoir/layout.json`. **Supersedes Feature 3's auto-layout-on-every-mutation.** |
| ADR-004 | Ship webview assets as extension files via `asWebviewUri` | Accepted | Canvas JS/CSS are real files under `media/`, loaded through `asWebviewUri` + `localResourceRoots` under a nonce CSP. No CDN, no network. |
| ADR-005 | Dispatch Claude Code from the extension host via `child_process` | Accepted · **amended 2026-07-24** | M5 spawns `claude --print …` with `ELECTRON_RUN_AS_NODE=1`, work order on **stdin**; no new IPC service. **Amended:** run status is transient and in-memory, **not** the frontmatter enum. |
| ADR-006 | The MCP server is a standalone stdio node script, not in-process | Accepted | M6 ships `vousoir/services/spec-mcp/` as its own package with its own `main.ts`, launched by an external `claude` via `claude mcp add`; nine tools over `.vousoir/spec/`. |
| ADR-007 | Develop in a git worktree with junctioned dependencies | Accepted (debt) | Work in `../vousoir-v6r` on `v6r/mvp`; `node_modules` and `build/node_modules` are junctions, `out/` is a real copy. Time-boxed debt with a documented undo — and it has already broken one build command. |
| ADR-008 | Extend the existing spec-node schema; never fork it | Accepted | M1 adds typed `contracts[]` and given/when/then test fields to `specNodeFrontmatterSchema` in place; it does not introduce a parallel `ModuleNode` type, and it does not add `position`. |

---

## ADR-001 — Host the canvas as a built-in extension, not a core workbench contrib

**Status:** Accepted (2026-07-24)
**Deciders:** orchestrating agent, pending user review

### Context

The milestone brief for M1–M6 explicitly specified core workbench paths —
`src/vs/workbench/contrib/vousoir/common/vousoirModel.ts` and `contrib/vousoir/browser/`. **This ADR
deviates from that brief.** The deviation is not stylistic; the brief's layout is mechanically
impossible under the fork's own enforcement.

`.dependency-cruiser.cjs` declares a rule named `core-not-import-vousoir` whose comment reads
*"code-oss core (`src/`) may not import from the `vousoir/` or `typings/` tree — the extension is the
only bridge."* It is `severity: 'error'`, it runs in CI on every push, and it has been
negative-tested. A `src/vs/workbench/contrib/vousoir/` module therefore could not import
`specNodeFrontmatterSchema`, `V6R_SUBDIRS`, or any other shared model type. It would have to
redeclare every shape locally — which `vousoir/CONTRIBUTING.md:43-52` forbids on a second axis
(*"Every cross-package data shape … is defined in `typings/vousoir` and imported everywhere else.
**No package redeclares a shared shape locally.**"*), and which `PATCHES.md` A3 records as a defect
the project already paid for once.

The reverse rule closes the loop: `vousoir-layer-not-import-core` forbids anything under `vousoir/`,
`typings/`, or `extensions/vousoir-*` from importing `src/`. The two rules together mean there is
exactly one legal bridge, and it is a built-in extension speaking the public `vscode` API.

Independent of the boundary wall, the fork's own documents already made this call.
`vousoir-technical-spec.md:37` states, as fork discipline: *"A Vousoir feature that can be a built-in
extension must be a built-in extension."* `:120` opens the UI-composition section with *"All Vousoir
UI ships as built-in extensions of the fork"* and `:122` names the canvas panel specifically as a
webview. `vousoir/CONTRIBUTING.md:112` gives the ordering: *"Prefer, in order: `product.json` → a
built-in extension → configuration → *then* a core edit."*

One brief citation needs correcting. The brief cited CONTRIBUTING.md's *"**Budget: under 15 core
patches**"* as live. That line is still in the file at `:116`, but it has been **retired**:
`vousoir/PATCHES.md:3` opens with *"Status change (2026-07-24): Vousoir is now a HARD FORK, not a
bounded patch set"* and `:14` states the budget is *"**deliberately and knowingly retired**"* after a
~8,150-file divergence. So the argument for this ADR is **not** "we cannot afford the patches" — the
fork has already spent ~180 core-file modifications. The argument is the boundary wall, which is
still enforced, still green, and unaffected by the excision.

Cost of shipping a built-in extension: zero core patches. `build/lib/extensions.ts:418` discovers
extensions by `glob.sync('extensions/*/package.json')` — any folder under `extensions/` with a
manifest is picked up automatically. `:69` then checks `fs.existsSync(path.join(extensionPath,
esbuildConfigFileName))` for `esbuild.mts` and routes the folder through the bundled build path. No
registry edit, no build-file edit.

The API surface required is fully present in the de-branded `vscode.d.ts` (verified line by line;
none of it was excised with the AI surface).

### Decision

The v6r canvas, per-node spec panel, and agent dispatch live in a **built-in extension**, registered
with `vscode.window.registerCustomEditorProvider` bound to a `*.v6r` document. They do **not** live
in `src/vs/workbench/contrib/vousoir/`.

**Extend `extensions/vousoir-core`; do not create `extensions/vousoir-canvas`** for M1–M5.

Both options were investigated. They are equivalent under the boundary wall — `.dependency-cruiser.cjs`
matches `^extensions/vousoir-` as a prefix, so `vousoir-canvas` would receive *identical* import
permissions to `vousoir-core`. A split therefore buys no isolation. It costs: a second `package.json`
with a sealed `exports` field, a second `tsconfig.json`, a second `esbuild.mts`, a second activation
event, a `pnpm install` round-trip (`vousoir/CONTRIBUTING.md:97-106`), and — the trap — **four edits
to hardcoded script paths** in `vousoir/package.json:13-18`, where `lint`, `lint:strict`, `lint:fix`,
`dep-check` all name `extensions/vousoir-core` literally. Miss one and the new extension is silently
unlinted and unchecked by `pnpm run verify` while CI still reports green.

Against that, `extensions/vousoir-core/src/extension.ts:2,6-7` already declares itself *"the only
code-oss-facing entry point for Vousoir functionality … All future Vousoir features register through
this extension"*, and it already owns the service-host lifecycle that M5 and M6 will need. Adding a
`custom-editor/` folder beside the existing `panel/` and `service-host/` folders is the smaller move.

Revisit when a **second independent UI surface** lands — the whiteboard panel or trace viewer
(`vousoir-technical-spec.md:124-125`) — where separate activation genuinely matters. Being wrong is
cheap: moving a folder between two extensions with identical import rules is a file move plus those
four script edits.

Per-file limits, not per-package limits, govern size: `vousoir/CONTRIBUTING.md:35-41` warns at 300
lines and errors at 500 **per file**, with `--max-warnings=0` in `lint:strict`. A large extension is
fine; a large file is not.

### Consequences

- Zero core patches for the canvas. `git diff 1.130.0` stays empty for everything M1–M6 adds.
- The model types in `@vousoir/typings` are importable by the canvas, the spec panel, the dispatcher,
  and the MCP server alike — one declaration, four consumers.
- **The inner loop is half a second.** Building `vousoir-core` alone via its own `esbuild.mts` was
  measured at **0.28 s** (exit 0) in this worktree. The equivalent core-contrib loop is
  `typecheck-client` plus a workbench rebuild — `typecheck-client` alone measured **6.5 s**, and it
  only type-checks. A ~20× faster edit-run cycle across M2, M3 and M5 is on its own a strong argument
  for the extension, independent of the boundary wall.
- **The canvas can only see what `@vousoir/typings`' barrel exports.** `typings/vousoir/package.json`
  seals the package: `exports` maps `"."` to `./src/index.ts` and nothing else, so a deep import like
  `@vousoir/typings/src/spec-node-frontmatter.ts` fails at resolution with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`. `src/index.ts` already re-exports `spec-node-frontmatter.ts`,
  `v6r-layout.ts`, `service-host-protocol.ts`, `service-lifecycle.ts` and `trace-event.ts`, so M1's
  model types are reachable today — but **anything ADR-008 adds must be re-exported from the barrel
  or the canvas cannot import it.** Same for `@vousoir/shared`, whose barrel currently exports only
  `v6rInit`.
- **`vousoir-core` is ESM, and the canvas code must match.** `esbuild.mts` sets `format: 'esm'` and
  `external: ['vscode']`; `package.json` sets `"type": "module"`. Its own docblock explains why this
  is load-bearing rather than incidental: the extension host picks its loader from that same
  `"type"` field, so an entry point that is not `.cjs` under `"type": "module"` is loaded via
  `import()`, not `require()`. No `require()`, no `__dirname`, no CommonJS interop shortcuts in new
  extension-host code.
- The canvas runs in a webview, not in the workbench renderer. It gets no direct access to workbench
  services (`IEditorService`, `IInstantiationService`, …); everything crosses the `postMessage`
  seam. This is a real constraint on M2/M3 and is the price of the boundary.
- `vousoir-core` grows a third responsibility. Watch the 300-line file warning; decompose into
  folders early rather than fighting `lint:strict` later.
- Adding the `customEditors` contribution point does not change the existing `viewsContainers` /
  `views` contributions in `extensions/vousoir-core/package.json:23-42`; the activity-bar panel and
  the custom editor coexist.

### Rejected alternatives

- **`src/vs/workbench/contrib/vousoir/` (the milestone brief's layout).** Rejected: blocked by
  `core-not-import-vousoir` at CI severity `error`. The only way to make it compile is to duplicate
  every model type into `src/`, which violates the typings rule and re-creates the exact class of
  defect `PATCHES.md` A3 documents. It would also add core patches to a fork that has just finished
  paying down a merge-hostile divergence.
- **A new `extensions/vousoir-canvas`.** Rejected for now, not on principle: it buys no boundary
  isolation (identical dependency-cruiser prefix match), costs four hardcoded script edits that fail
  silently if missed, and splits the service-host lifecycle away from the code that will drive it in
  M5/M6. Reconsider at the second UI surface.
- **A marketplace/sideloaded extension rather than a built-in.** Rejected: `*.v6r` must open without
  an install step in the fork's own shell, and the extension needs `workspace:*` links to
  `@vousoir/typings` that only make sense inside the monorepo.

### Evidence

- `.dependency-cruiser.cjs:42-46` — `name: 'core-not-import-vousoir'`, comment: *"§7.1: code-oss core
  (src/) may not import from the vousoir/ or typings/ tree — the extension is the only bridge."*,
  `severity: 'error'`, `from: { path: '^src/' }`.
- `.dependency-cruiser.cjs:24-30` — `name: 'ext-imports-only-typings-and-shared'`, *"§7.1:
  extensions/vousoir-* may import @vousoir/typings and @vousoir/shared — and nothing else from the
  vousoir/ or typings/ tree."*, `from: { path: '^extensions/vousoir-' }`.
- `.dependency-cruiser.cjs:33-39` — `name: 'vousoir-layer-not-import-core'`, *"The extension bridges
  to the shell via the public vscode API, not core source."*
- `vousoir-technical-spec.md:37` — *"A Vousoir feature that can be a built-in extension must be a
  built-in extension."*
- `vousoir-technical-spec.md:120` — *"All Vousoir UI ships as built-in extensions of the fork:"*
- `vousoir-technical-spec.md:122` — *"**Canvas panel** (webview: React + React Flow + ELK
  auto-layout) — the module tree"*
- `vousoir/CONTRIBUTING.md:112` — *"Prefer, in order: `product.json` → a built-in extension →
  configuration → *then* a core edit."*
- `vousoir/CONTRIBUTING.md:114-116` — *"Any change to a code-oss core file … **must** be logged in
  [`PATCHES.md`] … **Budget: under 15 core patches** for the shell work order."*
- `vousoir/PATCHES.md:3` — *"**Status change (2026-07-24): Vousoir is now a HARD FORK, not a bounded
  patch set.**"*
- `vousoir/PATCHES.md:14` — *"The ≤15 patch budget (work-order acceptance test #13) is therefore
  **deliberately and knowingly retired.**"*
- `build/lib/extensions.ts:418` — `(glob.sync('extensions/*/package.json') as string[])` inside
  `doPackageLocalExtensionsStream` — the auto-discovery sweep.
- `build/lib/extensions.ts:69` — `let hasEsbuild = fs.existsSync(path.join(extensionPath,
  esbuildConfigFileName));` in `fromLocal`, with `esbuildConfigFileName = 'esbuild.mts'` for desktop.
- `extensions/vousoir-core/esbuild.mts:5-7` — the fork's own statement of the same fact:
  *"`build/lib/extensions.ts#fromLocal` auto-detects this file per extension folder (`fs.existsSync`)
  - no code-oss core file needs to list vousoir-core for the production/packaging build to pick it
  up."*
- `extensions/vousoir-core/esbuild.mts:26-36` — `run({ platform: 'node', format: 'esm', entryPoints:
  { 'extension': … }, … additionalOptions: { external: ['vscode'] } }, process.argv);`
- `extensions/vousoir-core/esbuild.mts:13-19` — *"Output format is ESM, not the CJS every other
  built-in extension here uses … the extension host picks its loader from that same field
  (`src/vs/workbench/api/common/extHostExtensionService.ts#_isESM`: `type === 'module'` and the entry
  point doesn't end in `.cjs` -> loaded via `import()`, not `require()`)."*
- `typings/vousoir/package.json` — `"exports": { ".": { "types": "./src/index.ts", "default":
  "./src/index.ts" } }` — the seal.
- `typings/vousoir/src/index.ts:9-11` — *"This barrel is the package's ONLY entry point: `exports`
  seals everything else, so a deep import such as `@vousoir/typings/src/...` fails with
  ERR_PACKAGE_PATH_NOT_EXPORTED. Anything a sibling package needs must be re-exported here."*
- Measured in this worktree: `node --experimental-strip-types ./esbuild.mts` in
  `extensions/vousoir-core` → exit 0 in **0.28 s**; `npm run typecheck-client` at repo root → exit 0
  in **6.48 s**.
- `src/vscode-dts/vscode.d.ts:11781` — `export function registerCustomEditorProvider(viewType:
  string, provider: CustomTextEditorProvider | CustomReadonlyEditorProvider | CustomEditorProvider,
  options?: {`
- `src/vscode-dts/vscode.d.ts:10560` — `export interface CustomEditorProvider<T extends CustomDocument
  = CustomDocument> extends CustomReadonlyEditorProvider<T> {`
- `src/vscode-dts/vscode.d.ts:10348` — `export interface CustomTextEditorProvider {`
- `src/vscode-dts/vscode.d.ts:10377` — `export interface CustomDocument {`
- `src/vscode-dts/vscode.d.ts:10581` — `readonly onDidChangeCustomDocument:
  Event<CustomDocumentEditEvent<T>> | Event<CustomDocumentContentChangeEvent<T>>;`
- `src/vscode-dts/vscode.d.ts:10076` — `export interface WebviewPanel {`
- `extensions/media-preview/package.json:46-56` — `"customEditors": [{ "viewType":
  "imagePreview.previewEditor", … "selector": [{ "filenamePattern":
  "*.{jpg,jpe,jpeg,png,bmp,gif,ico,webp,avif,svg}" }] }]` — the live contribution-point template.
- `extensions/media-preview/src/audioPreview.ts:116` — `return
  vscode.window.registerCustomEditorProvider(AudioPreviewProvider.viewType, provider, {`
- `extensions/vousoir-core/src/extension.ts:2,6-7` — *"the only code-oss-facing entry point for Vousoir
  functionality … All future Vousoir features register through this extension."*
- `vousoir/package.json:13-18` — `lint`, `lint:strict`, `lint:fix`, `dep-check` each end with a
  literal path list containing `extensions/vousoir-core`.
- `vousoir/CONTRIBUTING.md:35-41` — *"| 300 lines | **warning** … | 500 lines | **error** — blocks
  CI |"* and *"Warnings fail CI too (`lint:strict` runs with `--max-warnings=0`)"*.

---

## ADR-002 — Specs are markdown + YAML frontmatter under `.vousoir/spec/`; `*.v6r` is a thin manifest

**Status:** Accepted (2026-07-24) — **amended twice on 2026-07-24**: project directory renamed
`.v6r/` → `.vousoir/`; the markdown body is canonical for behaviour prose.
**Deciders:** orchestrating agent; amendments ruled on during review of PR #11 and PR #12

### Amendment (2026-07-24) — the project directory is `.vousoir/`, not `.v6r/`

Resolves open question 3. The user ruled: keep the `*.v6r` manifest **file** extension; rename the
**directory** to `.vousoir/` (`.vousoir/spec/`, `.vousoir/cache/`, …). One name now means one thing,
so `filenamePattern: "*.v6r"` can no longer collide with a directory entry.

- `V6R_ROOT_DIRNAME` changes **value** to `'.vousoir'`. It does **not** change name. Neither do
  `V6R_SUBDIRS`, `V6R_COMMITTED_SUBDIRS`, `V6R_GITIGNORED_SUBDIRS`, `V6R_GITIGNORE_FILENAME`, or
  `V6R_GITIGNORE_CONTENTS` — `v6r` is the product's internal namespace prefix (a numeronym for
  Vousoir), not a reference to the directory. Same for filenames like
  `typings/vousoir/src/v6r-layout.ts` and `vousoir/shared/src/v6r-init.ts`.
- The rename lands with M1. **This document is written in the post-rename name throughout**, including
  in quotations of source docblocks, so that no reader implements the old name. The tree at
  `3cf0c77872d` — the commit every Evidence block was verified against — still reads `.v6r/`; the two
  Evidence entries that quote the literal constant are marked with the change.
- One quotation is deliberately left verbatim: `vousoir/CONTRIBUTING.md:43-47` says *"`.v6r` layout"*
  with no trailing slash, referring to the layout **module**, and that file is not being edited here.

**This amendment reverses one of this ADR's own corrections, and the reversal is left on the record
rather than edited away.** The Context below originally concluded *"The code is operative; that section
of the technical spec is superseded"* about `vousoir-technical-spec.md:132`. That verdict was wrong in
one direction: **on the directory name the technical spec was right all along, and the code has now
been corrected to match it.** What remains superseded is only §3.5's *contents*: it lists `spec/`,
`whiteboards/`, `vousoir.db` and `worktrees/`, where the code has five subdirectories and no
`vousoir.db` or `worktrees/`. The fact that these docs briefly declared the spec superseded is kept
deliberately — a reader who saw the earlier claim needs to find out here that it was withdrawn.

### Amendment (2026-07-24) — the markdown body is canonical for behaviour prose

`behaviour` has two possible homes, and this document described both without reconciling them: the
shipped schema has a `behaviour` **frontmatter field** (used by the golden fixture), while Decision 1
and `ARCHITECTURE.md` §5 describe the markdown **body** as unconstrained prose. Both read as "where
behaviour lives."

**Decision: the markdown body is canonical.** That is the point of markdown + YAML frontmatter under
Feature 10, "Portable Spec Files" — long prose belongs in a body a human can read, edit outside the
tool, and diff line by line. A multi-paragraph behaviour stuffed into a YAML scalar is bad at all
three.

- The `behaviour` **frontmatter field is retained as a deprecated fallback** for files that already
  use it — exactly the shape ADR-008 uses for scalar `contract` beside `contracts[]`.
- **Text is never silently migrated between the two.** No existing file is rewritten on first save.
  A reader prefers the body when it has content and falls back to the field when it does not.

**This ratifies shipped behaviour rather than requesting new work.** M1 already implemented it:
`vousoir/shared/src/spec-store/resolve-spec-node.ts:44` — `resolveSpecNodeBehaviour` returns the
trimmed body when non-empty, otherwise `frontmatter.behaviour`, and writes nothing. So this is a
documentation change only. **It had to be settled before M3 builds the spec panel**, because a panel
that binds an editor to the wrong field is what would cause the silent migration this forbids.

### Context

This ADR mostly **ratifies code that already exists** rather than inventing a format. Two files in
the shipped tree already lock the shape:

`typings/vousoir/src/spec-node-frontmatter.ts` defines `specNodeFrontmatterSchema` with exactly these
fields: `id` (non-empty string), `title` (non-empty string), `parent` (non-empty string **or null**
for the tree root), `status` (the enum `unspecified | specified | building | built | verified`),
`behaviour` (optional string — note the British spelling in the shipped schema), `contract` (optional
string), `testCases` (optional array of `{ id, description, expected }`). Its file docblock states the
intent directly: *"the YAML header of one `.md` file under `.vousoir/spec/`."* It has golden-fixture tests
(`vousoir/shared/src/spec-node-frontmatter.test.ts`) that pass today.

`typings/vousoir/src/v6r-layout.ts` defines `V6R_ROOT_DIRNAME` (`'.v6r'` as shipped at recon,
`'.vousoir'` from M1 — see the amendment above) and `V6R_SUBDIRS` with
**exactly the five names** the brief reported — `spec`, `whiteboards`, `traces`, `docs`, `cache` —
plus the committed/gitignored split (`V6R_COMMITTED_SUBDIRS` = spec, whiteboards, traces, docs;
`V6R_GITIGNORED_SUBDIRS` = cache). `vousoir/shared/src/v6r-init.ts:34` scaffolds them by iterating
`Object.values(V6R_SUBDIRS)` rather than hardcoding, so the scaffolder cannot drift. Do not invent
new subdirectory names; add to `V6R_SUBDIRS` if one is genuinely needed.

The product requirement this serves is `vousoir-source-of-truth.md` Feature 10, "Portable Spec Files":
*"Guarantees the user's spec always exists as plain, human-readable files on their own disk —
viewable, editable, and version-controllable outside of Vousoir entirely"*, and *"the canvas is a
convenience, not a cage."* The parking lot at `:184` records markdown + YAML frontmatter as favoured
and leaves *"whether hierarchy is represented as nested folders vs. flat files with parent
references"* undecided. The shipped code answers **both**: `v6r-layout.ts:16` says *"nested folders
mirror the hierarchy"* while the frontmatter carries an explicit `parent` field. That redundancy is a
feature — the `parent` field survives a hand-move of a file between folders, which is exactly the
out-of-band editing Feature 10 promises — but it needs a reconciliation rule (see Consequences).

**Deviation from the milestone brief.** The brief said *"Persist as `.v6r` JSON."* A single opaque
JSON blob holding the whole model would break Feature 10: it is not human-readable at scale, a
one-node edit produces a whole-file git diff, and editing it by hand in another editor is
impractical. `vousoir-technical-spec.md:91` independently commits to the file-per-node shape — *"one
file per node, markdown + YAML frontmatter, directory structure mirroring the module hierarchy"* —
so this ADR follows two documents and the shipped code, and departs from one line of the brief.

One correction to the record: `vousoir-technical-spec.md:132` describes the data-at-rest folder as
`.vousoir/` containing `spec/`, `whiteboards/`, `vousoir.db`, and `worktrees/`. The shipped code used
`.v6r/` with five subdirectories and no `vousoir.db` or `worktrees/`. **On the folder name the
technical spec is now operative** — the 2026-07-24 amendment above renames the directory to
`.vousoir/`. On the folder *contents* the code remains operative and §3.5 is superseded.

### Decision

1. One markdown file per spec node, with YAML frontmatter validated by the **existing**
   `specNodeFrontmatterSchema`, under `.vousoir/spec/`, in nested folders mirroring the module hierarchy.
   The free-form markdown body below the frontmatter is prose the schema does not constrain — and it
   is the **canonical home for behaviour prose**, with the `behaviour` frontmatter field kept as a
   deprecated fallback (amendment, 2026-07-24).
2. The `.vousoir/` directory layout is whatever `V6R_SUBDIRS` says. New directories are added there
   first, never invented at a call site.
3. The `*.v6r` file that `registerCustomEditorProvider` binds to (ADR-001) is a **small project
   manifest** — project name, schema version, and a pointer to the spec directory — not the model.
   Opening it opens the canvas; the canvas reads the tree from `.vousoir/spec/`.
4. The node schema is `specNodeFrontmatterSchema` in `@vousoir/typings`. It is **extended in place**,
   never forked into a parallel model type — see **ADR-008**, which specifies exactly what M1 adds
   and what it deliberately refuses to rename.
5. Node **positions are never written to spec frontmatter**. They live in `.vousoir/layout.json` —
   see the ADR-003 amendment (2026-07-24), which moved them out of the wipeable `.vousoir/cache/`
   once manual placement made them user-authored data. The frontmatter rule is unchanged.
6. `.vousoir/layout.json` sits at the root of `.vousoir/` and is a **file, not a subdirectory**, so it
   is not a `V6R_SUBDIRS` member. `V6R_GITIGNORE_CONTENTS` is `cache/\n`, which does not match it, so
   it is committed by default. Whether that is right is **open** — see open question 7.
7. **The markdown body is canonical for behaviour prose** — decided 2026-07-24, see the amendment
   below.

### Consequences

- Git diffs are per-node. Renaming, re-nesting, or re-specifying one module touches one file.
- ~~A YAML parser becomes a real dependency at M3~~ — **it landed in M1, not M3** (`yaml@2.9.0`,
  PR #12), because the spec store had to read and write frontmatter before the spec panel existed.
  `PATCHES.md` D7 is closed. Two details survive the correction and are worth keeping straight: the
  JSON golden fixtures `vousoir/shared/src/fixtures/spec-node-frontmatter.{valid,invalid}.json` were
  **not** converted and are still JSON — what M1 added was a *separate* real-`.md` tree fixture at
  `vousoir/shared/src/fixtures/spec-tree/`. Both sets exist; both must grow with the schema.
- Folder position and the `parent` field can disagree after a hand-edit. **Rule: `parent` wins.** The
  folder tree is a human-navigability convenience; the field is the model. A mismatch should surface
  as a visible warning on the node, not a silent re-parent or a crash.
- `behaviour` (British) is the shipped field name and stays. Use it verbatim in code; American
  "behavior" is fine in prose and UI labels.
- Two homes exist for behaviour prose during the deprecation window. Write the precedence rule once —
  it already exists, as `resolveSpecNodeBehaviour` — and do not re-derive it per consumer. **M3's spec
  panel must edit the body, not the field**, or it will migrate text the amendment forbids migrating.
- `contract` is a single optional string today. ADR-008 adds a typed `contracts[]` array beside it
  and keeps the scalar accepted for back-compat.
- `.vousoir/cache/` is gitignored by the scaffolder (`V6R_GITIGNORED_SUBDIRS`). Nothing that must survive
  a clone may live there.

### Rejected alternatives

- **A single `.v6r` JSON document holding the whole model (the milestone brief).** Rejected: breaks
  Feature 10's portability guarantee — not hand-editable, not meaningfully diffable, one edit rewrites
  the file. It would also duplicate a schema that already exists and is tested.
- **Flat files with `parent` references and no folder nesting.** Rejected: `v6r-layout.ts:16` already
  commits to nested folders, and folders are what make the tree navigable in a plain file browser —
  which is the point of Feature 10. The `parent` field is kept anyway as the authority.
- **SQLite as the spec store, files as an export.** Rejected outright by Feature 10 — *"nothing should
  be locked away in a format only Vousoir can read."* SQLite's place is `.vousoir/cache/`, for derived
  data only (`v6r-layout.ts:24`).
- **Redefining the frontmatter schema for M1.** Rejected: it exists, it is tested, and
  `CONTRIBUTING.md:43-48` forbids redeclaring a shared shape.

### Evidence

- `typings/vousoir/src/spec-node-frontmatter.ts:27-38` — `export const specNodeFrontmatterSchema =
  z.object({ id: …, title: …, parent: z.string().min(1).nullable(), status: specNodeStatusSchema,
  behaviour: z.string().optional(), contract: z.string().optional(), testCases:
  z.array(specNodeTestCaseSchema).optional() });`
- `typings/vousoir/src/spec-node-frontmatter.ts:2-3` — *"the YAML header of one `.md` file under
  `.vousoir/spec/` (work order §8). Nested folders under `spec/` mirror the module hierarchy"*.
- `typings/vousoir/src/spec-node-frontmatter.ts:15` — `export const specNodeStatusSchema =
  z.enum(['unspecified', 'specified', 'building', 'built', 'verified']);`
- `typings/vousoir/src/spec-node-frontmatter.ts:19-23` — `specNodeTestCaseSchema = z.object({ id, description, expected })`.
- `typings/vousoir/src/v6r-layout.ts:12` — `export const V6R_ROOT_DIRNAME = '.v6r' as const;` — the
  value becomes `'.vousoir'` with M1 per the amendment above; the symbol name is unchanged.
- `typings/vousoir/src/v6r-layout.ts:40-41` — `export const V6R_GITIGNORE_CONTENTS =
  `${V6R_SUBDIRS.cache}/\n`;` — the scaffolded `.gitignore` ignores `cache/` and nothing else.
- `typings/vousoir/src/v6r-layout.ts:14-26` — *"The five subdirectories under `.vousoir/`, keyed by their
  role."* `spec`, `whiteboards`, `traces`, `docs`, `cache`.
- `typings/vousoir/src/v6r-layout.ts:16` — *"Module tree: one .md (YAML frontmatter) node per file,
  nested folders mirror the hierarchy."*
- `typings/vousoir/src/v6r-layout.ts:24` — *"SQLite index over specs+traces, layout cache — derived
  data, regenerable."*
- `typings/vousoir/src/v6r-layout.ts:32,35` — `V6R_COMMITTED_SUBDIRS = ['spec', 'whiteboards',
  'traces', 'docs']`; `V6R_GITIGNORED_SUBDIRS = ['cache']`.
- `vousoir/shared/src/v6r-init.ts:34` — `await Promise.all(Object.values(V6R_SUBDIRS).map((subdir) =>
  mkdir(join(v6rRoot, subdir), { recursive: true })));`
- `vousoir-source-of-truth.md:157` — *"Guarantees the user's spec always exists as plain,
  human-readable files on their own disk — viewable, editable, and version-controllable outside of
  Vousoir entirely."*
- `vousoir-source-of-truth.md:164` — *"the canvas is a convenience, not a cage … nothing should be
  locked away in a format only Vousoir can read."*
- `vousoir-source-of-truth.md:184` — *"Exact spec file format (markdown + YAML frontmatter was
  favored; exact schema, and whether hierarchy is represented as nested folders vs. flat files with
  parent references, is undecided)."*
- `vousoir-source-of-truth.md:186` — *"Contract verification mechanics per contract type (module API,
  service API, DB schema)."*
- `vousoir-technical-spec.md:91` — *"one file per node, markdown + YAML frontmatter, directory
  structure mirroring the module hierarchy"*.
- `vousoir/PATCHES.md:199-211` — D7: *"no YAML library is a declared dependency of any Vousoir
  package … When a real spec reader lands in a later work order, it will bring its own YAML dependency
  and can re-point these fixtures at `.md` files."*
- `vousoir/CONTRIBUTING.md:43-47` — *"Every cross-package data shape — service manifests, trace
  events, spec frontmatter, `.v6r` layout, future MCP tool payloads — is defined in `typings/vousoir`
  … **No package redeclares a shared shape locally.**"*

---

## ADR-003 — Hand-roll recursive tree layout; no ELK or dagre

**Status:** Accepted (2026-07-24) — **amended 2026-07-24** (revisit trigger; manual placement)
**Deciders:** orchestrating agent; approved with a revisit trigger, and amended, by the user on PR #11

### Amendment (2026-07-24) — revisit trigger, and manual placement

#### 1. Approved, with a named revisit trigger

The hand-rolled layout stands. The user's reasoning, recorded because it names the condition under
which the decision flips: *"the hierarchy is a tree, but contract links (this base branch is
`phase-2-links`) create cross-edges. If/when the canvas renders contract edges and hand-rolled routing
gets ugly, that's the point to reconsider a routing library — not before."*

So the trigger is **both** conditions, not either: the canvas renders contract edges **and**
hand-rolled routing has gotten ugly. Not before then. This sharpens the Consequences bullet below
that already anticipated it — the strict-tree argument holds for *containment*, and contract links are
the cross-edges that would break it.

#### 2. Positions are no longer purely derived data

Resolves open question 5. **Manual placement is supported**: the user may place nodes freely.

- Auto-layout runs as an **explicit auto-tidy command**. It **must never silently override** a user's
  placement.
- Positions move out of the wipeable `.vousoir/cache/` into a dedicated **`.vousoir/layout.json`**, so
  clearing the cache cannot destroy user work. The Decision below classified positions as regenerable;
  once a human authors them, they are not.
- **Unchanged and still binding: positions never go in spec frontmatter.** The Decision's rationale for
  that rule survives this amendment intact — layout churn in every spec file's git diff would defeat
  the Portable Spec Files requirement ADR-002 serves. Only the *storage location and regenerability*
  changed, not the frontmatter rule. ADR-008's "do not add `position`" therefore also stands.
- `.vousoir/layout.json` is a file, not a `V6R_SUBDIRS` member, and `V6R_GITIGNORE_CONTENTS` is
  `cache/\n` — so it is **committed by default unless someone acts**. Whether it should be is open;
  see open question 7.

#### Supersedes: Feature 3 auto-layout-on-every-mutation

**A future reader must not follow Feature 3 on this point.** Two documents state the opposite
requirement, and the user overruled both, knowingly, on 2026-07-24 while reviewing PR #11.

| Statement | Source | Status |
|---|---|---|
| *"This has to work invisibly, not be a separate 'clean up' action the user has to remember to run."* | `vousoir-source-of-truth.md:86` (Feature 3, "Auto-Layout") | **Superseded.** An explicit auto-tidy command is exactly the separate clean-up action this forbids. |
| *"Auto-layout must re-run on **every** structural mutation … manual tidying is explicitly forbidden."* | M2 milestone brief | **Superseded** on both clauses. |
| *"Manual placement with a 'tidy' button. Rejected."* | this ADR's own Rejected alternatives, below | **Reversed.** It is now the decision. |
| *"whether deliberate manual placement should ever be silently overridden"* | `vousoir-source-of-truth.md:188` (parking lot) | **Resolved: never silently.** |
| *"User's intentional manual placement (if any) is respected where reasonably possible."* | `vousoir-source-of-truth.md:84` | **Survives, strengthened** — from "where reasonably possible" to always. |
| *"the user never has to manually tidy the diagram"* | `vousoir-source-of-truth.md:79` | **Survives for the default path** — untouched nodes still auto-arrange — but weakened: a user who places a node owns its position until they invoke auto-tidy. |

Note the two sources say different things, and the difference matters to whoever edits them. The brief
asserted a hard rule ("every mutation", "explicitly forbidden") that Feature 3 never actually stated;
this ADR's Context already recorded that overstatement. Feature 3's own text is softer and mostly
survives — `:86` is the one line it loses.

**`vousoir-source-of-truth.md` Feature 3 is now stale and needs its author's edit.** It is the product
source-of-truth document and this ADR cannot amend it. Until `:86` is rewritten, that document and this
one disagree, and **this one is operative** for M2.

**This ADR overrules an already-made decision, and that must be stated plainly.**
`vousoir-technical-spec.md` is the Stage 3 tech-stack document, and it selected the canvas stack:
`:65` lists *"Canvas | React + React Flow, ELK/dagre auto-layout, in a webview panel | built"*, and
`:122` repeats it — *"**Canvas panel** (webview: React + React Flow + ELK auto-layout)"*. This is not
a parking-lot maybe. `vousoir-source-of-truth.md:183` also records *"React + React Flow with
dagre/elk was the leading candidate for auto-layout."* Choosing a hand-rolled layout departs from a
selection the user has already made, and the argument below has to be good enough to justify that.

The argument is the shape of the data. Vousoir's model is a **strict tree**: `specNodeFrontmatterSchema`
gives every node exactly one `parent`, nullable only at the root. There are no arbitrary edges and no
cycles. ELK and dagre are layered-graph engines — their value is edge routing and crossing
minimisation in general DAGs, problems a strict tree does not have. For a nested-box tree layout, the
whole algorithm is a post-order walk that measures each subtree's bounding box and an outer pass that
places children inside their parent. That is on the order of 150 lines, it is deterministic, and it is
trivially testable in isolation with vitest — which matters, because everything else on the canvas
lives behind a webview `postMessage` seam and is much harder to unit-test.

The second argument is scale. `vousoir-source-of-truth.md:45` frames v1 as *"A weekend/side project
built by one founder for personal use plus a few collaborators … Optimize for 'useful and shippable
fast,' not for scale, polish, or enterprise readiness."* `:27` adds *"for v1: bias toward simple and
shippable over robust or polished."*

The dependency-obligation argument in the brief **does not hold, and should not be used**. The claim
was that adding a runtime dependency requires a `cgmanifest.json` entry and `ThirdPartyNotices.txt`
upkeep. Checked: root `cgmanifest.json` covers binary/vendored components (chromium, ffmpeg, nodejs,
electron, …); `.github/workflows/vousoir-ci.yml` runs only lint, dep-check, typecheck, test, and a
code-oss build; `build/hygiene.ts` contains no cgmanifest check at all; `build/filters.ts:36-37` only
*excludes* `ThirdPartyNotices.txt` from hygiene filters; and `gulpfile.editor.ts:160-161` reads two
specific vendored cgmanifests for monaco version pinning only. Decisively, the Vousoir layer already
ships `zod` as a runtime dependency plus `vitest`, `eslint`, `dependency-cruiser`, and `typescript` as
dev dependencies, and **none of them appear in `cgmanifest.json`**. There is no mechanical gate. The
real cost of a dependency here is the shared `vousoir/pnpm-lock.yaml` and the surface it adds — a fair
argument, but a smaller one than claimed.

The auto-layout trigger claim in the brief also needs correcting. The brief said *"Auto-layout must
re-run on **every** structural mutation … manual tidying is explicitly forbidden."* Feature 3
(`:77-86`) says something weaker and more careful: `:79` — *"Keeps the canvas visually clean
automatically as nodes are added or restructured, so the user never has to manually tidy the
diagram"*, and `:84` — *"User's intentional manual placement (if any) is **respected where reasonably
possible**."* The parking lot at `:188` explicitly leaves open *"Auto-layout trigger and override
behavior (every node add vs. manual trigger, and whether deliberate manual placement should ever be
silently overridden)."* So: the user must never be *required* to tidy; manual placement is not
forbidden and its override behaviour is an open question, not a settled rule. **Settled 2026-07-24 —
see the amendment above.**

### Decision

Implement auto-layout as a hand-rolled recursive nested-box algorithm in the extension, on the order
of 150 lines, with no layout-library dependency. Keep it a **pure function** — tree in, positions out
— with no DOM or `vscode` imports, so it unit-tests directly under vitest.

Run it on **structural** mutations only: node added, node deleted, node re-parented, node renamed if
the label changes measured width. Do **not** run it on spec-text edits.

> **Amended 2026-07-24.** The paragraph below is superseded on two points: auto-layout now runs as an
> explicit auto-tidy command rather than on every structural mutation, and positions live in
> `.vousoir/layout.json`, not `.vousoir/cache/`. Its frontmatter rule and its rationale for that rule
> stand. See the amendment above.

**Node positions are derived data and are never written to spec frontmatter.** They are computed
from the tree on every structural mutation and, if cached at all, cached under `.vousoir/cache/`. The
existing design already makes this call: `v6r-layout.ts:24` describes that directory as *"SQLite
index over specs+traces, **layout cache** — derived data, regenerable"*, and `:35` puts `cache` in
`V6R_GITIGNORED_SUBDIRS` while `:32` commits `spec`, `whiteboards`, `traces` and `docs` to git. So
the folder layout already classifies layout as regenerable, gitignored, non-authored data — which is
exactly right for a product where auto-layout is the default behaviour. Writing positions into
frontmatter would put churn into every spec file on every layout pass, producing git diffs that are
noise rather than intent, and directly undermining the Portable Spec Files requirement that ADR-002
serves. The milestone brief's `position` field is therefore **dropped from the M1 model surface**
(ADR-008).

### Consequences

- One less dependency in `vousoir/pnpm-lock.yaml`, and no React/React Flow runtime in the webview for
  M2 — plain DOM or SVG is sufficient for nested boxes.
- The layout function is the most testable unit on the canvas. Treat its tests as the M2 safety net.
- **Debounce to structural mutations only, or typing in the spec panel will thrash the canvas.** Every
  keystroke in the M3 behaviour field is a model mutation but not a structural one. Route mutations
  through a single classifier that returns `structural | content` and let only `structural` reach the
  layout pass. This is the single highest-risk detail in M2/M3.
- Edge rendering between non-parent/child nodes (a module contracting with a distant sibling) has no
  library to fall back on. Deferred: the canvas draws containment first. If arbitrary edges become a
  requirement, that is the moment to re-open this ADR — a general-graph requirement is exactly what
  ELK exists for. **This is now the named revisit trigger** (amendment, part 1): contract edges are
  those cross-edges.
- ~~Manual node placement is not supported in M2.~~ **Superseded 2026-07-24** — manual placement is
  supported, and auto-layout may not silently override it. The original reasoning (`:188` left the
  override semantics undecided, so shipping the wrong answer was worse than shipping none) held only
  until the user decided; they have.
- If the tree grows past a few hundred nodes and layout becomes visibly slow, revisit. Nothing here
  precludes swapping in ELK behind the same pure-function signature.

### Rejected alternatives

- **ELK (`elkjs`) or dagre, as selected in `vousoir-technical-spec.md:65`.** Rejected for M2 on the
  grounds that the model is a strict tree, not a general graph, and that these libraries' core value —
  crossing minimisation and edge routing — is unused. The rejection is of a real prior decision and
  should be reviewed by the user. It is also the cheapest decision here to reverse: swap the
  implementation behind the same pure-function signature.
- **React + React Flow for the canvas.** Rejected for M2 as a consequence of the above — React Flow's
  value is the node/edge interaction model and its layout plugins. Nested containment boxes need
  neither. Reconsider if M2 needs pan/zoom/selection behaviour rich enough that hand-rolling it costs
  more than the dependency.
- ~~**Manual placement with a "tidy" button.** Rejected: `:86` is explicit — *"This has to work
  invisibly, not be a separate 'clean up' action the user has to remember to run."*~~
  **Reversed 2026-07-24 — this is now the decision.** The user overruled `:86` knowingly. See the
  amendment above; `:86` is superseded and Feature 3 is stale.

### Evidence

- `vousoir-technical-spec.md:65` — *"| Canvas | React + React Flow, ELK/dagre auto-layout, in a
  webview panel | built |"*
- `vousoir-technical-spec.md:122` — *"**Canvas panel** (webview: React + React Flow + ELK
  auto-layout)"*
- `vousoir-source-of-truth.md:183` — *"Canvas implementation stack (React + React Flow with dagre/elk
  was the leading candidate for auto-layout)."*
- `vousoir-source-of-truth.md:79` — *"Keeps the canvas visually clean automatically as nodes are added
  or restructured, so the user never has to manually tidy the diagram."*
- `vousoir-source-of-truth.md:84` — *"User's intentional manual placement (if any) is respected where
  reasonably possible."*
- `vousoir-source-of-truth.md:86` — *"This has to work invisibly, not be a separate 'clean up' action
  the user has to remember to run."*
- `vousoir-source-of-truth.md:188` — *"Auto-layout trigger and override behavior (every node add vs.
  manual trigger, and whether deliberate manual placement should ever be silently overridden)."*
- `vousoir-source-of-truth.md:45` — *"A weekend/side project built by one founder for personal use
  plus a few collaborators … Optimize for 'useful and shippable fast,' not for scale, polish, or
  enterprise readiness."*
- `vousoir-source-of-truth.md:27` — *"For v1: bias toward simple and shippable over robust or
  polished — this is a weekend-scale project, not an enterprise product."*
- `typings/vousoir/src/spec-node-frontmatter.ts:30-31` — *"Id of the parent node, or `null` for the
  tree root."* `parent: z.string().min(1).nullable(),` — the strict-tree guarantee.
- **Negative finding — dependency obligation is not enforced:** `cgmanifest.json` contains no entry
  for `zod`, `vitest`, or `dependency-cruiser` (grep returns nothing); `build/hygiene.ts` contains no
  `cgmanifest`/`ThirdPartyNotices` reference; `.github/workflows/vousoir-ci.yml` runs only
  `pnpm run lint:strict`, `dep-check`, `typecheck`, `test`, and `npm run compile`.
- `typings/vousoir/src/v6r-layout.ts:23-25` — `/** SQLite index over specs+traces, layout cache —
  derived data, regenerable. */ cache: 'cache',` — layout is already classified as derived data.
- `typings/vousoir/src/v6r-layout.ts:32,35` — `V6R_COMMITTED_SUBDIRS = ['spec', 'whiteboards',
  'traces', 'docs']` / `V6R_GITIGNORED_SUBDIRS = ['cache']` — `cache` is the one gitignored subdir,
  so anything stored there is by construction regenerable and produces no git churn.

---

## ADR-004 — Ship webview assets as extension files via `asWebviewUri`

**Status:** Accepted (2026-07-24)
**Deciders:** orchestrating agent, pending user review

### Context

The canvas is a webview (ADR-001, and `vousoir-technical-spec.md:122`). Webviews cannot load
`file:` URIs directly; `vscode.d.ts:10019-10029` documents the conversion — *"Webviews cannot directly
load resources from the workspace or local file system using `file:` uris. The `asWebviewUri` function
takes a local `file:` uri and converts it into a uri that can be used inside of a webview to load the
same resource"*. The permitted roots are declared by `WebviewOptions.localResourceRoots`
(`:9922`), documented at `:9916` as *"Root paths from which the webview can load local (filesystem)
resources using uris from `asWebviewUri`"*.

Two precedents exist in-tree. `extensions/media-preview/src/audioPreview.ts` is the upstream pattern:
`:109-111` wraps the conversion in a helper — `return
this._webviewEditor.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionRoot, ...parts));` — and
`:77`/`:92` reference real files under the extension's `media/` folder. Its CSP is a single meta tag
at `:79` with a per-render nonce generated at `:63` and `webview.cspSource` read at `:65`:

```
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: ${cspSource}; media-src ${cspSource}; script-src 'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}';">
```

The second precedent is Vousoir's own: `extensions/vousoir-core/src/panel/webview-html.ts:11-16`
already builds a nonce CSP with `crypto.randomBytes(16).toString('base64')` and
`default-src 'none'; style-src 'nonce-…'; img-src ${webview.cspSource}`, with a docblock at `:3-5`
stating *"Follows webview security norms - strict CSP with a per-render nonce, no remote content"*.
The canvas needs the same shape plus a `script-src 'nonce-…'` entry, because unlike the placeholder
panel it will run scripts.

The extension is already bundled by esbuild (`extensions/vousoir-core/esbuild.mts`, `main:
./dist/extension.js`), so the extension-host bundle is handled. The webview bundle is separate: it is
loaded by URL from the webview's own document, not `require`d by the host.

### Decision

Canvas JavaScript and CSS ship as **real files under `extensions/vousoir-core/media/`** (beside the
existing `vousoir-icon.svg`) and are loaded with:

```ts
webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'canvas.js'))
```

with `webviewOptions.localResourceRoots` scoped to `[vscode.Uri.joinPath(context.extensionUri,
'media')]`.

The webview HTML carries a CSP meta tag following the two in-tree precedents, with a fresh nonce per
render:

```
default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';
```

Every `<script>` and inline `<style>` carries `nonce="${nonce}"`. No `unsafe-inline`, no
`unsafe-eval`, no remote origin in any directive. Nothing is fetched from a CDN or any network host,
at build time or run time.

### Consequences

- The canvas works offline and in an air-gapped checkout. No CDN outage can break the editor.
- `localResourceRoots` must include `media/` explicitly. Omitting it produces a silent load failure
  with no console error in some cases — check the webview devtools first when the canvas renders blank.
- Adding a `script-src` nonce means every script must be nonce-tagged. A script injected at runtime
  without the nonce will be blocked; that is the intended behaviour, not a bug to work around by
  loosening CSP.
- The canvas bundle needs its own esbuild entry point (browser platform, IIFE) alongside the existing
  extension-host entry in `esbuild.mts`. Two outputs, one config.
- The nonce must be regenerated per render, not module-scoped. `webview-html.ts:11` generates it
  inside the builder function; follow that.
- `vscode.d.ts:10029`'s `asWebviewUri` returns a `Uri`; `audioPreview.ts:104` and `:106` call
  `.toString()` before interpolating into HTML, and `:77` additionally passes it through an attribute
  escaper. Do the same.

### Rejected alternatives

- **CDN-hosted libraries (`<script src="https://unpkg.com/…">`).** Rejected: requires a network
  origin in `script-src`, defeats the `default-src 'none'` baseline, breaks offline use, and makes the
  editor's behaviour depend on a third party's uptime and integrity.
- **Inlining all JS/CSS into the HTML string.** Rejected: it works and is CSP-clean, but it makes the
  canvas source unreadable, kills source maps, and puts a multi-KB template literal into a file
  governed by the 300-line warning / 500-line error caps.
- **`data:` URIs for scripts.** Rejected: `script-src data:` is a well-known CSP bypass and the whole
  point of the nonce is to avoid it.
- **Serving assets from a local HTTP server in the extension host.** Rejected: adds a port, a
  lifecycle, and a security surface to solve a problem `asWebviewUri` already solves.

### Evidence

- `src/vscode-dts/vscode.d.ts:10029` — `asWebviewUri(localResource: Uri): Uri;`
- `src/vscode-dts/vscode.d.ts:10019-10023` — *"Webviews cannot directly load resources from the
  workspace or local file system using `file:` uris. The `asWebviewUri` function takes a local `file:`
  uri and converts it into a uri that can be used inside of a webview to load the same resource"*.
- `src/vscode-dts/vscode.d.ts:9916,9922` — *"Root paths from which the webview can load local
  (filesystem) resources using uris from `asWebviewUri`"* / `readonly localResourceRoots?: readonly
  Uri[];`
- `src/vscode-dts/vscode.d.ts:10032-10034` — *"Content security policy source for webview resources.
  This is the origin that should be used in a content security policy rule"* (`cspSource`).
- `extensions/media-preview/src/audioPreview.ts:63,65` — `const nonce = generateUuid();` / `const
  cspSource = this._webviewEditor.webview.cspSource;`
- `extensions/media-preview/src/audioPreview.ts:79` — `<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src data: ${cspSource}; media-src ${cspSource}; script-src
  'nonce-${nonce}'; style-src ${cspSource} 'nonce-${nonce}';">`
- `extensions/media-preview/src/audioPreview.ts:92` — `<script
  src="${escapeAttribute(this.extensionResource('media', 'audioPreview.js'))}"
  nonce="${nonce}"></script>`
- `extensions/media-preview/src/audioPreview.ts:109-111` — `private extensionResource(...parts:
  string[]) { return this._webviewEditor.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionRoot,
  ...parts)); }`
- `extensions/vousoir-core/src/panel/webview-html.ts:11-16` — `const nonce =
  crypto.randomBytes(16).toString('base64'); const csp = [\`default-src 'none'\`, \`style-src
  'nonce-${nonce}'\`, \`img-src ${webview.cspSource}\`].join('; ');`
- `extensions/vousoir-core/src/panel/webview-html.ts:3-5` — *"Follows webview security norms - strict
  CSP with a per-render nonce, no remote content"*.
- `extensions/vousoir-core/media/vousoir-icon.svg` — the `media/` folder already exists and already
  ships assets.

---

## ADR-005 — Dispatch Claude Code from the extension host via `child_process`

**Status:** Accepted (2026-07-24) — **amended 2026-07-24** (transient run status; prompt via stdin)
**Deciders:** orchestrating agent; amended after M5 shipped (PR #14)

### Context

M5 hands a compiled work order to a coding agent and reflects the result on the canvas —
`vousoir-source-of-truth.md` Feature 5: *"Node on the canvas visually reflects its status (spec'd →
building → built)"* and *"the canvas should stay the single place the user looks at to understand the
state of the whole project."* The node status enum appears to model this:
`specNodeStatusSchema` = `unspecified | specified | building | built | verified`. **The amendment below
rejects that reading** — dispatch drives a transient run status and writes no spec file; whether a
completed run should persist `built` is left open.

Extension-host code is Node and can `require('node:child_process')`. Renderer and core workbench code
cannot. Since ADR-001 puts the canvas in an extension anyway, dispatch is a direct `spawn` from code
that is already running — no new service, no new IPC channel, no shared-process registration.

The pattern is already implemented in this repo.
`extensions/vousoir-core/src/service-host/service-host-process.ts` spawns the service host,
line-buffers its stdout, validates each line against a zod schema, forwards stderr to an
`OutputChannel`, and implements a graceful-then-`SIGKILL` disposal ladder. M5's dispatcher is the same
shape with a different child.

**The hard constraint.** `vousoir/PATCHES.md` decision A2 (`:271`) reads: *"`ELECTRON_RUN_AS_NODE=1`
is mandatory when spawning services … `service-supervisor.ts` spawned `process.execPath`, which inside
the VS Code extension host is the **Electron binary**, not node — in the real app that launches an
entire Electron instance instead of the service."* And the trap, at `:276`: *"The unit tests missed it
because vitest runs under plain Node, where `process.execPath` *is* node."* The constant is canonical
in `typings/vousoir/src/service-host-protocol.ts:70` as `ELECTRON_RUN_AS_NODE_ENV_VAR`, whose docblock
adds *"Harmless under plain Node, and inherited by grandchildren through the environment."*

The `claude` CLI is a distinct case from spawning `process.execPath`: it is a separate executable on
`PATH`, so `process.execPath` is not involved and the Electron-binary substitution does not directly
apply to the `claude` process itself. But `ELECTRON_RUN_AS_NODE=1` must still be set in its
environment, because A2's inheritance note cuts both ways — the extension host's own env may already
be Electron-flavoured, and any Node process `claude` itself spawns inherits whatever we pass. Setting
it is free and omitting it is a class of bug that no plain-Node test will ever catch.

`claude` presence verified on this machine: `claude --version` returns `2.1.219 (Claude Code)`. That
is a fact about one developer machine, not a deployment guarantee.

### Decision

M5 dispatches by spawning the `claude` CLI **directly from extension-host code** using
`node:child_process`:

```ts
// The work order goes to STDIN, never argv — see the amendment below.
const child = spawn('claude', [
  '--print', '--input-format', 'text', '--output-format', 'stream-json',
  '--verbose', '--permission-mode', 'acceptEdits',
], {
  cwd: workspaceRoot,
  env: { ...process.env, [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
child.stdin.end(workOrder);
```

stdout and stderr stream to the "Vousoir" `OutputChannel` and drive a **transient run status**. No new
IPC service, no shared-process contribution, no workbench-side dispatch path.

### Amendment (2026-07-24) — run status is transient; the prompt goes to stdin

**1. Run status is in-memory and event-only. It is not the frontmatter enum.** This ADR originally
said dispatch drives *"`specified → building → built | failed`"* — those are `specNodeStatusSchema`
values, which live in a **committed spec file**. Nothing in M5 writes a spec file. The transient run
status is `DispatchRunStatus = 'idle' | 'running' | 'done' | 'failed'`
(`typings/vousoir/src/dispatch.ts:14`); **cancellation is not a fifth value** — a cancelled run settles
as `failed` with `cancelled: true` on the result.

The reason is recoverability: a crashed or cancelled run that had written `building` into a committed
`.md` would leave that file stuck in a lie, with nothing to distinguish it from a run still in flight.
Transient status cannot get stuck, because it does not survive the process.

**Deliberately not decided:** whether a *successful* run should persist `built` to the spec file. M5
raised it rather than settling it — the trace already records what happened, and whether `built` means
*"an agent claimed success"* or *"the tests actually pass"* is Feature 6 / Feature 8 territory.

**2. The work order goes to stdin, never argv.** `--input-format text` under `--print` makes the CLI
read its prompt from stdin. Passing it as an argv positional works until it does not: **Windows caps a
command line at ~32,768 characters**, and a work order carrying several contracts plus ancestor and
neighbour context reaches that easily. The failure mode is a truncated or rejected prompt at some
unpredictable spec size. **Do not "simplify" this back to `['-p', workOrder]`.**

**3. Only `ELECTRON_RUN_AS_NODE` is set — not `PARENT_PID_ENV_VAR`.** The parent-pid watchdog exists so
a long-lived **supervised service** self-exits when orphaned. `claude` is a **short-lived job**, and a
run that is already writing files should be allowed to finish even if the editor closes. Both spawn
snippets in these docs now agree on this.

**4. `--verbose` is required** alongside `--print --output-format stream-json` in Claude CLI
**2.1.219**. Without it the CLI rejects the combination. Harmless if a future version drops the
requirement — but it is a **version coupling**, and the symptom on upgrade is an empty trace, which
does not point at its own cause. See debt D12.

**`ELECTRON_RUN_AS_NODE: '1'` is set on every spawn. This is not optional.**

Before the first spawn, probe for `claude` on `PATH`. If it is absent, fail with a named, actionable
message in the output channel and leave the node's status unchanged — the same graceful-degradation
posture `PATCHES.md` L1 takes for the packaged-build service-host gap (*"the failure is loud, not
silent"*).

### Consequences

- **A plain-Node unit test cannot catch a missing `ELECTRON_RUN_AS_NODE`.** Under vitest,
  `process.execPath` is node and the spawn succeeds either way. The only reliable checks are (a) a
  unit test asserting the env var is present in the options object passed to `spawn`, and (b) a manual
  run inside the real shell. Write (a); do not skip (b).
- An entire IPC layer is removed from the design. No `IVousoirDispatchService`, no `registerSingleton`,
  no proxy, no core patch.
- Long-running dispatch is tied to extension-host lifetime. If the host restarts, running `claude`
  processes are orphaned. Mitigation already exists in-tree: `PARENT_PID_ENV_VAR`
  (`service-host-protocol.ts:61`) exists exactly for parent-watchdog self-exit. Reuse the pattern; do
  not invent a second one.
- `--permission-mode acceptEdits` lets the agent write files without prompting. That is the point of
  unattended dispatch, and it is also a real blast radius. `vousoir-technical-spec.md:95` designs the
  harness manager around *"Creates a worktree per run"* — worktree isolation is the eventual answer.
  M5 runs in the user's workspace; say so in the UI before the first dispatch.
- `claude -p` billing mode is unsettled. `vousoir-technical-spec.md:111` records that *"Anthropic
  announced that headless (`claude -p` / Agent SDK) usage would move to a separate metered credit pool
  on 2026-06-15, then paused that change"*, and designs for two user-selectable modes. M5 ships
  headless only; the interactive-PTY mode is the documented escape hatch if billing changes.
- Structured output is available and should be used when M5 needs more than a pass/fail:
  `vousoir-technical-spec.md:113` — *"`claude -p --output-format stream-json` — clean structured
  events"*. That output feeds `.vousoir/traces/` later (`v6r-layout.ts:20`).

### Rejected alternatives

- **A workbench service in `src/vs/workbench/services/vousoir/`.** Rejected: `core-not-import-vousoir`
  blocks it from importing the model (ADR-001), and it would need core patches plus an IPC hop to
  reach the Node capability the extension host already has.
- **Spawning through the existing `service-host` supervisor.** Rejected for M5: `service-host` is a
  supervisor for long-lived Vousoir services with a fixed health/shutdown protocol
  (`service-host-protocol.ts:31-34` — only `health` and `shutdown` requests exist). An agent run is a
  short-lived job with a streaming event feed, not a supervised daemon. Forcing it through that
  protocol means extending the wire format for a use case it was not designed for. Revisit at the
  harness-manager service (`vousoir-technical-spec.md:95`), which is post-M6.
- **A VS Code terminal (`window.createTerminal`) instead of `spawn`.** Rejected for M5: the extension
  cannot read a terminal's output, so node status could not be driven from it. It is the right answer
  for the *interactive* mode at `:114` and should be kept in mind for that.
- **Anthropic API calls instead of the CLI.** Rejected: it re-implements Claude Code's tool loop,
  changes the billing model, and discards the harness-adapter vendor-neutrality the technical spec
  builds on (`:84`).

### Evidence

- `vousoir/PATCHES.md:271` — *"### A2 — `ELECTRON_RUN_AS_NODE=1` is mandatory when spawning services"*
- `vousoir/PATCHES.md:273-276` — *"`service-supervisor.ts` spawned `process.execPath`, which inside the
  VS Code extension host is the **Electron binary**, not node — in the real app that launches an entire
  Electron instance instead of the service. The unit tests missed it because vitest runs under plain
  Node, where `process.execPath` *is* node."*
- `vousoir/PATCHES.md:278-280` — *"Every spawn in the chain must set `ELECTRON_RUN_AS_NODE: '1'`. It
  is inherited through the env … it is harmless under plain Node."*
- `typings/vousoir/src/service-host-protocol.ts:66-70` — *"Inside the VS Code extension host
  `process.execPath` is the ELECTRON binary, not node — spawning it without this launches a whole
  Electron instance instead of a Node process."* / `export const ELECTRON_RUN_AS_NODE_ENV_VAR =
  'ELECTRON_RUN_AS_NODE' as const;`
- `typings/vousoir/src/service-host-protocol.ts:61` — `export const PARENT_PID_ENV_VAR =
  'VOUSOIR_PARENT_PID' as const;`
- `extensions/vousoir-core/src/service-host/service-host-process.ts:20` — `import { spawn, type
  ChildProcessByStdio } from 'node:child_process';` — Node APIs are available in the extension host.
- `extensions/vousoir-core/src/service-host/service-host-process.ts:40-48` — the working spawn:
  `spawn(process.execPath, [entryPath, servicesRoot], { env: { ...process.env,
  [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1', [PARENT_PID_ENV_VAR]: String(process.pid) }, stdio: ['pipe',
  'pipe', 'pipe'], windowsHide: true })`
- `extensions/vousoir-core/src/service-host/service-host-process.ts:121-134` — the graceful-then-kill
  disposal ladder to copy.
- `typings/vousoir/src/spec-node-frontmatter.ts:15` — the `building | built` states. **Dispatch does
  not drive these** (amendment): they are committed spec-file values; run status is transient.
- `typings/vousoir/src/dispatch.ts:14` — `export type DispatchRunStatus = 'idle' | 'running' | 'done' |
  'failed';` — the transient enum, with cancellation carried as `cancelled: true` on the result.
- `vousoir-source-of-truth.md:107` — *"Node on the canvas visually reflects its status (spec'd →
  building → built)."*
- `vousoir-technical-spec.md:111` — *"**Claude Code adapter (v1):** drives the `claude` CLI. Two
  modes, user-selectable, because of live billing uncertainty"*.
- `vousoir-technical-spec.md:113` — *"**Headless mode:** `claude -p --output-format stream-json` —
  clean structured events, best for unattended runs."*
- `vousoir/PATCHES.md:321-322` — L1 mitigation posture: *"the extension logs a clear diagnostic naming
  the resolved path and stating that packaged builds are unsupported, then degrades gracefully — the
  failure is loud, not silent."*
- Verified on this machine: `claude --version` → `2.1.219 (Claude Code)`.

---

## ADR-006 — The MCP server is a standalone stdio node script, not in-process

**Status:** Accepted (2026-07-24)
**Deciders:** orchestrating agent, pending user review

### Context

M6's MCP server serves `vousoir-source-of-truth.md` Feature 9, "Agent-Readable Interface": *"Makes
the entire spec — every node's behavior, contract, and test cases — queryable by any AI agent the user
is working with, not just through the canvas UI"*, so that *"the agent should be able to read the
project's own spec directly, the same way the user reads it off the canvas."*

An MCP stdio server launched by an external client is, mechanically, a process that reads JSON from
stdin, reads and writes files, and writes JSON to stdout. It never needs the workbench. Putting it in
the renderer would mean the external `claude` process talks to the workbench which talks to the disk —
an IPC hop that buys nothing, and which the technical spec's own compartmentalization principle
argues against.

**On reusing the `service-host` harness.** The brief asked whether M6 should ride the existing
service-host. Having read `typings/vousoir/src/service-host-protocol.ts` in full: **no.** Three
reasons, all from the file itself. First, its own docblock at `:13-14` says *"Deliberately minimal —
health and shutdown. This is NOT MCP: work order §10 keeps real MCP server functionality out of scope
for this work order."* Second, `serviceHostRequestSchema` at `:31-34` admits exactly two request
types, `health` and `shutdown` — there is no request/response surface to carry MCP traffic, and adding
one means bumping `SERVICE_HOST_PROTOCOL_VERSION` and rewriting both sides. Third, and decisively,
the ownership is backwards: service-host exists so that **the extension** spawns and supervises
services (`PATCHES.md` A1). An MCP stdio server is spawned by **`claude`**, which knows nothing about
Vousoir's extension host. Routing it through service-host would put a supervisor in the middle of a
pipe that already has two well-defined ends.

**But it should reuse the harness's *shape*.** `vousoir/services/service-host/` and
`vousoir/services/dummy-service/` establish the package conventions: a `package.json` with a sealed
`exports` field and `"private": true`, a `tsconfig.json` extending `vousoir/tsconfig.base.json`,
`workspace:*` sibling deps, a `main.ts` process entry, and `parent-watchdog.ts` for orphan self-exit.
Follow all of that. The `no-cross-service-imports` rule
(`.dependency-cruiser.cjs:15-22`) will hold the new package to the same wall.

The MCP surface itself has been drafted **three** times, not two. The brief named two lists; a third
and more authoritative one exists in the Stage 3 document, spread across five services:

| Source | Tools |
|---|---|
| `vousoir-source-of-truth.md:187` | `list_modules`, `get_spec`, `get_contracts`, `get_work_order`, `propose_spec_change`, `verify_contracts` |
| `vousoir-technical-spec.md:91,93` | `list_modules`, `get_spec`, `put_spec`, `get_contracts`, `propose_spec_change`, `get_tree`; `compile_work_order`, `get_work_order` |
| Milestone brief | `list_module` / `get_module` / `create_module`, `update_contract`, `add_test_case`, `compile_work_order`, `get_neighbor_context` |

`vousoir-technical-spec.md:95,97,99` additionally drafts harness-manager, trace-store and
context-server surfaces (`launch_agent`, `get_trace`, `find_symbol`, …). Those belong to services that
do not exist yet and are out of scope for M6's spec server.

### Decision

M6 ships **`vousoir/services/spec-mcp/`** — a standalone package with its own `main.ts` process entry,
speaking MCP over stdio, reading and writing `.vousoir/spec/` directly on disk. It is registered with an
external agent via `claude mcp add`. The workbench is not in the path; the extension neither spawns
nor supervises it.

It does **not** extend the `service-host` protocol. It **does** follow the `service-host`/`dummy-service`
package conventions, including `parent-watchdog.ts`.

**The merged tool surface — nine tools.** Every tool's noun is "module", matching the product's own
vocabulary and making `list_modules` / `get_module` / `create_module` / `update_module` read as one
family.

*Read:*

| Tool | Returns | Provenance |
|---|---|---|
| `list_modules` | Every node as `{ id, title, parent, status }`. Because each record carries `parent`, the client reconstructs the tree — no separate `get_tree`. | all three lists |
| `get_module` | One node's full spec: parsed frontmatter plus the markdown body. | `get_spec` (lists 1, 2) + "get module" (list 3) |
| `get_contracts` | The `contract` field for a node and, optionally, its direct neighbours. Kept as its own tool because contracts are the product's thesis and an agent frequently wants only them. | lists 1, 2 |
| `get_neighbor_context` | The ancestor chain plus directly-contracted siblings for a node — what an implementer needs to know without reading the whole tree. | list 3 |
| `get_work_order` | The compiled, self-contained work order for a node. | lists 1, 2 |

*Write:*

| Tool | Effect | Provenance |
|---|---|---|
| `create_module` | New node under a given parent; writes a new `.md` under `.vousoir/spec/`. | list 3 |
| `update_module` | Replace `title`, `behaviour`, `status`, and/or the markdown body. | `put_spec` (list 2) |
| `update_contract` | Replace a node's `contract`. Separate from `update_module` because it is the one field with a verification story attached and the one an agent most often changes alone. | list 3 |
| `add_test_case` | Append one `{ id, description, expected }` to `testCases`. Separate because append-one is a genuinely different operation from replace-all on a structured array. | list 3 |

*Dropped, with reasons:*

- **`compile_work_order`** — folded into `get_work_order`. Compilation is deterministic from the spec
  files on disk, so a compile-then-get pair makes the agent issue two calls to observe one derived
  value. Split it back out if caching ever makes compilation expensive.
- **`verify_contracts`** (list 1) — that is Feature 8, the contract linter, explicitly deferred out of
  M1–M6.
- **`propose_spec_change`** (lists 1, 2) — a review-workflow tool. With `update_module` /
  `update_contract` writing plain files inside a git repo, "propose" is `git diff`. Defer until there
  is a reviewer other than the founder.
- **`get_tree`** (list 2) — folded into `list_modules`, as above.
- **`get_spec` / `put_spec`** — renamed to `get_module` / `update_module` for noun consistency.

Every tool's input and output is a zod schema in `@vousoir/typings`, per
`vousoir-technical-spec.md:153` — *"All MCP tool inputs/outputs defined as schemas (zod), with types
derived from schemas — the schema is the contract"* — and per `CONTRIBUTING.md:45-46`, which already
names *"future MCP tool payloads"* as belonging there.

**Two constraints on where those schemas can live.** First, `@vousoir/typings` compiles with
`"types": []` (`vousoir/tsconfig.base.json`, and `typings/vousoir/tsconfig.json` does not opt back
in) — **no ambient Node or DOM types**. `service-host-protocol.ts:16-17` states the rule for authors:
*"Keep these declarations to primitives, zod, and each other."* An MCP schema that reaches for
`Buffer`, `URL`, `NodeJS.*`, or any DOM type does not belong in `typings/`; the concrete server
implementation in `vousoir/services/spec-mcp/` opts into `"types": ["node"]` and holds that code.
Second, `typings-only-imports-zod` (`.dependency-cruiser.cjs:49-55`) forbids `typings/` from
importing anything but zod and its own siblings — so the MCP SDK itself can never be imported there,
only the schemas that describe its payloads. Everything the server exposes must also be re-exported
from `typings/vousoir/src/index.ts`, or the sealed barrel makes it unreachable (ADR-001).

### Consequences

- The MCP server works with Vousoir closed. An agent in a terminal can read and edit the spec with no
  editor running — which is what Feature 9 actually asks for.
- Two writers now exist for `.vousoir/spec/`: the canvas (via the extension) and the MCP server. Both
  write plain files, and the canvas must already watch for external edits — `vousoir-technical-spec.md:91`
  requires the spec store to *"Watch for external edits (user editing in Monaco or any editor) and
  emit change events"*, and Feature 10 promises the same round-trip. Last-write-wins on a per-file
  basis is acceptable at this scale; do not build a lock.
- Nine tools is a surface to keep stable. Version the schemas from day one the way
  `SERVICE_HOST_PROTOCOL_VERSION` is versioned.
- The server needs the same YAML parser M3 needs (ADR-002). Land the dependency once, in `typings/`'s
  consumer packages, not twice.
- `claude mcp add` registration is a user action, not something the extension performs. Document the
  exact command in `docs/v6r/`; do not have the extension silently mutate the user's `claude` config.
- `no-cross-service-imports` means `spec-mcp` cannot import `service-host` and vice versa. That is
  correct and should not be routed around.

### Rejected alternatives

- **In-process in the renderer / workbench.** Rejected: adds an IPC hop between an external `claude`
  process and the disk for no benefit, requires the workbench to be running, and is blocked from the
  model types by `core-not-import-vousoir` anyway.
- **Inside `extensions/vousoir-core` as an extension-host-hosted server.** Rejected for the same
  liveness reason — the agent would only be able to read the spec while the editor is open — and
  because it couples an external agent's tooling to an editor lifecycle it cannot control.
- **Extending the `service-host` stdio protocol to carry MCP.** Rejected on the file's own text
  (`service-host-protocol.ts:13-14`, *"This is NOT MCP"*), on its two-request surface
  (`:31-34`), and on ownership: an MCP stdio server is spawned by the client, not by Vousoir's
  extension, so a Vousoir supervisor has no role in its lifecycle.
- **Shipping all five technical-spec services' tool surfaces at M6.** Rejected: harness-manager,
  trace-store, and context-server are separate services that do not exist. M6 ships the spec surface.
- **Keeping all three drafted lists as aliases.** Rejected: three names for `get_spec`/`get_module`
  is exactly the kind of ambiguity that makes an agent pick the wrong tool.

### Evidence

- `typings/vousoir/src/service-host-protocol.ts:13-14` — *"Deliberately minimal — health and
  shutdown. This is NOT MCP: work order §10 keeps real MCP server functionality out of scope for this
  work order."*
- `typings/vousoir/src/service-host-protocol.ts:31-34` — `serviceHostRequestSchema =
  z.discriminatedUnion('type', [ z.object({ type: z.literal('health'), … }), z.object({ type:
  z.literal('shutdown'), … }) ]);` — the entire request surface.
- `typings/vousoir/src/service-host-protocol.ts:4-7` — *"the extension SPAWNS service-host as a child
  process and speaks this protocol to it over stdio"* — the ownership direction that does not fit an
  MCP server.
- `.dependency-cruiser.cjs:15-21` — `name: 'no-cross-service-imports'`, *"services communicate via
  MCP/IPC only — a service package may not import another service package."*
- `vousoir-source-of-truth.md:147` — *"Makes the entire spec — every node's behavior, contract, and
  test cases — queryable by any AI agent the user is working with, not just through the canvas UI."*
- `vousoir-source-of-truth.md:187` — *"Finalized MCP tool surface (first-draft list: `list_modules`,
  `get_spec`, `get_contracts`, `get_work_order`, `propose_spec_change`, `verify_contracts`)."*
- `vousoir-technical-spec.md:91` — *"MCP tools (draft surface): `list_modules`, `get_spec`, `put_spec`,
  `get_contracts`, `propose_spec_change`, `get_tree`."* and *"Watches for external edits … and emits
  change events."*
- `vousoir-technical-spec.md:93` — *"MCP tools: `compile_work_order`, `get_work_order`."*
- `vousoir-technical-spec.md:79` — *"**Every Vousoir subsystem exposes its functionality as a local
  MCP server. The Vousoir UI is just another MCP client — the same interface external agents use.**"*
- `vousoir-technical-spec.md:153` — *"All MCP tool inputs/outputs defined as schemas (zod), with types
  derived from schemas — the schema is the contract."*
- `vousoir-technical-spec.md:156` — *"**Every service = its own package** with an explicit public
  surface (its MCP tool schemas)."*
- `vousoir/tsconfig.base.json` — `"types": []` with the rationale *"Default to NO ambient @types …
  Packages needing ambient types opt in explicitly, e.g. `\"types\": [\"node\"]`."*
- `typings/vousoir/src/service-host-protocol.ts:16-17` — *"NOTE: @vousoir/typings compiles with
  `\"types\": []` — no ambient Node or DOM types. Keep these declarations to primitives, zod, and each
  other."*
- `.dependency-cruiser.cjs:49-55` — `name: 'typings-only-imports-zod'`, *"`typings/` contains only
  type declarations and zod schemas. It may import nothing except zod (and its own sibling files)."*
- `vousoir/CONTRIBUTING.md:97-106` — the five-step "Adding a package" checklist `spec-mcp` must follow;
  *"A new package must be born green."*
- `vousoir/services/service-host/src/main.ts`, `vousoir/services/service-host/src/parent-watchdog.ts`,
  `vousoir/services/dummy-service/` — the package shape to copy.

---

## ADR-007 — Develop in a git worktree with junctioned dependencies

**Status:** Accepted (2026-07-24) — recorded as **debt**
**Deciders:** orchestrating agent, pending user review

### Context

The user has uncommitted work on branch `phase-2-links` in the main worktree at
`C:/Users/bjsea/Documents/Projects/vousoir/vousoir`. M1–M6 needs a branch of its own without
disturbing that. `git worktree` gives one:

```
C:/Users/bjsea/Documents/Projects/vousoir/vousoir      3cf0c77872d [phase-2-links]
C:/Users/bjsea/Documents/Projects/vousoir/vousoir-v6r  3cf0c77872d [v6r/mvp]
```

A code-oss `npm ci` is a multi-gigabyte, multi-minute install. Duplicating it per worktree on Windows
is slow and wasteful, so `node_modules` and `build/node_modules` in the v6r worktree are **Windows
directory junctions** pointing at the main worktree's. Verified live:

```
Name         LinkType Target
node_modules Junction {C:\Users\bjsea\Documents\Projects\vousoir\vousoir\node_modules}
node_modules Junction {C:\Users\bjsea\Documents\Projects\vousoir\vousoir\build\node_modules}
```

`out/` is deliberately **not** a junction — verified: `(Get-Item …/vousoir-v6r/out).LinkType` returns
empty, i.e. a real directory. A shared `out/` would have the v6r build silently overwrite the user's
main build output, which is precisely the failure this arrangement exists to avoid.

**This arrangement is contradicted by the repo's own guidance and must be recorded as debt, not as a
good pattern.** The `launch` skill at `vousoir/.claude/skills/launch/SKILL.md:22` says: *"A VS Code
checkout with `node_modules/` installed (`npm install` if missing — do **not** symlink from a sibling
worktree; that breaks builds in subtle ways)."* That is a direct warning against what is being done
here. It is accepted anyway, knowingly, because the Vousoir-layer toolchain
(`vousoir/pnpm-*`, its own isolated `vousoir/node_modules`) is what M1–M6 actually exercises, and it
verifies clean — but the warning is real and the first unexplained code-oss build failure in the v6r
worktree should be triaged as a junction problem before anything else.

**The agent-guidance files, located precisely.** `.claude/CLAUDE.md` at the repo root is a
**symbolic link to `../.github/copilot-instructions.md`** — verified. Its title is *"VS Code Copilot
Instructions"*. It is inherited upstream VS Code guidance, not a Vousoir-authored rule, and should be
attributed that way. Its content is still correct and still binding for core work: `:56` *"NEVER use
`npm run compile` to compile TypeScript files"*; `:60` *"if you only changed code under `src/`, run
`npm run typecheck-client`"*; `:61` *"If you changed built-in extensions under `extensions/` … run the
corresponding gulp task `npm run gulp compile-extensions`"*. Both scripts exist at repo root
(`package.json:27` and `:49`).

Two caveats, both verified: the fork's own CI runs `npm run compile` in its cross-platform build job
(`.github/workflows/vousoir-ci.yml`), so the "NEVER" is guidance for the incremental dev loop, not an
absolute prohibition; and `:134` demands *"All files must include Microsoft copyright header"*, which
`PATCHES.md` #7 and #8 explicitly exempt the Vousoir layer from. Treat the inherited file as advisory
for core and superseded by `vousoir/CONTRIBUTING.md` for the Vousoir layer.

**The `launch` skill is tracked at `.agents/skills/launch/`, at the repo root** — `SKILL.md`,
`scripts/launch.sh`, `scripts/monaco-paste.sh`. `.claude/skills` is a **junction pointing at
`.agents/skills`**, and the two `SKILL.md` files hash identically. This matters for the worktree:
`.claude/` is gitignored (`.gitignore:40`) and is absent from `vousoir-v6r`, but **`.agents/` is
tracked and is present**, so the skill itself did come across. Only the `.claude/` view of it and the
`CLAUDE.md` symlink did not. Do not add `.claude/` to the v6r worktree; read `.agents/skills/launch/`
directly.

**The `launch` skill cannot run on this machine, and its content is stale.** `SKILL.md:21` states the
prerequisite: *"macOS or Linux. The launcher is a bash script and depends on `rsync`, `curl`,
`nohup`, and Node on `PATH`."* This is Windows 11 — `launch.sh` would need Git Bash plus `rsync`,
which is not part of a default Git-for-Windows install. It is also stale relative to the fork: it is
built around seeding an *authenticated* Copilot profile and exposes an `agentHostPort`
(`--inspect-agenthost`) for `src/vs/platform/agentHost/`, and `PATCHES.md` Layer 2 records that the
agents window (`src/vs/sessions/`), `platform/agentHost`, and all chat were physically deleted.
Confirmed: `src/vs/sessions`, `src/vs/platform/agentHost`, and `src/vs/workbench/contrib/vousoir` all
return `False` for `Test-Path`. Use `scripts/code.bat` for a Windows launch — what every §9 acceptance
test uses, per `PATCHES.md:317`.

### Decision

M1–M6 development happens in `C:/Users/bjsea/Documents/Projects/vousoir/vousoir-v6r` on branch
`v6r/mvp`, with `node_modules` and `build/node_modules` as Windows directory junctions to the main
worktree and `out/` as a real directory. The main worktree is treated as read-only.

**Create:**

```powershell
git -C C:/Users/bjsea/Documents/Projects/vousoir/vousoir worktree add ../vousoir-v6r -b v6r/mvp
cmd /c mklink /J "C:\Users\bjsea\Documents\Projects\vousoir\vousoir-v6r\node_modules" "C:\Users\bjsea\Documents\Projects\vousoir\vousoir\node_modules"
cmd /c mklink /J "C:\Users\bjsea\Documents\Projects\vousoir\vousoir-v6r\build\node_modules" "C:\Users\bjsea\Documents\Projects\vousoir\vousoir\build\node_modules"
```

**Undo** (junctions must be removed with `rmdir`/`Remove-Item` on the *link*, never by deleting
through it — deleting through a junction deletes the target's contents):

```powershell
cmd /c rmdir "C:\Users\bjsea\Documents\Projects\vousoir\vousoir-v6r\node_modules"
cmd /c rmdir "C:\Users\bjsea\Documents\Projects\vousoir\vousoir-v6r\build\node_modules"
git -C C:/Users/bjsea/Documents/Projects/vousoir/vousoir worktree remove ../vousoir-v6r
```

**Verified dev loop.** Every command below was run in the v6r worktree; results and wall-clock times
are measured, not estimated.

| Change | Command | Result |
|---|---|---|
| `extensions/vousoir-core` (the M2/M3/M5 inner loop) | `cd extensions/vousoir-core; node --experimental-strip-types ./esbuild.mts` | **exit 0, 0.28 s** |
| Vousoir layer (`typings/`, `vousoir/`, `extensions/vousoir-*`) | `cd vousoir; pnpm run verify` | **exit 0**, 9 files, **22 tests** (shared 6, service-host 10, boundary-tests 6) — *measured at recon; M1 took it to 66* |
| `src/` (core) | `npm run typecheck-client` | **exit 0, 6.48 s** |
| all `extensions/` | `npm run gulp compile-extensions` | **FAILS — see below** |
| Launch on Windows | `scripts/code.bat` | (**not** the `launch` skill — macOS/Linux only) |

**Use the 0.28 s single-extension build as the inner loop for M2, M3 and M5.** It is the whole
edit-run cycle for canvas work and it is roughly 20× faster than even a bare `typecheck-client`.
`pnpm run verify` is the gate before committing, not the loop.

**`npm run gulp compile-extensions` fails in this worktree, and the junctions are why.** The error is
`error TS2688: Cannot find type definition file for 'node'`, hitting `extensions/grunt` and
`extensions/notebook-renderers`. It would be easy — and wrong — to file this as pre-existing. The
actual cause, traced:

- Both extensions' `tsconfig.json` pin `"typeRoots": ["./node_modules/@types"]` — the **extension's
  own** `node_modules`, not the repo root's.
- In `vousoir-v6r`, `extensions/grunt/node_modules`, `extensions/git/node_modules` and
  `extensions/notebook-renderers/node_modules` **do not exist**.
- In the main worktree, all three **do** exist.
- The root `package.json:22` declares `"postinstall": "node build/npm/postinstall.ts"`, which is what
  populates them. It ran there during `npm ci`. It has never run here, because this worktree never
  ran `npm install` — its root `node_modules` was junctioned in instead, and a junction shares only
  that one directory. The per-extension `node_modules` folders are separate paths inside each
  worktree.
- The fork's only changes to those two extensions since `1.130.0` are display-string rebranding
  (`"Grunt support for VS Code"` → `"…for Vousoir"`, and one notebook renderer `displayName`).
  Nothing touched their tsconfigs or dependencies.

So this is **not** a pre-existing upstream defect and **not** a de-branding regression. It is the
first concrete instance of exactly what `SKILL.md:22` warned about — *"breaks builds in subtle ways"*.
The fix is to run a real `npm ci` (or at minimum the postinstall) in this worktree, **not** to add
`@types/node` to two upstream tsconfigs, which would spend two core patches papering over a local
environment gap.

Until then: `compile-extensions` cannot serve as a green-build gate here, and its failure must not be
mistaken for a regression introduced by v6r work. `vousoir-core` is unaffected — it builds through its
own `esbuild.mts`, not the gulp/tsc pipeline, which is why the 0.28 s loop succeeds while
`compile-extensions` does not.

### Consequences

- **The two worktrees must not diverge on dependency versions.** They share one `node_modules`. If a
  branch changes `package.json` or `package-lock.json` and reinstalls, the other branch is silently
  running the wrong dependency tree with no error. Any dependency change is a stop-the-world event:
  coordinate, reinstall once, and re-verify both branches. The Vousoir layer's own
  `vousoir/node_modules` is separate and lower-risk, but the same discipline applies to
  `vousoir/pnpm-lock.yaml`.
- **The warning has already come true once.** `SKILL.md:22` says sibling-worktree linking *"breaks
  builds in subtle ways"*; `compile-extensions` is that breakage, and it presents as a type error in
  two unrelated upstream extensions rather than as anything resembling a dependency problem. Triage
  any unexplained core build failure here by first running a real `npm ci` in this worktree — before
  suspecting the code.
- `.claude/` is gitignored and absent from the v6r worktree, so the `CLAUDE.md` symlink is not
  reachable here. The `launch` skill **is** present, at the tracked `.agents/skills/launch/`. Do not
  add `.claude/` to the v6r worktree — it would fork the guidance.
- Two `out/` directories means two full code-oss builds' worth of disk. That is the price of not
  corrupting the user's build, and it is the right trade.
- This is **time-boxed debt**. When `phase-2-links` lands and the branches converge, collapse to one
  worktree with a real `npm ci`.

### Rejected alternatives

- **A second full clone.** Rejected: a full code-oss clone plus `npm ci` per branch is slow enough to
  discourage branching, which is the behaviour to avoid.
- **A branch switch in the main worktree.** Rejected: the user has uncommitted work on
  `phase-2-links`; switching risks it.
- **Junctioning `out/` as well.** Rejected on the stated risk — a shared `out/` means the v6r build
  silently overwrites the user's main build output with no warning and no way to tell which branch
  produced the running app.
- **A real `npm ci` in the v6r worktree (what the `launch` skill prescribes).** Not rejected — it is
  the correct answer, and the `compile-extensions` failure above shows the junction shortcut has
  already cost something real. It is deferred only because M1–M6 exercises the pnpm-managed Vousoir
  layer, which verifies clean, rather than the npm-managed code-oss build. **Run it the moment M2
  needs a full extension build, or the moment any core build failure is not immediately explicable.**

### Evidence

- `git worktree list` — `C:/Users/bjsea/Documents/Projects/vousoir/vousoir 3cf0c77872d
  [phase-2-links]` / `C:/Users/bjsea/Documents/Projects/vousoir/vousoir-v6r 3cf0c77872d [v6r/mvp]`.
- Verified live: `vousoir-v6r/node_modules` and `vousoir-v6r/build/node_modules` both report
  `LinkType: Junction` with targets under `vousoir/`; `vousoir-v6r/out` reports an empty `LinkType`
  (a real directory).
- `.agents/skills/launch/SKILL.md:22` — *"A VS Code checkout with `node_modules/` installed (`npm
  install` if missing — do **not** symlink from a sibling worktree; that breaks builds in subtle
  ways)."*
- `.agents/skills/launch/SKILL.md:21` — *"macOS or Linux. The launcher is a bash script and depends on
  `rsync`, `curl`, `nohup`, and Node on `PATH`."*
- `.agents/skills/launch/SKILL.md:23` — *"Run `npm run compile` once (one-shot) or `npm run watch` for
  incremental rebuilds."* — in direct tension with `.claude/CLAUDE.md:56`.
- Verified: `.claude/skills` is a **Junction** to `.agents/skills`; the two `launch/SKILL.md` files
  hash identically; `git ls-files .agents` lists `SKILL.md`, `launch.sh`, `monaco-paste.sh` while
  `git ls-files .claude` is empty.
- `.claude/CLAUDE.md` — a **SymbolicLink** with target `..\.github\copilot-instructions.md`; its
  first line is *"# VS Code Copilot Instructions"*. Inherited upstream, not Vousoir-authored.
- `.claude/CLAUDE.md:56` — *"NEVER use `npm run compile` to compile TypeScript files"*.
- `.claude/CLAUDE.md:60` — *"run `npm run typecheck-client` after making changes to type-check the main
  VS Code sources (it validates `./src/tsconfig.json`)"*.
- `.claude/CLAUDE.md:61` — *"run the corresponding gulp task `npm run gulp compile-extensions` instead
  so that TypeScript errors in extensions are also reported"*.
- `.claude/CLAUDE.md:134` — *"All files must include Microsoft copyright header"* — superseded for the
  Vousoir layer by `vousoir/PATCHES.md` Layer 1 rows #7 and #8.
- `package.json:27` — `"typecheck-client": "tsc --project ./src/tsconfig.json --noEmit
  --skipLibCheck"`; `package.json:49` — `"gulp": "node --experimental-strip-types
  --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js"`.
- `.gitignore:40` — `.claude/` (confirmed via `git check-ignore -v`), which is why the skill and
  CLAUDE.md are absent from the v6r worktree.
- `vousoir/package.json:21` — `"verify": "pnpm run lint:strict && pnpm run dep-check && pnpm run
  typecheck && pnpm run test"`.
- Verified runs in the v6r worktree: `pnpm run verify` → exit 0, **22 passed**; `npm run
  typecheck-client` → exit 0, **6.48 s**; `node --experimental-strip-types ./esbuild.mts` in
  `extensions/vousoir-core` → exit 0, **0.28 s**; `npm run gulp compile-extensions` → **exit 1**,
  `error TS2688: Cannot find type definition file for 'node'`.
- `extensions/grunt/tsconfig.json` and `extensions/notebook-renderers/tsconfig.json` both set
  `"types": ["node"]` with `"typeRoots": ["./node_modules/@types"]` — the extension's own
  `node_modules`, which does not exist in this worktree.
- Verified: `extensions/{grunt,git,notebook-renderers}/node_modules` → `False` in `vousoir-v6r`,
  `True` in the main worktree. `package.json:22` — `"postinstall": "node build/npm/postinstall.ts"`.
- `git diff 1.130.0 -- extensions/grunt/package.json extensions/notebook-renderers/package.json`
  shows only display-string rebranding, confirming the fork did not cause the type error.
- `vousoir/PATCHES.md:317` — *"every §9 acceptance test runs from source via `scripts/code.bat`"*.
- `Test-Path` verified `False` for `src/vs/sessions`, `src/vs/platform/agentHost`, and
  `src/vs/workbench/contrib/vousoir` — the `launch` skill's agent-host surface no longer exists.

---

## ADR-008 — Extend the existing spec-node schema; never fork it

**Status:** Accepted (2026-07-24)
**Deciders:** orchestrating agent, pending user review

### Context

ADR-002 established that node specs are markdown + YAML frontmatter validated by the **already
shipped** `specNodeFrontmatterSchema`. This ADR settles what M1 is allowed to do to that schema.

The milestone brief specified a model type that does not match the shipped one. Verified against
`typings/vousoir/src/spec-node-frontmatter.ts`, there are **six** differences:

| Brief | Shipped | Note |
|---|---|---|
| `name` | `title` | pure rename |
| `behavior` | `behaviour` | British spelling, already committed and tested |
| `contracts: Contract[]` with `kind: moduleApi \| serviceApi \| dbSchema` | `contract?: string` | one free-form string; **the brief is right that this should be typed** |
| test cases with given/when/then + optional snippet | `{ id, description, expected }` | all three `z.string().min(1)` |
| `children` | *(absent)* | the tree is derived from `parent` pointers |
| `position` | *(absent)* | see ADR-003 — layout lives in `.vousoir/layout.json`, never in frontmatter |

These are not all the same kind of difference, and treating them uniformly would be a mistake. Two
are cosmetic renames of committed, tested, cross-package identifiers. One (`contracts`) is a genuine
modelling gap the brief is right about — typed boundary contracts are the *"edges, not substance"*
thesis of the product, and `vousoir-source-of-truth.md:186` names exactly those three kinds. One
(test-case structure) is an ergonomics improvement that can be made additively. Two (`children`,
`position`) are fields that should not exist at all.

The constraint that shapes the answer: `vousoir/CONTRIBUTING.md:43-47` requires every cross-package
shape to live in `typings/vousoir` and states *"**No package redeclares a shared shape locally.**"*
`PATCHES.md` A3 records what happens when that is ignored — two work-packages independently produced
*"the **same type names** `@vousoir/typings` exports, with different shapes"* — and notes the
enforcement gap: *"dependency-cruiser could not catch this. It tracks *imports*, not *duplicated
declarations*."* A second model type would not fail CI. It would just quietly become a second source
of truth.

### Decision

M1 **extends `specNodeFrontmatterSchema` in place**. It does not introduce a parallel `ModuleNode`
type.

**Keep unchanged:** `id`, `title`, `parent`, `status`, and the British `behaviour`. Renaming committed
identifiers to match the brief's prose would touch `@vousoir/typings`, the golden fixtures, and the
`shared` tests for zero user-visible gain.

**Add `contracts`:** `contracts: z.array(contractSchema).optional()`, where `contractSchema` carries
`kind: z.enum(['moduleApi', 'serviceApi', 'dbSchema'])` plus the contract body. This is the one place
the brief is straightforwardly right, and it is the product's core abstraction. The existing scalar
`contract?: string` is **kept and accepted** as deprecated back-compat, so every spec file valid today
stays valid; a reader prefers `contracts[]` when present and falls back to `contract`.

**The contract body is a free-form string per kind** (open question 4, resolved by the user
2026-07-24). Structured fields — named operations, request/response shapes — are added **later and
additively**, in this ADR's own style, so no existing spec file is invalidated.

> **Dated commitment (2026-07-24), not a maybe.** That structuring **must land before the milestone
> that builds Feature 6, "Integration Testing Across Modules"**: agent-run contract integration tests
> need machine-readable contracts, and a free-form string cannot be checked by a machine. Feature 6 is
> **deferred out of M1–M6** (see the Deferred table), so this blocks no planned milestone — and it is
> not optional. **"Before M6" would be the wrong reading**: M6 is the MCP server.
>
> **This is one half of a prerequisite, not a whole one.** Open question 10 is the other half: a
> contract has no target reference, so there is no provider/consumer pair to test *between*. Machine-
> readable bodies without edges still cannot support a contract integration test. **Land the two
> together.**

**Extend test cases additively:** add optional `given` / `when` / `then` / `snippet` to
`specNodeTestCaseSchema`, keeping `description` and `expected` required. Optional zod fields are
non-breaking by construction.

**Do not add `children`** — it is derivable from `parent` and a stored copy is a denormalisation that
can disagree with the pointers. **Do not add `position`** — layout belongs in `.vousoir/layout.json`
(ADR-003, as amended 2026-07-24). The amendment made positions user-authored rather than regenerable,
which **strengthens** this rule rather than weakening it: authored data in frontmatter is exactly the
churn ADR-002 exists to keep out of spec diffs.

Everything added must be re-exported from `typings/vousoir/src/index.ts`, or the sealed barrel makes
it unreachable from the extension (ADR-001). Every change must leave `pnpm run verify` green — 22
tests at recon, **66 after M1**.

### Consequences

- One schema, one contract. The canvas, the spec panel, the work-order compiler and the MCP server
  all read the same declaration.
- Every existing `.vousoir/spec/**.md` file stays valid. Additive optional fields plus a retained scalar
  `contract` means no migration and no flag day.
- Two ways to express a contract exist during the deprecation window. Write the precedence rule
  (`contracts[]` wins; `contract` is a single untyped fallback) once, in the reader, and do not
  duplicate it per consumer.
- The work-order compiler (M4) gets typed contracts to render section headings from, and the contract
  linter — deferred, Feature 8 — gets the `kind` discriminator it will need without a later migration.
- `behaviour` vs "behavior" will keep looking like a typo to every new reader. Note it once in code so
  nobody "fixes" it.
- The golden fixtures (`vousoir/shared/src/fixtures/spec-node-frontmatter.{valid,invalid}.json`) must
  grow cases for the new fields, including one asserting a legacy scalar-`contract` file still passes.

### Rejected alternatives

- **A fresh `ModuleNode` type matching the brief's field names, alongside the existing schema.**
  Rejected. The schema is the contract, and two contracts is no contract. `PATCHES.md` A3 documents
  this exact failure already occurring once in this codebase, and notes that neither enforcement wall
  catches it — so the cost would be paid in review attention forever.
- **Renaming `behaviour` → `behavior` and `title` → `name` to match the brief.** Rejected: a breaking
  change to committed, tested, cross-package identifiers for a spelling preference. If the user wants
  the rename, it is a deliberate one-commit migration, not something M1 does in passing.
- **Replacing `contract?: string` with `contracts[]` outright.** Rejected: it invalidates every spec
  file written before M1 with no migration path, for no benefit over keeping the scalar accepted.
- **Making `given`/`when`/`then` required.** Rejected: it would invalidate the existing golden fixture
  and force a structure on test cases that plain `description` + `expected` already covers for simple
  ones.
- **Storing `position` in frontmatter (as the brief implies).** Rejected — see ADR-003. It puts layout
  churn into every git diff of a spec file, defeating the Portable Spec Files requirement ADR-002
  exists to serve. Still rejected after the 2026-07-24 amendment: positions became user-authored, but
  they went to `.vousoir/layout.json`, not to frontmatter.

### Evidence

- `typings/vousoir/src/spec-node-frontmatter.ts:27-38` — the shipped schema: `id`, `title`, `parent`
  (`z.string().min(1).nullable()`), `status`, `behaviour`, `contract`, `testCases`. No `children`, no
  `position`.
- `typings/vousoir/src/spec-node-frontmatter.ts:19-23` — `specNodeTestCaseSchema = z.object({ id:
  z.string().min(1), description: z.string().min(1), expected: z.string().min(1) });`
- `typings/vousoir/src/spec-node-frontmatter.ts:35` — `/** The node's contract with its
  siblings/parent: inputs, outputs, invariants. */` on the single `contract?: string`.
- `typings/vousoir/src/spec-node-frontmatter.ts:3-5` — *"this schema covers only the structured
  frontmatter header, not the free-form markdown body below it."*
- `vousoir-source-of-truth.md:186` — *"Contract verification mechanics per contract type (module API,
  service API, DB schema)"* — the source of the three `kind` values.
- `vousoir-source-of-truth.md:67` — *"lets the user define its behavior, its boundary contract, and
  its test cases — the three things that fully define a module without dictating its internals."*
- `vousoir/CONTRIBUTING.md:43-47` — *"Every cross-package data shape … is defined in `typings/vousoir`
  and imported everywhere else. **No package redeclares a shared shape locally.**"*
- `vousoir/PATCHES.md:288-303` — A3: two packages produced *"the *same type names* `@vousoir/typings`
  exports, with different shapes"*, and *"dependency-cruiser could not catch this. It tracks
  *imports*, not *duplicated declarations* … §7.3's 'no package redeclares a shared shape locally' is
  a review rule, not a mechanical one."*
- `typings/vousoir/src/index.ts:9-11` — the sealed barrel: anything added must be re-exported here.
- `vousoir/shared/src/fixtures/spec-node-frontmatter.{valid,invalid}.json` — the golden fixtures that
  must be extended alongside the schema.

---

## Deferred — explicitly out of M1–M6

These are real features in `vousoir-source-of-truth.md` that no current milestone builds. Listed so
that a later reader does not mistake their absence for an oversight.

| Feature | Source | Note |
|---|---|---|
| **6. Integration Testing Across Modules** | `vousoir-source-of-truth.md:112-121` | Verifies that sibling modules under one parent work together once both are built. Needs M5 dispatch to be routine first. **Blocked on a two-part prerequisite recorded 2026-07-24**, both of which must land before it is built: (a) `specNodeContractSchema`'s body is a free-form string and an agent cannot diff prose — structure it additively (ADR-008, open question 4); (b) contracts carry **no target reference**, so there is no provider/consumer pair to test *between* (open question 10). *What* a contract says and *who is on each end of it* — **land them together.** |
| **7. Traceability View** | `:123-132` | Jump from node → generated code and back. `.vousoir/traces/` (`v6r-layout.ts:20`) already reserves the storage; `vousoir-technical-spec.md:99` drafts `trace_code_to_spec` / `trace_spec_to_code` for the context server. |
| **8. Contract Linter** | `:134-143` | Checks a built module's real boundary against its declared contract. This is what `verify_contracts` was for (dropped from the ADR-006 surface) and what the module-API / service-API / DB-schema contract split at `:186` is for. |
| **11. Frontend/UX Whiteboard Mode** | `:166-175` | A separate freeform canvas. **Space is already reserved:** `V6R_SUBDIRS.whiteboards` exists in `typings/vousoir/src/v6r-layout.ts:18` (*"Frontend/UX canvases"*) and is in `V6R_COMMITTED_SUBDIRS`, so `v6rInit()` scaffolds `.vousoir/whiteboards/` today. `vousoir-technical-spec.md:125` earmarks *"tldraw or equivalent"*, undecided. |

Also out of scope but drafted in `vousoir-technical-spec.md`: the trace store (`:97`), the context
server with LSP brokering (`:99`), the harness-adapter interface for non-Claude agents (`:101-116`),
and per-run git worktree isolation (`:95`). M5 dispatches into the user's workspace, not an isolated
worktree.

---

## Open questions

All six original questions were **resolved by the user on 2026-07-24** while reviewing PR #11. Each is
kept with its answer rather than deleted — the reasoning is the part worth having. Four more were
generated afterwards: **#7** by the ruling itself, **#8**–**#10** by M1 (PR #12). **Two are open: #7
(`layout.json` gitignored or committed) and #10 (contracts have no edges).** #10 must settle before M6
and is the more consequential of the two.

### 1. Exact work-order scope — **RESOLVED 2026-07-24.** Unblocks M4.

`vousoir-source-of-truth.md:185` left this open: *"Exact contents of a compiled work order
(immediate spec only vs. spec + all ancestor context vs. spec + directly-contracted neighbor
specs)."* It gated M4 and is the single decision that most affects whether generated code is correct.

**Answer.** A work order contains exactly three tiers:

| Tier | What is included | What is excluded |
|---|---|---|
| The node itself | Its **full spec** — `behaviour`, every contract, every test case, and the markdown body. | — |
| Its ancestors (full chain to the root) | **Behaviour summaries only.** | Their contracts, test cases, and bodies. |
| Its **parent, siblings and children** | **Contract blocks only.** | Behaviour, test cases, body — **never neighbour internals.** |

> **Tier 3 is the shipped approximation, not the ruling.** The ruling said *"directly-contracted
> neighbours"*; that set is **not computable** — contracts carry no target reference (open question
> 10). M4 ships the structural stand-in **parent + siblings + children**, declared as such in code
> (`vousoir/shared/src/work-order/work-order-context.ts` — `WorkOrderNeighbourRelation = 'parent' |
> 'sibling' | 'child'`). Resolving #10 is what would make this tier exact.
>
> **Children are the tier that matters most, and an early reading nearly lost them.** A node's
> children are precisely the modules it composes and is therefore most likely to call. A stand-in
> built from siblings alone — a natural reading of "neighbours" — would have omitted the single most
> relevant group. Recorded so this is not re-litigated.
>
> The **parent appears in two tiers on purpose**: as an ancestor it contributes a behaviour summary,
> as a neighbour it contributes contract blocks. Different data, no duplication.

**Rationale, in the user's terms:** *"contracts, not substance" applies to the work order itself.* The
same principle the product applies to modules applies to what an agent is handed — an implementer gets
its own substance, its ancestors' intent, and its neighbours' edges, and nothing more.

This **differs from the proposal this section originally carried**, which gave the ancestors' *contracts*.
The ruling gives their **behaviour summaries** instead: an ancestor's contract is with the world outside
the subtree and is not what a child needs; what a child needs is what the parent is *for*. Bounded by
construction either way, so a deep tree cannot produce an unbounded prompt. The compiler's specification
is in `ARCHITECTURE.md` §6 M4.

### 2. `*.v6r` manifest format — **RESOLVED 2026-07-24: JSON**, as proposed.

Three reasons were given. (a) ~~No YAML parser is a declared dependency of any Vousoir package, and
`JSON.parse` needs none~~ — **this reason has since evaporated**: M1 landed `yaml@2.9.0` and closed
`PATCHES.md` D7. (b) The manifest is machine-written config, not prose; Feature 10's portability promise
is about *specs*, which stay markdown + YAML regardless. (c) zod validates a parsed JSON object directly,
consistent with *"the schema is the contract"* (`vousoir-technical-spec.md:153`). **The ruling stands on
(b) and (c)** — it was the user's call, not a consequence of the dependency situation.

### 3. `*.v6r` file vs the `.v6r/` directory — **RESOLVED 2026-07-24: rename the directory to `.vousoir/`.**

`V6R_ROOT_DIRNAME` was a **directory** named `.v6r`; ADR-001 binds a custom editor to a `*.v6r` **file**
glob. A file literally named `.v6r` would have been ambiguous, and `filenamePattern: "*.v6r"` may or may
not match a dotfile with an empty stem depending on the matcher.

**Answer:** keep the `*.v6r` manifest **file** extension; rename the **directory** to `.vousoir/`. This
removes the collision at its source rather than working around it with a stem rule, and it re-aligns the
code with `vousoir-technical-spec.md:132`, which named the folder `.vousoir/` all along. Recorded as a
dated amendment on ADR-002; the rename lands with M1, as planned, before M2.

### 4. `contractSchema` body — **RESOLVED 2026-07-24: free-form string per kind now, structured later.**

ADR-008 settled the outer shape: a typed `contracts[]` with `kind: moduleApi | serviceApi | dbSchema`,
with the scalar `contract` kept as deprecated back-compat. What remained open was the body.

**Answer:** a free-form string body per kind for now. Structured fields (named operations,
request/response shapes) are added **later and additively**, in the ADR-008 style that keeps every
existing spec file valid.

> **Dated commitment, not a maybe.** The structuring **must land before the milestone that builds
> Feature 6, "Integration Testing Across Modules"** (`vousoir-source-of-truth.md:112-121`), because
> agent-run contract integration tests need machine-readable contracts. A free-form string cannot be
> checked by a machine, so that feature cannot be built on top of one.
>
> **Do not read this as "before M6."** M6 is the MCP server. Feature 6 is integration testing, and it is
> **deferred out of M1–M6** entirely (see the Deferred table above). The deadline is that deferred work,
> whenever it is scheduled — which means the structuring is not blocking any milestone currently planned,
> and is also not optional.

### 5. Manual node placement and auto-layout override — **RESOLVED 2026-07-24: supported, with explicit auto-tidy.**

`vousoir-source-of-truth.md:84` asked for manual placement to be *"respected where reasonably possible"*;
`:188` left the override semantics explicitly undecided; `:86` insisted auto-layout *"has to work
invisibly"*.

**Answer:** full manual placement is supported. Auto-layout runs as an **explicit auto-tidy command** and
**must never silently override** a user's placement. Positions therefore move out of the wipeable
`.vousoir/cache/` into `.vousoir/layout.json`. Positions still never go in spec frontmatter.

**This overrules `:86` and the M2 brief.** See the ADR-003 amendment (2026-07-24), which records what was
superseded, what survives, and the fact that `vousoir-source-of-truth.md` Feature 3 is now stale.

### 6. Field spelling: `behaviour` vs `behavior` — **RESOLVED 2026-07-24: `behaviour` stays.**

The shipped schema uses British `behaviour`; every product document uses American "behavior". Renaming
would break committed, tested files and violate ADR-008's own rule against cosmetic churn on cross-package
identifiers. Keep `behaviour` as the wire/field name; use "Behavior" in UI labels and prose. Note it once
in the M3 spec-panel code so nobody "fixes" it.

### 7. Is `.vousoir/layout.json` gitignored or committed? — **OPEN.** Deferred by the user, 2026-07-24.

Generated by the resolution of question 5. The user deferred it deliberately; **do not decide it by
accident.**

**The live consequence, today:** `V6R_GITIGNORE_CONTENTS` is `` `${V6R_SUBDIRS.cache}/\n` `` — it ignores
`cache/` and nothing else. `layout.json` is a file at the root of `.vousoir/`, not a `V6R_SUBDIRS` member,
so nothing matches it and it is **committed by default unless someone acts.** Whoever implements M2 will
get the committed behaviour whether or not they intended to.

**The trade-off, both directions real:**

- **Committed** — a collaborator cloning the repo gets the canvas as the author arranged it, which is
  what `v6r-layout.ts`'s own docblock promises (*"a collaborator cloning the repo sees the full project
  state with no external database"*). Cost: node positions churn in git diffs on every drag, and two
  people moving the same node conflict in a file that has no meaningful merge.
- **Gitignored** — spec diffs stay clean and nothing can conflict. Cost: a collaborator clones the repo
  and gets an unpositioned canvas, and the author's arrangement is local-only and lost on a fresh clone.

Note this is a weaker version of the same argument ADR-002 and ADR-003 use to keep positions out of spec
frontmatter — but only weaker, not identical: churn confined to one file that nobody reads in review is
not the same problem as churn in every spec file. That is why the frontmatter rule is settled and this is
not.

### 8. Is behaviour the markdown body or the frontmatter field? — **RESOLVED: the body is canonical.**

Raised by M1 (PR #12) as open question 7 in `PROGRESS.md`. The shipped schema has a `behaviour`
frontmatter field while ADR-002 and `ARCHITECTURE.md` §5 describe the body as unconstrained prose —
both read as "where behaviour lives", and they were not reconcilable as written.

**Answer:** the markdown **body** is canonical; the `behaviour` field is a **deprecated fallback**;
text is **never silently migrated** between them. Full reasoning in the ADR-002 amendment
(2026-07-24). Documentation-only — it ratifies what `resolveSpecNodeBehaviour` already does. Settled
before M3, as M1 asked.

### 9. Was `typings/vousoir/src/v6r-manifest.ts` a dropped M1 deliverable? — **RESOLVED: no, it moves to M2.**

Raised by M1 (PR #12) as open question 8 in `PROGRESS.md`. `ARCHITECTURE.md` §6 listed it under M1;
the M1 brief did not, and M1 correctly followed the brief.

**Answer:** it belongs to **M2**, which has to answer the `*.v6r` filename question anyway. `ARCHITECTURE.md`
§6 has been corrected in both milestone rows so it does not read as dropped.

### 10. Contracts are declarations, not edges — "contracted neighbours" is underivable. **OPEN.** Must settle before M6.

Full framing: [PR #12 comment](https://github.com/Firelight-Innovations/Vousoir/pull/12#issuecomment-5074389294).

**The fact.** `specNodeContractSchema` is `{ id, kind, name, body }`
(`typings/vousoir/src/spec-node-frontmatter.ts:33-57`) — **no target reference**. The spec tree's only
inter-node relationship is `parent`. A contract records *that* a node has a boundary, not *whom* it is
with.

**Consequence.** The work-order ruling (open question 1) says *"contracted neighbours' contract blocks
only"*. That set cannot be computed. M4 proceeds on a **structural approximation** — parent, siblings,
children — marked as such in code. **Accepted as an interim, not as a decision.** It is wrong in both
directions: too broad (an uncalled sibling leaks its contracts into the work order) and too narrow (a
genuine dependency three branches away contributes nothing, so the agent builds against an unstated
boundary — the exact failure the product exists to prevent). It fails hardest on the case that matters
most.

**It reaches M6, not just M4 — and this is the part worth preserving.** M6's orchestrator is specified
to run *"contract-based integration tests between siblings"*, which requires knowing which node
**provides** a contract and which **consumes** it. With no edges there is nothing to test between, only
an unordered pile of per-node declarations. So this and the dated commitment on structured contract
bodies (open question 4, ADR-008) are **two halves of one prerequisite**: M6 needs both *what* a
contract says and *who is on each end of it*. They were deferred separately, and nobody noticed they
converge. **Whatever is decided here should land alongside the body structuring, not separately.**

**Options.** (A) keep the structural approximation and revisit later — cheapest, and for a solo user
reviewing every work order by hand possibly sufficient; (B) add an optional `provider`/`consumes` node
reference to `specNodeContractSchema` — additive per ADR-008, smallest change that makes "contracted
neighbours" real; (C) contracts become first-class objects, provided by one node and consumed by many
— richest, matches how an API boundary actually behaves, but a substantially bigger change to the file
format and the canvas. **Recorded lean: B**, because it is additive, unblocks M6's sibling tests, and
can grow into C without a migration. A lean, not a decision — this is a product-shape question about
what a module diagram *is*.

**Constraints on any answer.** Additive (ADR-008): every spec file authored before the change stays
valid, no migration. And no field describing a neighbour's **internals** — an edge between boundaries
is still an edge; a reference to how a neighbour works is not.

> **Sub-question closed, 2026-07-24.** It was asked whether the base branch `phase-2-links` already
> means inter-node relationships in the spec model, in which case M4 should wait rather than
> approximate. **It does not.** `phase-2-links` is one of four de-branding branches
> (`phase-2-ai-ui`, `phase-2-branding`, `phase-2-endpoints`, `phase-2-links`); its commit
> `1f7fd041daa` is *"Phase 2 (links): drop code.visualstudio.com refs from Linux appdata"* — "links"
> means **hyperlinks to Microsoft properties**, stripped during de-branding. No spec-model link work
> exists on it. **M4 should not wait for it.**

Nothing is blocked today. It must be settled before M6.

---

## Note on patch ledger scope

`vousoir/CONTRIBUTING.md:114-116` says any change to a file outside `extensions/vousoir-*` and
`vousoir/` must be logged in `PATCHES.md`. Read literally, `docs/v6r/ADR.md` qualifies. But
`PATCHES.md:110-119` gives the operative definition and resolves it: *"Everything else added so far is
**purely additive** — new files and directories that do not exist upstream, so `git diff 1.130.0` is
empty for them … Additive files are *not* core patches — they cannot conflict on an upstream merge."*
`docs/v6r/` does not exist upstream and cannot conflict on a merge. **No `PATCHES.md` entry is
required for this file.** If the user disagrees, the fix is one row in Layer 1 — but the ledger's own
stated purpose (tracking upstream merge risk) is not served by listing a directory upstream has never
had.
