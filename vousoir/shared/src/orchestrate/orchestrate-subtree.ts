/**
 * Fans a parent module out to one child agent per sub-module and collects the results.
 *
 * Each child gets its own compiled work order and its own dispatch, so each child agent
 * receives exactly the spec for the module it is building plus its neighbours' edges —
 * the same "contracts, not substance" bound M4 enforces. Nothing about orchestration
 * widens what a child is told.
 *
 * **Children run sequentially by default, and that is a deliberate choice rather than a
 * simplification.** `--permission-mode acceptEdits` writes into the user's workspace, and
 * per-run worktree isolation does not exist until after M6. Two agents editing the same
 * tree concurrently produce interleaved edits with no conflict detection and no way to
 * attribute a bad change to a run. `concurrency` is exposed for when isolation lands.
 *
 * **Cross-sibling integration testing is not implemented, and is reported as blocked.**
 * See `orchestration.ts` — contracts carry no target reference, so provider/consumer
 * pairing is not derivable. Inferring it from prose contract bodies would be guessing, and
 * a wrong pairing is worse than a missing one.
 */

import type {
	DispatchEvent,
	OrchestrationChildResult,
	OrchestrationResult,
	SpecTree,
} from '@vousoir/typings';
import { compileWorkOrder } from '../work-order/compile-work-order.ts';
import { claudeCli } from '../dispatch/claude-cli.ts';
import { dispatchWorkOrder, type DispatchSpawn } from '../dispatch/dispatch-work-order.ts';

/** Why sibling integration tests do not run. Surfaced verbatim in the result. */
export const INTEGRATION_TESTS_BLOCKED_DETAIL =
	'Cross-sibling contract integration tests are not run: a contract declares { id, kind, name, body } ' +
	'with no reference to the module on the other side, so which sibling provides and which consumes ' +
	'cannot be derived from the spec. Tracked as ADR open question 10.';

/** The seam every dispatch goes through, so a test never launches a real agent. */
export type OrchestrationDispatch = typeof dispatchWorkOrder;

/** What one orchestration run needs. */
export interface OrchestrateSubtreeOptions {
	readonly repoRoot: string;
	readonly tree: SpecTree;
	/** The module whose direct children are built. */
	readonly parentId: string;
	/** Model for the child agents, e.g. `sonnet`. Omitted, the CLI picks its default. */
	readonly childModel?: string;
	/** How many children may run at once. Defaults to 1 — see the file docblock. */
	readonly concurrency?: number;
	readonly dispatch?: OrchestrationDispatch;
	readonly spawn?: DispatchSpawn;
	readonly onEvent?: (nodeId: string, event: DispatchEvent) => void;
	/** Stops before dispatching the next child. Children already running are not killed. */
	readonly signal?: { readonly aborted: boolean };
}

/** Builds every direct child of `parentId`, one agent each. */
export async function orchestrateSubtree(options: OrchestrateSubtreeOptions): Promise<OrchestrationResult> {
	const parent = options.tree.byId.get(options.parentId);
	if (parent === undefined) {
		throw new Error(`Cannot orchestrate: there is no spec module with id "${options.parentId}".`);
	}
	const children = [...options.tree.byId.values()]
		.filter((node) => node.frontmatter.parent === options.parentId)
		.sort((left, right) => left.id.localeCompare(right.id));

	const results = await runInBatches(children.map((child) => child.id), Math.max(1, options.concurrency ?? 1), (id) =>
		buildChild(options, id),
	);

	return {
		parentId: options.parentId,
		children: results,
		allSucceeded: results.every((child) => child.status === 'done'),
		integrationTests: 'blocked-on-contract-edges',
		integrationTestsDetail: INTEGRATION_TESTS_BLOCKED_DETAIL,
	};
}

async function buildChild(options: OrchestrateSubtreeOptions, nodeId: string): Promise<OrchestrationChildResult> {
	const title = options.tree.byId.get(nodeId)?.frontmatter.title ?? nodeId;
	if (options.signal?.aborted === true) {
		return skipped(nodeId, title, 'Orchestration was cancelled before this module started.');
	}

	const dispatch = options.dispatch ?? dispatchWorkOrder;
	const workOrder = compileWorkOrder(options.tree, nodeId);
	const run = await dispatch({
		repoRoot: options.repoRoot,
		workOrder,
		cli: claudeCli(options.childModel),
		...(options.spawn === undefined ? {} : { spawn: options.spawn }),
		onEvent: (event) => options.onEvent?.(nodeId, event),
	});
	const result = await run.result;
	return {
		nodeId,
		title,
		status: result.status,
		exitCode: result.exitCode,
		cancelled: result.cancelled,
		tracePath: result.tracePath,
		failure: result.failure,
	};
}

function skipped(nodeId: string, title: string, reason: string): OrchestrationChildResult {
	return { nodeId, title, status: 'skipped', exitCode: null, cancelled: true, tracePath: undefined, failure: reason };
}

/**
 * Runs `work` over `ids` at most `size` at a time, preserving input order in the output.
 *
 * `Promise.all` over everything would ignore the concurrency limit that exists to stop
 * concurrent agents trampling each other's edits.
 */
async function runInBatches<T>(
	ids: readonly string[],
	size: number,
	work: (id: string) => Promise<T>,
): Promise<readonly T[]> {
	const results: T[] = [];
	for (let index = 0; index < ids.length; index += size) {
		const batch = ids.slice(index, index + size);
		results.push(...(await Promise.all(batch.map(work))));
	}
	return results;
}
