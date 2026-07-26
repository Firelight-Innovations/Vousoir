/**
 * Create, rename, delete and re-parent — including the two semantics M1 had to choose:
 * deleting a node with children re-parents the orphans to the grandparent rather than
 * cascading, and deleting a root is refused outright.
 */

import { rm, stat } from 'node:fs/promises';
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

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

describe('SpecStore create and rename', () => {
	it('creates a node inside its parent directory', async () => {
		const created = await store.create({ id: 'sessions', title: 'Sessions endpoint', parent: 'api' });
		expect(created.filePath).toBe(join(specDir, 'root', 'api', 'sessions.md'));
		expect(created.frontmatter.status).toBe('unspecified');
		expect(await exists(created.filePath)).toBe(true);

		const reloaded = await SpecStore.open({ repoRoot });
		expect(reloaded.tree.byId.get('sessions')?.frontmatter.parent).toBe('api');
	});

	it('refuses a duplicate id and an absent parent', async () => {
		await expect(store.create({ id: 'api', title: 'Clash', parent: 'root' })).rejects.toThrow(/ids must be unique/);
		await expect(store.create({ id: 'orphan', title: 'Orphan', parent: 'ghost' })).rejects.toThrow(
			/no node with id "ghost" exists/,
		);
	});

	it('renames a node without moving its file', async () => {
		const before = store.tree.byId.get('users')?.filePath;
		const renamed = await store.rename('users', 'User accounts');
		expect(renamed.frontmatter.title).toBe('User accounts');
		expect(renamed.filePath).toBe(before);
		expect((await SpecStore.open({ repoRoot })).tree.byId.get('users')?.frontmatter.title).toBe('User accounts');
	});

	it('reports an unknown id rather than throwing something opaque', async () => {
		await expect(store.rename('nope', 'x')).rejects.toThrow(/there is no spec node with id "nope"/);
	});
});

describe('SpecStore delete', () => {
	it('deletes a leaf', async () => {
		const filePath = store.tree.byId.get('users')?.filePath ?? '';
		await store.delete('users');
		expect(store.tree.byId.has('users')).toBe(false);
		expect(await exists(filePath)).toBe(false);
		expect(store.tree.byId.get('api')?.frontmatter.parent).toBe('root');
	});

	it('re-parents the orphans to the grandparent instead of cascading', async () => {
		await store.delete('api');
		expect(store.tree.byId.has('api')).toBe(false);

		const users = store.tree.byId.get('users');
		expect(users?.frontmatter.parent).toBe('root');
		expect(users?.filePath).toBe(join(specDir, 'root', 'users.md'));
		expect(await exists(join(specDir, 'root', 'api.md'))).toBe(false);

		expect(store.tree.roots[0]?.children.map((child) => child.id)).toEqual(['storage', 'users']);
	});

	it('refuses to delete a root', async () => {
		await expect(store.delete('root')).rejects.toThrow(SpecStoreError);
		await expect(store.delete('root')).rejects.toThrow(/is a spec root/);
		expect(store.tree.byId.has('root')).toBe(true);
	});
});

describe('SpecStore re-parenting', () => {
	it('moves an entire subtree', async () => {
		await store.reparent('api', 'storage');

		expect(store.tree.byId.get('api')?.filePath).toBe(join(specDir, 'root', 'storage', 'api.md'));
		expect(store.tree.byId.get('users')?.filePath).toBe(join(specDir, 'root', 'storage', 'api', 'users.md'));
		expect(store.tree.byId.get('users')?.frontmatter.parent).toBe('api');
		expect(await exists(join(specDir, 'root', 'api'))).toBe(false);

		const storage = store.tree.roots[0]?.children.find((child) => child.id === 'storage');
		expect(storage?.children[0]?.children.map((child) => child.id)).toEqual(['users']);
	});

	it('rejects re-parenting a node under its own descendant', async () => {
		await expect(store.reparent('api', 'users')).rejects.toThrow(/one of its own descendants/);
		expect(store.tree.byId.get('api')?.frontmatter.parent).toBe('root');
	});

	it('rejects a node as its own parent, and an absent new parent', async () => {
		await expect(store.reparent('api', 'api')).rejects.toThrow(/cannot be its own parent/);
		await expect(store.reparent('api', 'ghost')).rejects.toThrow(/no node with id "ghost" exists/);
	});

	it('refuses to change parent through save(), which would strand the files', async () => {
		const api = store.tree.byId.get('api');
		if (api === undefined) {
			throw new Error('the spec-tree fixture is missing its `api` node');
		}
		await expect(store.save({ ...api, frontmatter: { ...api.frontmatter, parent: 'storage' } })).rejects.toThrow(
			/call reparent\(\)/,
		);
	});
});
