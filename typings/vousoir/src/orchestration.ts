/**
 * Orchestrating a parent module's children: one child agent per sub-module, results
 * collected (source-of-truth Feature 5's fan-out, and the M6 brief's orchestrator).
 *
 * **Integration testing across siblings is deliberately absent, not forgotten.** The brief
 * asks the orchestrator to run contract-based integration tests between siblings, which
 * requires knowing which sibling PROVIDES a contract and which CONSUMES it.
 * `specNodeContractSchema` is `{ id, kind, name, body }` with no target reference, so that
 * pairing is not derivable from the model — it is ADR open question 10, unresolved. The
 * result type says so explicitly rather than leaving a caller to infer it from an empty
 * array, because a wrong pairing is worse than a missing one.
 */

/** Per-child outcome. Mirrors `DispatchRunResult`, one entry per sub-module. */
export interface OrchestrationChildResult {
	readonly nodeId: string;
	readonly title: string;
	readonly status: 'done' | 'failed' | 'skipped';
	readonly exitCode: number | null;
	readonly cancelled: boolean;
	/** Absent when the child was skipped before any run started. */
	readonly tracePath: string | undefined;
	readonly failure: string | undefined;
}

/** Why cross-sibling integration testing did not run. */
export type OrchestrationIntegrationState = 'blocked-on-contract-edges';

/** The result of orchestrating one parent's children. */
export interface OrchestrationResult {
	readonly parentId: string;
	/** One entry per direct child, in the order they were dispatched. */
	readonly children: readonly OrchestrationChildResult[];
	/** True only when every child finished `done`. */
	readonly allSucceeded: boolean;
	/**
	 * Always `blocked-on-contract-edges` today. Kept as a field rather than omitted so the
	 * gap is visible in every result a caller inspects or logs.
	 */
	readonly integrationTests: OrchestrationIntegrationState;
	/** Human-readable explanation of the block, safe to surface in a UI. */
	readonly integrationTestsDetail: string;
}
