/**
 * The golden-file spine of M4, plus the properties the golden alone would not pin down.
 *
 * A byte-exact golden is the right test here because a work order is a prompt: whitespace,
 * heading level and ordering all change how an agent reads it, and none of that is caught
 * by asserting on substrings.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SpecTree } from '@vousoir/typings';
import { WORK_ORDER_GOLDEN_PATH, loadWorkOrderTree } from '../fixtures/work-order-tree-fixture.ts';
import { SpecStoreError } from '../spec-store/spec-store-error.ts';
import { compileWorkOrder } from './compile-work-order.ts';
import { writeWorkOrder, workOrdersDir } from './write-work-order.ts';

let tree: SpecTree;

beforeAll(async () => {
	tree = await loadWorkOrderTree();
});

describe('compileWorkOrder', () => {
	it('matches the golden file byte for byte', async () => {
		const expected = await readFile(WORK_ORDER_GOLDEN_PATH, 'utf8');
		expect(compileWorkOrder(tree, 'api').markdown).toBe(expected);
	});

	it('is deterministic — the same tree compiles to the same bytes', () => {
		expect(compileWorkOrder(tree, 'api').markdown).toBe(compileWorkOrder(tree, 'api').markdown);
	});

	it('carries a parseable v6r-node header even when the title holds YAML metacharacters', () => {
		const { markdown } = compileWorkOrder(tree, 'api');
		const header = /^---\n([\s\S]*?)\n---\n/.exec(markdown)?.[1];
		expect(header).toBeDefined();
		const parsed = parse(header ?? '') as Record<string, unknown>;
		expect(parsed['v6r-node']).toBe('api');
		expect(parsed['v6r-title']).toBe('HTTP API: the module tree');
		expect(parsed['v6r-status']).toBe('specified');
	});

	it('tells the agent to stamp the node id into every file it touches', () => {
		const { markdown } = compileWorkOrder(tree, 'api');
		expect(markdown).toContain('**Stamp `v6r-node: api` into every file you create or modify');
		expect(markdown).toMatch(/comment at the top of the file/);
	});

	it('does not re-wrap a behaviour line past eighty columns', () => {
		const { markdown } = compileWorkOrder(tree, 'api');
		const sentence = 'this sentence is deliberately longer than eighty columns so that a regression '
			+ "in the YAML serialiser's line folding would show up as a mangled work order rather than as a "
			+ 'silent rewrite.';
		expect(markdown).toContain(sentence);
	});

	it('names the node when asked to compile something that does not exist', () => {
		expect(() => compileWorkOrder(tree, 'ghost')).toThrow(SpecStoreError);
		expect(() => compileWorkOrder(tree, 'ghost')).toThrow(/there is no spec node with id "ghost"/);
	});
});

describe('writeWorkOrder', () => {
	let repoRoot: string;

	beforeAll(async () => {
		repoRoot = await mkdtemp(join(tmpdir(), 'v6r-work-order-'));
	});

	afterAll(async () => {
		await rm(repoRoot, { recursive: true, force: true });
	});

	it('writes to .vousoir/cache/work-orders/<slug>.md, creating the directory', async () => {
		const workOrder = compileWorkOrder(tree, 'api');
		const filePath = await writeWorkOrder(repoRoot, workOrder);

		expect(filePath).toBe(join(repoRoot, '.vousoir', 'cache', 'work-orders', 'api.md'));
		expect(workOrdersDir(repoRoot)).toBe(join(repoRoot, '.vousoir', 'cache', 'work-orders'));
		expect(await readFile(filePath, 'utf8')).toBe(workOrder.markdown);
	});
});
