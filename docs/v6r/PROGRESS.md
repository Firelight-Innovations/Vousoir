# Vousoir (v6r) — Progress

Updated after every milestone. Docs: [`ADR.md`](./ADR.md) (why) · [`ARCHITECTURE.md`](./ARCHITECTURE.md) (how and where).

**Gate for every milestone:** `cd vousoir; pnpm run verify` green. Currently 22 tests, exit 0.

## Milestones

| Milestone | Status | Branch | PR | Notes |
|---|---|---|---|---|
| **M0 — Recon** | ✅ Complete | `v6r/m0-recon` | *(see PR)* | 8 ADRs + architecture map + this tracker. Docs only, no feature code. Verified every citation against the tree; 4 briefed claims were wrong (see PR body). |
| **M1 — Model + spec store** | ⬜ Pending | — | — | Extend `specNodeFrontmatterSchema` in place (ADR-008): typed `contracts[]`, optional given/when/then. Brings the first YAML dependency. |
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

## Open questions awaiting the user

Ranked; full text and proposed resolutions in [`ADR.md`](./ADR.md#open-questions).

1. **Work-order scope** — immediate spec only vs + ancestors vs + contracted neighbours. **Gates M4.**
2. `*.v6r` manifest format — JSON (proposed) or YAML.
3. `*.v6r` file vs the `.v6r/` directory — filename-pattern collision. **Decide in M2, before any user repo has a `.v6r` file.**
4. `contractSchema` body — free-form string (proposed) or structured.
5. Manual node placement and whether auto-layout may override it.
6. `behaviour` vs `behavior` — keep the shipped British spelling (proposed).

Also pending review: **ADR-003 overrules the Stage 3 tech-stack selection** of React Flow + ELK.

## Known-broken

- `npm run gulp compile-extensions` — TS2688 in `extensions/grunt` and `extensions/notebook-renderers`. Caused by the worktree junctions, not by v6r work. Fix is `npm ci` in this worktree. See ARCHITECTURE.md §3 and debt item D2.
