/**
 * @vousoir/shared — public surface.
 *
 * Shared runtime utilities for the Vousoir layer. Types belong in @vousoir/typings;
 * only runtime helpers live here. Its first real inhabitant is v6rInit(), which
 * scaffolds a well-formed `.v6r/` folder (work order §8, work-package D); the second is
 * the spec store, which reads and writes the module tree in `.v6r/spec/` (ADR-002).
 */

export { v6rInit } from './v6r-init.ts';
export type { V6rInitOptions, V6rInitResult } from './v6r-init.ts';

export { SpecStore } from './spec-store/spec-store.ts';
export type { SpecNodeDraft, SpecStoreOptions } from './spec-store/spec-store.ts';
export { SpecStoreError } from './spec-store/spec-store-error.ts';
export type { SpecStoreErrorOptions } from './spec-store/spec-store-error.ts';
export type { SpecStoreChange, SpecStoreWatcherOptions } from './spec-store/spec-store-watcher.ts';
export { resolveSpecNodeBehaviour, resolveSpecNodeContracts } from './spec-store/resolve-spec-node.ts';
export type { ResolvedSpecNodeContracts } from './spec-store/resolve-spec-node.ts';

// The tree assembly and path derivation are exported so the canvas can reason about the
// tree without re-deriving either — §7.3's "no package redeclares a shared shape locally"
// applies to behaviour as much as to types.
export { buildSpecTree } from './spec-store/spec-tree.ts';
export { specNodeDescendantIds, specNodeIdChain } from './spec-store/spec-tree-walk.ts';
export { specNodePaths, SPEC_FILE_EXTENSION } from './spec-store/spec-paths.ts';
export type { SpecNodePaths } from './spec-store/spec-paths.ts';
