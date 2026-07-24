/**
 * @vousoir/typings — public surface.
 *
 * The single home for every cross-package data shape in Vousoir: service manifests,
 * trace events, spec-node frontmatter, `.v6r` layout, and (later) MCP tool payloads.
 * Only type declarations, enums-as-const, and zod schemas live here — zod is the one
 * permitted runtime dependency because a schema *is* an MCP tool contract (§7.3).
 *
 * This barrel is the package's ONLY entry point: `exports` seals everything else, so a
 * deep import such as `@vousoir/typings/src/...` fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
 * Anything a sibling package needs must be re-exported here.
 */

// Service manifest + service-host lifecycle contracts (work order §6.2).
// The shared seam between extensions/vousoir-core and vousoir/services/service-host.
export * from './service-lifecycle.ts';

// The stdio protocol the extension speaks to the spawned service-host process
// (see vousoir/PATCHES.md A1: the extension spawns the host, it never imports it).
export * from './service-host-protocol.ts';

// The `.v6r/` per-repo project-data folder layout (work order §8).
export * from './v6r-layout.ts';

// Trace-event schema for `.v6r/traces/*.jsonl` (work order §8, trace capture decision 5).
export * from './trace-event.ts';

// Spec-tree node frontmatter schema for `.v6r/spec/**/*.md` (work order §8).
export * from './spec-node-frontmatter.ts';

// The loaded-node and assembled-tree shapes the spec store returns (ADR-002, ADR-008).
export * from './spec-node.ts';
