/**
 * Orchestration fan-out. No test spawns an agent: `dispatch` is injected, so these assert
 * what the orchestrator decides — which children, in what order, with what CLI — rather
 * than what a child agent happens to do.
 */

import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DispatchRunResult, SpecTree } from '@vousoir/typings';
import { seedSpecTreeFixture } from '../fixtures/spec-tree-fixture.ts';
import { SpecStore } from '../spec-store/spec-store.ts';
import type { DispatchRun } from '../dispatch/dispatch-work-order.ts';
import { INTEGRATION_TESTS_BLOCKED_DETAIL, orchestrateSubtree, type OrchestrationDispatch } from './orchestrate-subtree.ts';

interface Call {
	readonly nodeId: string;
	readonly command: string;
	readonly args: readonly string[];
	readonly markdown: string;
}

let repoRoot: string;
let tree: SpecTree;

beforeEach(async () => {
	({ repoRoot } = await seedSpecTreeFixture());
	const store = await SpecStore.open({ repoRoot });
	tree = store.tree;
	store.dispose();
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

/** Records every dispatch and settles each one with the outcome the test asks for. */
function recorder(outcome: (nodeId: string) => Partial<DispatchRunResult> = () => ({})): {
	calls: Call[];
	dispatch: OrchestrationDispatch;
} {
	const calls: Call[] = [];
	const dispatch = ((options) => {
		const nodeId = options.workOrder.nodeId;
		calls.push({
			nodeId,
			command: options.cli?.command ?? 'claude',
			args: options.cli?.args ?? [],
			markdown: options.workOrder.markdown,
		});
		const result: DispatchRunResult = {
			runId: `run-${nodeId}`,
			nodeId,
			status: 'done',
			exitCode: 0,
			cancelled: false,
			tracePath: `/traces/${nodeId}.jsonl`,
			failure: undefined,
			...outcome(nodeId),
		};
		const run: DispatchRun = {
			runId: result.runId,
			tracePath: result.tracePath,
			status: result.status === 'done' ? 'done' : 'failed',
			result: Promise.resolve(result),
			cancel: () => undefined,
		};
		return Promise.resolve(run);
	}) as OrchestrationDispatch;
	return { calls, dispatch };
}

describe('orchestrateSubtree', () => {
	it('dispatches one agent per direct child, and only direct children', async () => {
		const { calls, dispatch } = recorder();
		const result = await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch });

		expect(calls.map((call) => call.nodeId)).toEqual(['api', 'storage']);
		expect(calls.map((call) => call.nodeId)).not.toContain('users');
		expect(result.children.map((child) => child.nodeId)).toEqual(['api', 'storage']);
		expect(result.allSucceeded).toBe(true);
	});

	it('gives each child its own compiled work order, not the one for its parent', async () => {
		const { calls, dispatch } = recorder();
		await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch });

		const api = calls.find((call) => call.nodeId === 'api');
		expect(api?.markdown).toContain('v6r-node: api');
		expect(api?.markdown).toContain('Stamp `v6r-node: api`');
	});

	it('pins child agents to the requested model', async () => {
		const { calls, dispatch } = recorder();
		await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch, childModel: 'sonnet' });

		expect(calls[0]?.args.join(' ')).toContain('--model sonnet');
		expect(calls[0]?.args).toContain('acceptEdits');
	});

	it('omits --model when none is asked for', async () => {
		const { calls, dispatch } = recorder();
		await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch });
		expect(calls[0]?.args).not.toContain('--model');
	});

	it('collects a failing child without abandoning the rest', async () => {
		const { dispatch } = recorder((nodeId) =>
			nodeId === 'api' ? { status: 'failed', exitCode: 2, failure: 'claude exited with code 2.' } : {},
		);
		const result = await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch });

		expect(result.children.map((child) => child.status)).toEqual(['failed', 'done']);
		expect(result.children[0]?.failure).toContain('exited with code 2');
		expect(result.allSucceeded).toBe(false);
	});

	it('reports a parent with no children as a vacuous success', async () => {
		const { calls, dispatch } = recorder();
		const result = await orchestrateSubtree({ repoRoot, tree, parentId: 'users', dispatch });
		expect(calls).toEqual([]);
		expect(result.children).toEqual([]);
		expect(result.allSucceeded).toBe(true);
	});

	it('skips remaining children once cancelled, rather than dispatching them', async () => {
		const signal = { aborted: true };
		const { calls, dispatch } = recorder();
		const result = await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch, signal });

		expect(calls).toEqual([]);
		expect(result.children.map((child) => child.status)).toEqual(['skipped', 'skipped']);
		expect(result.children[0]?.failure).toContain('cancelled');
	});

	it('names an unknown parent rather than silently orchestrating nothing', async () => {
		const { dispatch } = recorder();
		await expect(orchestrateSubtree({ repoRoot, tree, parentId: 'ghost', dispatch })).rejects.toThrow(
			/no spec module with id "ghost"/,
		);
	});
});

describe('cross-sibling integration tests', () => {
	it('are reported as blocked on contract edges, not silently skipped', async () => {
		const { dispatch } = recorder();
		const result = await orchestrateSubtree({ repoRoot, tree, parentId: 'root', dispatch });

		expect(result.integrationTests).toBe('blocked-on-contract-edges');
		expect(result.integrationTestsDetail).toBe(INTEGRATION_TESTS_BLOCKED_DETAIL);
		expect(result.integrationTestsDetail).toContain('open question 10');
	});
});
