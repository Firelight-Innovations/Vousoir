/**
 * The four write tools, plus the property that makes them safe to hand an agent: writing
 * through the M1 store means a one-field edit stays a one-field edit on disk, comments and
 * all. An agent that rewrote a user's whole spec file to change a status would be a
 * regression no schema check would catch.
 */

import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mcpWriteResultSchema } from '@vousoir/typings';
import { seedMcpTestRepo } from './fixtures/mcp-test-repo.ts';
import { getModule, listModules } from './read-tools.ts';
import { addTestCase, createModule, updateContract, updateModule } from './write-tools.ts';

let repoRoot: string;
let specDir: string;

beforeEach(async () => {
	({ repoRoot, specDir } = await seedMcpTestRepo());
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

describe('create_module', () => {
	it('writes a new node in its parent directory', async () => {
		const result = await createModule(repoRoot, { id: 'sessions', title: 'Sessions', parent: 'api' });
		expect(mcpWriteResultSchema.safeParse(result).success).toBe(true);
		expect(result.filePath).toBe(join(specDir, 'root', 'api', 'sessions.md'));
		expect(result.module.status).toBe('unspecified');
		expect((await listModules(repoRoot)).modules.map((module) => module.id)).toContain('sessions');
	});

	it('refuses a duplicate id through the store rather than clobbering a file', async () => {
		await expect(createModule(repoRoot, { id: 'api', title: 'Clash', parent: 'root' })).rejects.toThrow(
			/ids must be unique/,
		);
	});
});

describe('update_module', () => {
	it('changes only the fields it was given', async () => {
		await updateModule(repoRoot, { id: 'storage', title: 'Spec store', status: 'verified' });
		const after = await getModule(repoRoot, { id: 'storage' });
		expect(after.frontmatter.title).toBe('Spec store');
		expect(after.frontmatter.status).toBe('verified');
		expect(after.frontmatter.contracts?.[0]?.name).toBe('SpecStore.load');
		expect(after.body).toContain('LEAKED-SIBLING-BODY');
	});

	it('never migrates text between the behaviour field and the body', async () => {
		await updateModule(repoRoot, { id: 'storage', body: 'New prose.\n' });
		const after = await getModule(repoRoot, { id: 'storage' });
		expect(after.body).toBe('New prose.\n');
		expect(after.frontmatter.behaviour).toContain('LEAKED-SIBLING-FRONTMATTER-BEHAVIOUR');
	});

	it('leaves the rest of the file untouched, hand-written comments included', async () => {
		await createModule(repoRoot, { id: 'commented', title: 'Commented', parent: 'root' });
		const filePath = join(specDir, 'root', 'commented.md');
		const withComment = (await readFile(filePath, 'utf8')).replace('---\n', '---\n# hand-written\n');
		await writeFile(filePath, withComment, 'utf8');

		await updateModule(repoRoot, { id: 'commented', title: 'Renamed' });

		const after = await readFile(filePath, 'utf8');
		expect(after).toContain('# hand-written');
		expect(after).toContain('title: Renamed');
	});
});

describe('update_contract', () => {
	it('replaces the typed contracts wholesale', async () => {
		await updateContract(repoRoot, {
			id: 'users',
			contracts: [{ id: 'c-new', kind: 'moduleApi', name: 'listUsers', body: 'listUsers(): User[]' }],
		});
		const after = await getModule(repoRoot, { id: 'users' });
		expect(after.frontmatter.contracts?.map((contract) => contract.name)).toEqual(['listUsers']);
	});

	it('clears typed contracts on an empty array, and leaves the deprecated scalar alone', async () => {
		await updateContract(repoRoot, { id: 'root', contracts: [] });
		const after = await getModule(repoRoot, { id: 'root' });
		expect(after.frontmatter.contracts).toEqual([]);
		expect(after.frontmatter.contract).toContain('The product owns nothing directly');
	});
});

describe('add_test_case', () => {
	it('appends rather than replacing', async () => {
		await addTestCase(repoRoot, {
			id: 'api',
			testCase: { id: 'tc-new', description: 'a new case', expected: 'it passes' },
		});
		const after = await getModule(repoRoot, { id: 'api' });
		expect(after.frontmatter.testCases?.map((testCase) => testCase.id)).toEqual([
			'tc-api-list',
			'tc-api-empty',
			'tc-new',
		]);
	});

	it('refuses a duplicate id rather than silently overwriting a case the user wrote', async () => {
		await expect(
			addTestCase(repoRoot, { id: 'api', testCase: { id: 'tc-api-list', description: 'd', expected: 'e' } }),
		).rejects.toThrow(/already has a test case with id "tc-api-list"/);
	});
});
