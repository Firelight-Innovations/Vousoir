# Vousoir (v6r) — Progress

Updated after every milestone. Docs: [`ADR.md`](./ADR.md) (why) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) (how and where).

**Gate for every milestone:** `cd vousoir; pnpm run verify` green. Currently 22 tests, exit 0.

## Milestones

| Milestone | Status | Branch | PR | Notes |
|---|---|---|---|---|
| **M0 — Recon** | ✅ Complete | `v6r/m0-recon` | *(see PR)* | 8 ADRs + architecture map + this tracker. Docs only, no feature code. Verified every citation against the tree; 4 briefed claims were wrong (see PR body). |
| **M1 — Model + spec store** | ⬜ Pending | — | — | Extend `specNodeFrontmatterSchema` in place (ADR-008): typed `contracts[]`, optional given/when/then. Brings the first YAML dependency. |
| **M2 — Canvas editor + auto-layout** | ⚠️ **Code complete — canvas never rendered** | `v6r/m2-canvas` | [#17](https://github.com/Firelight-Innovations/Vousoir/pull/17) | `CustomTextEditorProvider` on `*.v6r`; layout engine in `@vousoir/shared` (26 tests). Manual placement + auto-tidy per the ADR-003 amendment; positions in `.vousoir/layout.json`. **All seven canvas interactions typecheck, lint and bundle but have NEVER been exercised by a browser or a human** — the webview script, the CSP and `asWebviewUri` resolution are unverified. **Needs a human to launch `scripts/code.bat` and open a `*.v6r` file. Do not call the canvas working until then.** |
| **M3 — Per-node spec panel** | ⬜ Pending | — | — | Behaviour / Contracts / Test Cases; writes one `.md` per node. Needs the external-edit watcher. |
| **M4 — Work-order compiler** | ⬜ Pending | — | — | **Unblocked 2026-07-24.** Scope settled: node's full spec + ancestors' **behaviour summaries** + contracted neighbours' **contract blocks only, never internals**. Spec in ARCHITECTURE.md §6 M4. |
| **M5 — Dispatch to Claude Code** | ⬜ Pending | — | — | `child_process` from the extension host (ADR-005). `ELECTRON_RUN_AS_NODE=1` mandatory. |
| **M6 — Orchestration + MCP server** | ⬜ Pending | — | — | Standalone `vousoir/services/spec-mcp/` (ADR-006). Nine tools. |

## Decision log

| Date | Decision | Where |
|---|---|---|
| 2026-07-24 | Canvas ships as a built-in extension (extend `vousoir-core`), not a core workbench contrib — `core-not-import-vousoir` makes a contrib unable to import the model at all | [ADR-001](./ADR.md) |
| 2026-07-24 | Specs are markdown + YAML frontmatter under `.vousoir/spec/`; `*.v6r` is a thin manifest | [ADR-002](./ADR.md) |
| 2026-07-24 | Hand-rolled recursive tree layout; no ELK or dagre. Node positions never in frontmatter | [ADR-003](./ADR.md) |
| 2026-07-24 | Webview assets ship as extension files via `asWebviewUri` under a nonce CSP; no CDN | [ADR-004](./ADR.md) |
| 2026-07-24 | Dispatch Claude Code from the extension host via `child_process`; `ELECTRON_RUN_AS_NODE=1` mandatory | [ADR-005](./ADR.md) |
| 2026-07-24 | MCP server is a standalone stdio package, not an extension of the service-host protocol; nine merged tools | [ADR-006](./ADR.md) |
| 2026-07-24 | Develop in a git worktree with junctioned dependencies — accepted as time-boxed debt | [ADR-007](./ADR.md) |
| 2026-07-24 | Extend `specNodeFrontmatterSchema` in place; never fork it into a parallel `ModuleNode` | [ADR-008](./ADR.md) |

### User rulings on PR #11 — 2026-07-24

| Date | Decision | Where |
|---|---|---|
| 2026-07-24 | **All five ADR deviations approved** — in each case the repo's committed code and rules correctly overrule the brief | [ADR.md](./ADR.md) preamble |
| 2026-07-24 | ADR-003 approved **with a revisit trigger**: the hierarchy is a tree, but contract links create cross-edges. Reconsider a routing library once the canvas renders contract edges **and** hand-rolled routing is ugly — not before | [ADR-003 amendment](./ADR.md) |
| 2026-07-24 | **Work-order scope (Q1):** node's full spec + ancestors' **behaviour summaries** + contracted neighbours' **contract blocks only, never internals**. *"Contracts, not substance" applies to the work order itself.* **Unblocks M4** | [ADR.md Q1](./ADR.md#open-questions) · ARCHITECTURE.md §6 M4 |
| 2026-07-24 | **Manifest format (Q2): JSON** | [ADR.md Q2](./ADR.md#open-questions) |
| 2026-07-24 | **Naming collision (Q3):** keep the `*.v6r` manifest **file**; rename the **directory** to `.vousoir/`. Lands with M1 | [ADR-002 amendment](./ADR.md) |
| 2026-07-24 | **Contract body (Q4):** free-form string per kind now; structured fields added later, additively. **Commitment:** structuring must land **before the milestone that builds Feature 6 (integration testing)** — not before M6, which is the MCP server | [ADR-008](./ADR.md) · ARCHITECTURE.md §6 M6 |
| 2026-07-24 | **Manual placement (Q5): supported**, with an explicit auto-tidy command; auto-layout must never silently override a user's placement. Positions move to `.vousoir/layout.json`. **Supersedes Feature 3's auto-layout-on-every-mutation** — `vousoir-source-of-truth.md:86` is now stale | [ADR-003 amendment](./ADR.md) |
| 2026-07-24 | **Spelling (Q6):** `behaviour` stays — renaming would break committed files and violate ADR-008 | [ADR-008](./ADR.md) |
| 2026-07-24 | **Behaviour's home:** the markdown **body** is canonical; the `behaviour` frontmatter field is a deprecated fallback; text is **never silently migrated** between them. Ratifies what `resolveSpecNodeBehaviour` already does — documentation only. Settled before M3 | [ADR-002 amendment](./ADR.md) |
| 2026-07-24 | **`typings/vousoir/src/v6r-manifest.ts` moves M1 → M2** — ARCHITECTURE.md listed it under M1, the M1 brief did not, and M1 correctly followed the brief. Not a dropped deliverable | ARCHITECTURE.md §6 |
| 2026-07-24 | **`lineWidth: 0` is binding on every YAML serialise** — `yaml` re-wraps past ~80 columns and would silently rewrite a long behaviour or contract body on every save. Enforced at `vousoir/shared/src/spec-store/spec-file.ts:24` | ARCHITECTURE.md §5 |
| 2026-07-24 | **`vousoir/PATCHES.md:63` and `vousoir/HANDOFF.md:183` keep `.v6r/`** — both are historical records, and rewriting a record of the past to match the present is how a ledger stops being trustworthy | ARCHITECTURE.md D9 |
| 2026-07-24 | **M4's "contracted neighbours" ships as a structural approximation** (parent/siblings/children), marked in code — contracts carry no target reference, so the real set is underivable. **Interim, not a decision**; open question 10 must settle it before M6 | [ADR.md Q10](./ADR.md#open-questions) |
| 2026-07-24 | **`phase-2-links` is de-branding, not spec-model links** — one of four `phase-2-*` de-branding branches; commit `1f7fd041daa` drops `code.visualstudio.com` refs. **M4 should not wait for it** | [ADR.md Q10](./ADR.md#open-questions) |
| 2026-07-24 | **Work-order tier 3 ships as parent + siblings + children**, contract blocks only — the ruling's "directly-contracted neighbours" is uncomputable (Q10). **Children matter most**: they are the modules a node composes and is most likely to call, and a siblings-only reading would have dropped them | [ADR.md Q1](./ADR.md#open-questions) |
| 2026-07-24 | **Work orders stay in `.vousoir/cache/`** — challenged and confirmed. A trace records what *happened* and is unreproducible; a work order is regenerable byte-identically from a pure compiler. Committing them churns git for files no human authored and lets a stale work order outlive the spec change that invalidated it. Preservation is M5's dispatch artefact | ARCHITECTURE.md §5 |
| 2026-07-24 | **"Fully specified" is M3's to define** — Feature 4 assumes it, nothing in the model defines it, and `status` is user-set not derived. M3 cannot ship spec-completeness badges without deciding it. Until then the compiler compiles anything and states the node's status. **Forward dependency on M3, not an open question** | ARCHITECTURE.md §6 M4 |
| 2026-07-24 | **Run status is transient, in-memory, event-only** — `DispatchRunStatus = 'idle' \| 'running' \| 'done' \| 'failed'`; cancellation settles as `failed` with `cancelled: true`, not a fifth value. Nothing writes a spec file, so a crashed run cannot leave `building` stuck in a committed file. Whether a *successful* run persists `built` is **deliberately undecided** — Feature 6/8 territory | [ADR-005 amendment](./ADR.md) |
| 2026-07-24 | **The work order goes to the child's stdin, never argv** — Windows caps a command line at ~32,768 chars and a work order with several contracts clears it, so argv would truncate prompts at an unpredictable spec size. `--input-format text` under `--print` | [ADR-005 amendment](./ADR.md) |
| 2026-07-24 | **Only `ELECTRON_RUN_AS_NODE` is set on a dispatch spawn, not `PARENT_PID_ENV_VAR`** — the watchdog is for long-lived supervised services that must self-exit when orphaned; `claude` is a short-lived job that should finish even if the editor closes | [ADR-005 amendment](./ADR.md) |
| 2026-07-24 | **The dispatch engine lives in `@vousoir/shared`, not the extension** — `vousoir-core` has no test runner and cannot cheaply get one while it imports `vscode`, so a dispatcher there would be untestable and the gate meaningless. **General rule: the extension keeps only what needs the editor. Applies to M6** | ARCHITECTURE.md §6 M5 |
| 2026-07-24 | **Traces reuse `traceEventSchema` unchanged**; lines appended one at a time so a crash leaves a readable trace, each schema-validated *before* queueing | ARCHITECTURE.md §6 M5 |
| 2026-07-24 | **`ELECTRON_RUN_AS_NODE` verified three ways** — pure options function, a test that it survives into the real `spawn`, and the live smoke run. No plain-Node test can see its absence | ARCHITECTURE.md §6 M5 |
| 2026-07-24 | **Every structural canvas edit routes through the M1 `SpecStore`** — delete re-parents orphans to the grandparent and refuses roots, re-parent refuses cycles. **The canvas invents no rules**, so the canvas and MCP enforce one rule set rather than two that drift. The most consequential M2 decision | ARCHITECTURE.md §6 M2 |
| 2026-07-24 | **Auto-tidy is a thin wrapper over placement-clearing, not a second layout path** — a test asserts a cleared placement lands the node byte-identically where auto-layout would. **Nothing but Tidy clears placements**, which is how "auto-layout never silently overrides" is enforced structurally rather than by discipline | ARCHITECTURE.md §6 M2 |
| 2026-07-24 | **`CustomTextEditorProvider`, not the full `CustomEditorProvider` ADR-001 sketched** — the `*.v6r` manifest genuinely *is* a text document, so the framework owns dirty state, save and revert. The model lives in `.vousoir/spec/`, not that document | ARCHITECTURE.md §4 |
| 2026-07-24 | **The `structural \| content` mutation classifier is void — do not build it.** Layout runs on command, not on mutation, so nothing needs to classify a mutation. A second-order consequence of the manual-placement ruling that retired the plan's stated highest risk (R1) | [ADR-003](./ADR.md) · ARCHITECTURE.md R1 |
| 2026-07-24 | **`no-orphans` gained one `pathNot` for `extensions/vousoir-*/media/`** — a webview script fetched by URL through `asWebviewUri` can never have an incoming import edge, so flagging it as dead code is a misclassification. **All eight rules intact; no boundary rule relaxed** | ARCHITECTURE.md §2 |
| 2026-07-24 | **`media/canvas.js` is plain JavaScript via the allowlist**, following upstream's convention for this file class (`media-preview/media/*Preview.js`). TypeScript would need excluded DOM lib types plus a second build target to restate an existing convention | `PATCHES.md` row 5 |
| 2026-07-24 | **ADR-006's tool signatures predated ADR-008 and were corrected** — `get_contracts` returns `contracts[]` with the scalar as `legacyContract`; `add_test_case` takes the full test-case schema. Its *decisions* stand and the shipped server matches them; **treat its payload shapes as indicative, `@vousoir/typings` is authoritative** | [ADR-006](./ADR.md) |
| 2026-07-24 | **The nine-tool surface shipped as the ADR specified** — the M6 brief listed a tenth, `compile_work_order`; ADR-006 drops it deliberately, and the discrepancy was flagged rather than silently resolved | [ADR-006](./ADR.md) |
| 2026-07-24 | **MCP server keeps no cached tree** — every call opens, reads, disposes. A snapshot would answer stale *and* clobber a concurrent user edit under last-write-wins | ARCHITECTURE.md §6 M6 |
| 2026-07-24 | **MCP writes go through the M1 `SpecStore`**, so hand-written YAML comments survive an agent changing one field; `get_work_order` calls the same `compileWorkOrder` the editor does, asserted byte-identical against a golden **exported from `@vousoir/shared`, not copied** | ARCHITECTURE.md §6 M6 |
| 2026-07-24 | **The orchestrator is sequential by default — a decision, not a simplification.** `acceptEdits` writes to the user's workspace and worktree isolation is post-M6, so concurrent siblings interleave edits with no conflict detection. A `concurrency` option waits for isolation | ARCHITECTURE.md §6 M6 |
| 2026-07-24 | **`OrchestrationResult` always carries `integrationTests: 'blocked-on-contract-edges'`** with an explanation naming open question 10, so the gap cannot be mistaken for "ran, found nothing" | ARCHITECTURE.md §6 M6 |
| 2026-07-24 | **Live MCP verification uses a temp `mcp.json` via `--mcp-config … --strict-mcp-config`, not `claude mcp add`** — same protocol path, nothing mutated outside the workspace, nothing to clean up. **The pattern for future live checks** | ARCHITECTURE.md §6 M6 |
| 2026-07-24 | **The Claude Code VS Code extension dispatch path was deliberately skipped** — a second path doubles the surface for no capability the CLI path lacks | ARCHITECTURE.md §6 M5 |
| 2026-07-24 | **M4 interface decisions recorded** — scalar-`contract` neighbours included untyped; contract-less neighbours omitted; the node's own sections always render ("declares no contracts") while context sections drop when empty; co-roots are siblings; slugs derive from `id` with a SHA-256 suffix only when sanitising was lossy | ARCHITECTURE.md §6 M4 |

## Open questions awaiting the user

Five of the six original questions were answered on 2026-07-24 and the sixth was resolved by ADR-008.
M1 (PR #12) then raised two more — behaviour's home, and the unwritten `v6r-manifest.ts` — and both are
now answered too (ADR.md open questions 8 and 9). All are kept with their answers in
[`ADR.md`](./ADR.md#open-questions). **Three questions remain:**

1. **Is `.vousoir/layout.json` gitignored or committed?** Deferred by the user. **Nothing blocks on it,
   but it decides itself if ignored:** `V6R_GITIGNORE_CONTENTS` is `cache/\n`, so a file at
   `.vousoir/layout.json` is **committed by default unless someone acts**. Committed means position
   churn in git diffs and conflicts when two people move the same node; gitignored means a collaborator
   cloning the repo gets an unpositioned canvas. Full trade-off in [`ADR.md` open question 7](./ADR.md#open-questions).
2. **Contracts are declarations, not edges — "contracted neighbours" is underivable.** `specNodeContractSchema`
   is `{ id, kind, name, body }` with **no target reference**, so the work-order ruling's tier 3 cannot be
   computed and M6's *"contract-based integration tests between siblings"* has no provider/consumer pair.
   M4 proceeds on a structural approximation (parent/siblings/children), marked in code — **accepted as an
   interim, not a decision.** Lean: add an optional `provider`/`consumes` reference, additive per ADR-008.
   **Must settle before M6, together with the contract-body structuring — they are one prerequisite in two
   halves.** Full framing in [`ADR.md` open question 10](./ADR.md#open-questions) and
   [PR #12 comment](https://github.com/Firelight-Innovations/Vousoir/pull/12#issuecomment-5074389294).
3. **How does Vousoir know how to run a module's tests?** A node's `testCases[]` say *what* must be true;
   nothing in the model says how to **execute** them — runner, command, working-directory convention.
   M6 declined to invent one, correctly. **Blocks every automated verification story:** a node can reach
   `built`, but nothing can move it to `verified`, which has been unreachable since M1. Connects to the
   deferred question of whether `built` means "an agent claimed success" or "the tests pass" — that
   distinction cannot be expressed until this is answered. Options: per-project config field, per-module
   manifest entry, or agent discovery. **No lean** — it turns on how much the product assumes about a
   user's repo. [`ADR.md` open question 11](./ADR.md#open-questions).

**Also now stale, and not ours to fix:** `vousoir-source-of-truth.md` Feature 3 requires auto-layout to
work invisibly and forbids a separate clean-up action (`:86`). The 2026-07-24 ruling requires exactly
that action. The source-of-truth document needs its author's edit; until then it and the ADR disagree,
and the ADR is operative.

## Known-broken

- `npm run gulp compile-extensions` — TS2688 in `extensions/grunt` and `extensions/notebook-renderers`. Caused by the worktree junctions, not by v6r work. Fix is `npm ci` in this worktree. See ARCHITECTURE.md §3 and debt item D2.
