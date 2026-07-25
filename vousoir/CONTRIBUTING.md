# Contributing to the Vousoir layer

Scope: `typings/`, `vousoir/`, and `extensions/vousoir-*`. Inherited code-oss core keeps its own
upstream conventions and lint config — **do not reformat upstream code**, it would make every
upstream merge a war (work order §7.4). For code-oss's own guidance see the repo-root
`CONTRIBUTING.md`.

Build instructions: [`../BUILDING.md`](../BUILDING.md). Patch ledger: [`PATCHES.md`](./PATCHES.md).

---

## The one rule that matters most

> **A module is defined by its edges, not its substance.**

Vousoir is named for the voussoir — the wedge-shaped stone in an arch, defined entirely by its
precisely-cut edges. What is inside a package is the implementer's business. What crosses its
boundary is everyone's business, and is enforced mechanically.

---

## Structure rules (enforced by `pnpm run lint`)

### One thing per file

Exactly **one primary export per file**: one class, or one major function, or one cohesive
constant group. That primary export defines the file's single responsibility. Small private
helpers used *only* by that export may live in the same file.

`max-classes-per-file: 1` enforces the class case mechanically. The rest is a review rule — if a
file has two primary exports that could be used independently, it is two files.

### File length

| Threshold | Severity |
|---|---|
| 300 lines | **warning** — a signal to decompose |
| 500 lines | **error** — blocks CI |

Warnings fail CI too (`lint:strict` runs with `--max-warnings=0`), so treat 300 as the real
budget. `max-lines-per-function` warns at 80 for the same reason.

### Types live in `@vousoir/typings`

Every cross-package data shape — service manifests, trace events, spec frontmatter, `.vousoir`
layout, future MCP tool payloads — is defined in `typings/vousoir` and imported everywhere else.
**No package redeclares a shared shape locally.**

`typings/` contains **only** type declarations, interfaces, enums-as-const, and zod schemas.
Schemas are the one allowed runtime content, because an MCP tool contract derives its types from
its schema — the schema *is* the contract. dependency-cruiser enforces that `typings/` imports
nothing except zod.

### Other conventions

- **Strict TypeScript.** `strict`, `noUncheckedIndexedAccess`, and friends via
  `vousoir/tsconfig.base.json`. No `any` — except in a `boundaries/` subfolder, the explicitly
  marked escape hatch for third-party interop.
- **Naming.** camelCase code, kebab-case filenames, `SCREAMING_SNAKE` constants, PascalCase types.
- Need ambient types? Opt in explicitly (`"types": ["node"]`). The base defaults to `[]`.

---

## Boundary rules (enforced by `pnpm run dep-check`)

Two independent walls guard compartmentalization:

1. **Node's `exports` seal** (runtime) — every package declares an `exports` field exposing only
   its public surface. Deep imports fail at resolution with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
2. **dependency-cruiser** (CI) — refuses boundary violations in source.

| Rule | Meaning |
|---|---|
| `no-cross-service-imports` | Services never import each other; they talk over MCP/IPC. `service-host` alone may import service manifests. |
| `ext-imports-only-typings-and-shared` | `extensions/vousoir-*` may import `@vousoir/typings` and `@vousoir/shared` — nothing else from the Vousoir tree. |
| `vousoir-layer-not-import-core` | Nothing in the Vousoir layer imports code-oss core (`src/`). The extension bridges via the public `vscode` API. |
| `core-not-import-vousoir` | code-oss core never imports Vousoir. The extension is the only bridge. |
| `typings-only-imports-zod` | `typings/` imports nothing but zod. |
| `no-circular` | No dependency cycles. |
| `no-orphans` | Dead code fails CI. Package entry points are exempt. |
| `no-unresolvable` | An import that does not resolve fails CI. |

**Depend on siblings only via workspace references** (`"@vousoir/typings": "workspace:*"`), never
relative paths across package roots.

### Hitting a boundary error?

Do **not** route around it. A boundary error is a design signal:

- Need a shape from another package? Move it to `@vousoir/typings`.
- Need behaviour from another service? That is an MCP/IPC surface, not an import.
- Genuinely need something a package does not export? Widen that package's `exports`
  deliberately, as a reviewed change to its public contract.

---

## Adding a package

1. Create it under `vousoir/services/*`, `vousoir/shared`, `typings/*`, or `extensions/vousoir-*`
   (the globs in `vousoir/pnpm-workspace.yaml`).
2. Give it a `package.json` with a **sealed `exports`** field and `"private": true`.
3. Add a `tsconfig.json` extending `vousoir/tsconfig.base.json`.
4. Declare sibling deps as `workspace:*`.
5. Run `pnpm install` from `vousoir/`, then `pnpm run verify`.

A new package must be born green.

---

## Touching code-oss core

Prefer, in order: `product.json` → a built-in extension → configuration → *then* a core edit.

Any change to a code-oss core file (anything outside `extensions/vousoir-*` and `vousoir/`)
**must** be logged in [`PATCHES.md`](./PATCHES.md) with file, change, rationale, and upstream
merge risk. **Budget: under 15 core patches** for the shell work order. Every core patch is a
future merge conflict, so spend them deliberately.

---

## Before you push

```bash
cd vousoir && pnpm run verify
```

CI runs exactly this on Windows, plus code-oss build jobs on Windows, macOS, and Linux.
