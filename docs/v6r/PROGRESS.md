# Vousoir (v6r) — Progress

Updated after every milestone. Docs: [`ADR.md`](./ADR.md) (why) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) (how and where).

**Gate for every milestone:** `cd vousoir; pnpm run verify` green. Currently 66 tests, exit 0.

## Milestones

| Milestone | Status | Branch | PR | Notes |
|---|---|---|---|---|
| **M0 — Recon** | ✅ Complete | `v6r/m0-recon` | *(see PR)* | 8 ADRs + architecture map + this tracker. Docs only, no feature code. Verified every citation against the tree; 4 briefed claims were wrong (see PR body). |
| **M1 — Model + spec store** | ✅ Complete | `v6r/m1-model` | [#12](https://github.com/Firelight-Innovations/Vousoir/pull/12) | Schema extended in place (ADR-008): typed `contracts[]`, optional given/when/then, scalar `contract` kept. `SpecStore` in `@vousoir/shared` — load/save/CRUD/nest/watch, byte-identical round trip. Brought `yaml@2.9.0` (closes D7). 22 → 66 tests. |
| **M2 — Canvas editor + auto-layout** | ⬜ Pending | — | — | `registerCustomEditorProvider` on `*.v6r`; hand-rolled recursive layout (ADR-003). Biggest risk: layout thrash. |
| **M3 — Per-node spec panel** | ⬜ Pending | — | — | Behaviour / Contracts / Test Cases; writes one `.md` per node. Needs the external-edit watcher. |
| **M4 — Work-order compiler** | ⬜ Pending | — | — | **Blocked on open question 1** — exact work-order scope. Get the user's call first. |
| **M5 — Dispatch to Claude Code** | ⬜ Pending | — | — | `child_process` from the extension host (ADR-005). `ELECTRON_RUN_AS_NODE=1` mandatory. |
| **M6 — Orchestration + MCP server** | ⬜ Pending | — | — | Standalone `vousoir/services/spec-mcp/` (ADR-006). Nine tools. |

## Decision log

| Date | Decision | Where |
|---|---|---|
| 2026-07-24 | Canvas ships as a built-in extension (extend `vousoir-core`), not a core workbench contrib — `core-not-import-vousoir` makes a contrib unable to import the model at all | [ADR-001](./ADR.md) |
| 2026-07-24 | Specs are markdown + YAML frontmatter under `.v6r/spec/`; `*.v6r` is a thin manifest | [ADR-002](./ADR.md) |
| 2026-07-24 | Hand-rolled recursive tree layout; no ELK or dagre. Node positions are derived data in `.v6r/cache/`, never in frontmatter | [ADR-003](./ADR.md) |
| 2026-07-24 | Webview assets ship as extension files via `asWebviewUri` under a nonce CSP; no CDN | [ADR-004](./ADR.md) |
| 2026-07-24 | Dispatch Claude Code from the extension host via `child_process`; `ELECTRON_RUN_AS_NODE=1` mandatory | [ADR-005](./ADR.md) |
| 2026-07-24 | MCP server is a standalone stdio package, not an extension of the service-host protocol; nine merged tools | [ADR-006](./ADR.md) |
| 2026-07-24 | Develop in a git worktree with junctioned dependencies — accepted as time-boxed debt | [ADR-007](./ADR.md) |
| 2026-07-24 | Extend `specNodeFrontmatterSchema` in place; never fork it into a parallel `ModuleNode` | [ADR-008](./ADR.md) |
| 2026-07-24 | Spec store lives in `@vousoir/shared`, not `vousoir/services/` — `ext-imports-only-typings-and-shared` already lets the canvas import it in-process, so a service would cost M2 an IPC layer for isolation the canvas does not need | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | YAML parser is `yaml@2.9.0`, not `js-yaml` — its Document API preserves comments and formatting on a targeted edit; `js-yaml` would silently eat a hand-written comment on the next save, against Feature 10 | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | **Deleting a node with children re-parents the orphans to the deleted node's parent; it never cascades.** No undo stack exists, and a re-parent is visible and reversible where a lost subtree is not | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | **Deleting a root is refused** — a root being any node whose `parent` is `null` | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | Spec files are `<ancestors…>/<id>.md` with children in the sibling `<ancestors…>/<id>/`. Paths derive from `id`, never `title`, so `rename` moves nothing and re-parenting a subtree is one directory rename | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | Cycles are rejected in two places: `reparent` refuses a new parent inside the node's descendant set, and `load` independently refuses a cycle already on disk | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | `save()` refuses to change `parent`; that path is `reparent()`, which moves the files with it | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | Behaviour is read from the markdown body first, falling back to the frontmatter `behaviour` field. Neither form is ever rewritten into the other, so no file gets a whole-file diff on first save. **Needs the user's call before M3** | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |
| 2026-07-24 | cgmanifest obligation confirmed **not** to extend to `vousoir/pnpm-lock.yaml` — the only scanners are Azure-Pipelines-driven and read npm/Cargo lockfiles and cgmanifest git components | M1 ([#12](https://github.com/Firelight-Innovations/Vousoir/pull/12)) |

## Open questions awaiting the user

Ranked; full text and proposed resolutions in [`ADR.md`](./ADR.md#open-questions).

1. **Work-order scope** — immediate spec only vs + ancestors vs + contracted neighbours. **Gates M4.**
2. `*.v6r` manifest format — JSON (proposed) or YAML.
3. `*.v6r` file vs the `.v6r/` directory — filename-pattern collision. **Decide in M2, before any user repo has a `.v6r` file.**
4. `contractSchema` body — free-form string (proposed) or structured. **M1 shipped the free-form string**; a comment in the schema records how to structure it later without invalidating any file.
5. Manual node placement and whether auto-layout may override it.
6. `behaviour` vs `behavior` — keep the shipped British spelling (proposed).
7. **New in M1 — is the markdown body the behaviour, or is the frontmatter `behaviour` field?** The M1 brief says the body; ADR-002 says only that the body is unconstrained prose. M1 reads both, prefers the body, and moves text between neither. **Decide before M3 builds the spec panel.**
8. **New in M1 — `typings/vousoir/src/v6r-manifest.ts` was not written.** ARCHITECTURE.md §6 lists it as an M1 creation; the M1 brief's deliverable does not include it. Deferred to M2, which has to answer the `*.v6r` filename question (open question 3) anyway.

Also pending review: **ADR-003 overrules the Stage 3 tech-stack selection** of React Flow + ELK.

## Known-broken

- `npm run gulp compile-extensions` — TS2688 in `extensions/grunt` and `extensions/notebook-renderers`. Caused by the worktree junctions, not by v6r work. Fix is `npm ci` in this worktree. See ARCHITECTURE.md §3 and debt item D2.
