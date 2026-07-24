/**
 * Loading `.v6r/spec/` into a tree, and refusing the shapes a hand-edit can produce.
 * Every rejection must name the file at fault — a spec directory is something the user
 * edits directly, so "it broke" is not an acceptable message.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedSpecTreeFixture } from '../fixtures/spec-tree-fixture.ts';
import { SpecStore } from './spec-store.ts';
import { SpecStoreError } from './spec-store-error.ts';

let repoRoot: string;
let specDir: string;
let store: SpecStore;

beforeEach(async () => {
	({ repoRoot, specDir } = await seedSpecTreeFixture());
	store = await SpecStore.open({ repoRoot });
});

afterEach(async () => {
	store.dispose();
	await rm(repoRoot, { recursive: true, force: true });
});

describe('SpecStore.load', () => {
	it('assembles a three-level tree from parent pointers', () => {
		const { roots, byId } = store.tree;
		expect(byId.size).toBe(4);
		expect(roots.map((root) => root.id)).toEqual(['root']);

		const [root] = roots;
		expect(root?.children.map((child) => child.id)).toEqual(['api', 'storage']);
		const api = root?.children.find((child) => child.id === 'api');
		expect(api?.children.map((child) => child.id)).toEqual(['users']);
		expect(api?.children[0]?.children).toEqual([]);
	});

	it('mirrors the tree in nested folders, one file per node', () => {
		expect(store.tree.byId.get('root')?.filePath).toBe(join(specDir, 'root.md'));
		expect(store.tree.byId.get('api')?.filePath).toBe(join(specDir, 'root', 'api.md'));
		expect(store.tree.byId.get('users')?.filePath).toBe(join(specDir, 'root', 'api', 'users.md'));
	});

	it('loads a node written against the pre-M1 schema', () => {
		const root = store.tree.byId.get('root');
		expect(root?.frontmatter.contract).toBe('Owns nothing directly; children own their own contracts.');
		expect(root?.frontmatter.contracts).toBeUndefined();
		expect(root?.frontmatter.testCases?.[0]?.given).toBeUndefined();
		expect(root?.frontmatter.testCases?.[0]?.expected).toBe('the canvas renders one box titled "Vousoir"');
	});

	it('reads typed contracts and the long-form test case', () => {
		const api = store.tree.byId.get('api');
		expect(api?.frontmatter.contracts?.map((contract) => contract.kind)).toEqual(['serviceApi', 'dbSchema']);
		expect(api?.frontmatter.contracts?.[0]?.name).toBe('GET /modules');
		expect(api?.frontmatter.testCases?.[0]?.when).toBe('GET /modules is called');
		expect(api?.frontmatter.testCases?.[0]?.snippet).toContain('curl');
	});

	it('keeps the markdown body as the node behaviour', () => {
		expect(store.tree.byId.get('storage')?.body).toContain('nested folders mirror the hierarchy');
	});

	it('treats a repo with no .v6r/spec as an empty project rather than an error', async () => {
		const bare = await mkdtemp(join(tmpdir(), 'v6r-bare-'));
		try {
			const empty = await SpecStore.open({ repoRoot: bare });
			expect(empty.tree.byId.size).toBe(0);
			expect(empty.tree.roots).toEqual([]);
		} finally {
			await rm(bare, { recursive: true, force: true });
		}
	});
});

describe('SpecStore.load rejections', () => {
	it('names the file when frontmatter is malformed', async () => {
		await writeFile(join(specDir, 'root', 'broken.md'), '---\nid: broken\nstatus: nonsense\n---\n', 'utf8');
		await expect(store.load()).rejects.toThrow(SpecStoreError);
		await expect(store.load()).rejects.toThrow(/broken\.md[\s\S]*- title:[\s\S]*- status:/);
	});

	it('names the file when a parent pointer resolves to nothing', async () => {
		await writeFile(
			join(specDir, 'root', 'stray.md'),
			'---\nid: stray\ntitle: Stray\nparent: ghost\nstatus: unspecified\n---\n',
			'utf8',
		);
		await expect(store.load()).rejects.toThrow(/stray\.md[\s\S]*no node under \.v6r\/spec\/ declares that id/);
	});

	it('names both files when two nodes claim the same id', async () => {
		await writeFile(
			join(specDir, 'root', 'twin.md'),
			'---\nid: api\ntitle: Twin\nparent: root\nstatus: unspecified\n---\n',
			'utf8',
		);
		await expect(store.load()).rejects.toThrow(/declares id "api", which .*api\.md already declares/);
	});

	it('rejects a parent cycle', async () => {
		await writeFile(
			join(specDir, 'root', 'loop-a.md'),
			'---\nid: loop-a\ntitle: A\nparent: loop-b\nstatus: unspecified\n---\n',
			'utf8',
		);
		await writeFile(
			join(specDir, 'root', 'loop-b.md'),
			'---\nid: loop-b\ntitle: B\nparent: loop-a\nstatus: unspecified\n---\n',
			'utf8',
		);
		await expect(store.load()).rejects.toThrow(/part of a parent cycle/);
	});
});
