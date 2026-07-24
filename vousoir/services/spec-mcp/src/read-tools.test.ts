/**
 * The five read tools.
 *
 * The load-bearing one is the `get_work_order` assertion: it compares against the SAME
 * golden `@vousoir/shared` compiles for the editor command. If the two paths ever diverge,
 * an agent would build against a work order the user never reviewed — so this is the test
 * that stops that silently.
 */

import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORK_ORDER_GOLDEN_PATH, compileWorkOrder } from '@vousoir/shared';
import {
	getContractsOutputSchema,
	getModuleOutputSchema,
	getNeighborContextOutputSchema,
	getWorkOrderOutputSchema,
	listModulesOutputSchema,
} from '@vousoir/typings';
import { seedMcpTestRepo } from './fixtures/mcp-test-repo.ts';
import { getContracts, getModule, getNeighborContext, getWorkOrder, listModules } from './read-tools.ts';
import { withSpecStore } from './spec-session.ts';

let repoRoot: string;
let specDir: string;

beforeEach(async () => {
	({ repoRoot, specDir } = await seedMcpTestRepo());
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

describe('list_modules', () => {
	it('returns every module with its parent, so the tree is reconstructable', async () => {
		const result = await listModules(repoRoot);
		expect(listModulesOutputSchema.safeParse(result).success).toBe(true);
		expect(result.modules.map((module) => module.id)).toEqual(['api', 'root', 'storage', 'users']);
		expect(result.modules.find((module) => module.id === 'root')?.parent).toBeNull();
		expect(result.modules.find((module) => module.id === 'users')?.parent).toBe('api');
	});
});

describe('get_module', () => {
	it('returns validated frontmatter, the markdown body, and the file path', async () => {
		const result = await getModule(repoRoot, { id: 'api' });
		expect(getModuleOutputSchema.safeParse(result).success).toBe(true);
		expect(result.frontmatter.title).toBe('HTTP API: the module tree');
		expect(result.body).toContain('Serves the module tree over HTTP');
		expect(result.filePath).toBe(join(specDir, 'root', 'api.md'));
	});

	it('names the tool to call next when the id is unknown', async () => {
		await expect(getModule(repoRoot, { id: 'ghost' })).rejects.toThrow(/no spec module with id "ghost"[\s\S]*list_modules/);
	});
});

describe('get_contracts', () => {
	it('returns typed contracts for one module by default', async () => {
		const result = await getContracts(repoRoot, { id: 'api' });
		expect(getContractsOutputSchema.safeParse(result).success).toBe(true);
		expect(result.module.contracts.map((contract) => contract.kind)).toEqual(['serviceApi', 'dbSchema']);
		expect(result.neighbours).toBeUndefined();
	});

	it('surfaces the deprecated scalar separately, never promoted into the typed array', async () => {
		const result = await getContracts(repoRoot, { id: 'root' });
		expect(result.module.contracts).toEqual([]);
		expect(result.module.legacyContract).toContain('The product owns nothing directly');
	});

	it('includes parent, siblings and children on request', async () => {
		const result = await getContracts(repoRoot, { id: 'api', includeNeighbours: true });
		expect(result.neighbours?.map((neighbour) => neighbour.id)).toEqual(['root', 'storage', 'users']);
	});
});

describe('get_neighbor_context', () => {
	it('gives ancestors one paragraph each and neighbours contracts only', async () => {
		const result = await getNeighborContext(repoRoot, { id: 'api' });
		expect(getNeighborContextOutputSchema.safeParse(result).success).toBe(true);
		expect(result.ancestors.map((ancestor) => ancestor.id)).toEqual(['root']);
		expect(result.ancestors[0]?.summary).not.toContain('ROOT-SECOND-PARAGRAPH');

		const serialised = JSON.stringify(result);
		expect(serialised).toContain('SpecStore.load');
		expect(serialised).not.toContain('LEAKED-SIBLING-BODY');
		expect(serialised).not.toContain('LEAKED-CHILD-TESTCASE-DESCRIPTION');
	});
});

describe('get_work_order', () => {
	it('compiles byte-identically to the golden the editor command is held to', async () => {
		const result = await getWorkOrder(repoRoot, { id: 'api' });
		expect(getWorkOrderOutputSchema.safeParse(result).success).toBe(true);
		expect(result.markdown).toBe(await readFile(WORK_ORDER_GOLDEN_PATH, 'utf8'));
	});

	it('is the same call the editor makes, not a parallel implementation', async () => {
		const viaMcp = await getWorkOrder(repoRoot, { id: 'storage' });
		const viaEditor = await withSpecStore(repoRoot, (store) => compileWorkOrder(store.tree, 'storage'));
		expect(viaMcp).toEqual(viaEditor);
	});
});
