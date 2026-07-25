/**
 * @vousoir/shared — public surface.
 *
 * Shared runtime utilities for the Vousoir layer. Types belong in @vousoir/typings;
 * only runtime helpers live here. Its first real inhabitant is v6rInit(), which
 * scaffolds a well-formed `.vousoir/` folder (work order §8, work-package D); the second is
 * the spec store, which reads and writes the module tree in `.vousoir/spec/` (ADR-002).
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

// The work-order compiler (source-of-truth Feature 4). `compileWorkOrder` is pure; writing
// is a separate step so the user can review before anything reaches disk.
export { compileWorkOrder } from './work-order/compile-work-order.ts';
export { collectWorkOrderContext } from './work-order/work-order-context.ts';
export type { WorkOrderContext } from './work-order/work-order-context.ts';

// The work-order fixture and its golden file are a CROSS-PACKAGE contract, not a private
// test detail: M6's MCP server must compile byte-identically to the editor command, and
// the only way to assert that is for both to test against the same golden. A copy in each
// package would drift, which is precisely the failure the assertion exists to catch.
export { WORK_ORDER_GOLDEN_PATH, WORK_ORDER_TREE_DIR } from './fixtures/work-order-tree-fixture.ts';
export { workOrderSlug } from './work-order/work-order-slug.ts';
export { writeWorkOrder, workOrdersDir } from './work-order/write-work-order.ts';

// Dispatch (source-of-truth Feature 5, ADR-005). `spawn` and `cli` are injectable so a
// caller — or a test — is never forced to launch a real agent.
export { dispatchWorkOrder } from './dispatch/dispatch-work-order.ts';
export type { DispatchRun, DispatchSpawn, DispatchWorkOrderOptions } from './dispatch/dispatch-work-order.ts';
export { claudeCli, claudeMissingMessage, claudeSpawnOptions, findClaudeCli, CLAUDE_COMMAND, CLAUDE_DISPATCH_ARGS } from './dispatch/claude-cli.ts';
export type { ClaudeCli, DispatchSpawnOptions } from './dispatch/claude-cli.ts';
export { mapClaudeStreamLine } from './dispatch/claude-stream-mapper.ts';

// Orchestration: one child agent per sub-module (M6 part B). Sequential by default, since
// `acceptEdits` agents share one workspace until per-run worktree isolation lands.
export { orchestrateSubtree, INTEGRATION_TESTS_BLOCKED_DETAIL } from './orchestrate/orchestrate-subtree.ts';
export type { OrchestrateSubtreeOptions, OrchestrationDispatch } from './orchestrate/orchestrate-subtree.ts';
export { TraceWriter } from './dispatch/trace-writer.ts';
export type { TraceEventBody } from './dispatch/trace-writer.ts';

// Canvas layout (M2). `layoutSpecTree` is a pure function so it can be tested directly;
// everything else on the canvas sits behind a postMessage seam.
export { layoutSpecTree, LAYOUT_METRICS } from './layout/layout-spec-tree.ts';
export type { LayoutOptions } from './layout/layout-spec-tree.ts';
export { clearedLayout, emptyLayout, layoutFilePath, loadLayout, saveLayout, withPosition } from './layout/layout-store.ts';
