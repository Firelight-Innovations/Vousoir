/**
 * Round-trip fidelity across a whole spec directory, and the watcher that makes external
 * edits visible.
 *
 * Both serve the same requirement: the user is allowed to edit `.vousoir/spec/` in their own
 * editor. Vousoir has to notice when they do, and must not rewrite what it did not change.
 */

import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedSpecTreeFixture } from '../fixtures/spec-tree-fixture.ts';
import { SpecStore } from './spec-store.ts';
import type { SpecStoreChange } from './spec-store-watcher.ts';

/** Resolves on the first change event, or rejects rather than hanging the suite. */
function nextChange(store: SpecStore, timeoutMs = 4000): Promise<SpecStoreChange> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('no change event arrived')), timeoutMs);
		store.watch((change) => {
			clearTimeout(timer);
			resolve(change);
		});
	});
}

describe('SpecStore round trip', () => {
	let repoRoot: string;
	let store: SpecStore;

	beforeEach(async () => {
		({ repoRoot } = await seedSpecTreeFixture());
		store = await SpecStore.open({ repoRoot });
	});

	afterEach(async () => {
		store.dispose();
		await rm(repoRoot, { recursive: true, force: true });
	});

	it('saves every node unchanged without altering a single byte', async () => {
		const before = new Map<string, Buffer>();
		for (const node of store.tree.byId.values()) {
			before.set(node.filePath, await readFile(node.filePath));
		}
		expect(before.size).toBe(4);

		for (const node of [...store.tree.byId.values()]) {
			await store.save(node);
		}

		for (const [filePath, original] of before) {
			expect(await readFile(filePath)).toEqual(original);
		}
	});

	it('touches only the renamed node, and only its title line', async () => {
		const untouched = await readFile(join(store.specDir, 'root.md'));
		await store.rename('users', 'User accounts');

		const users = await readFile(join(store.specDir, 'root', 'api', 'users.md'), 'utf8');
		expect(users).toContain('title: User accounts');
		expect(users).toContain('# Hand-written outside Vousoir');
		expect(users).toContain('Not specified yet.');
		expect(await readFile(join(store.specDir, 'root.md'))).toEqual(untouched);
	});
});

describe('SpecStore.watch', () => {
	let repoRoot: string;
	let store: SpecStore;

	beforeEach(async () => {
		({ repoRoot } = await seedSpecTreeFixture());
		store = await SpecStore.open({ repoRoot });
	});

	afterEach(async () => {
		store.dispose();
		await rm(repoRoot, { recursive: true, force: true });
	});

	it('fires when a spec file is edited on disk', async () => {
		const target = join(store.specDir, 'root', 'api', 'users.md');
		const change = nextChange(store);
		await writeFile(target, '---\nid: users\ntitle: Edited elsewhere\nparent: api\nstatus: specified\n---\n', 'utf8');

		expect((await change).filePath).toBe(target);
		await store.load();
		expect(store.tree.byId.get('users')?.frontmatter.title).toBe('Edited elsewhere');
	});

	it('stays quiet for the store\'s own writes', async () => {
		const seen: SpecStoreChange[] = [];
		store.watch((change) => seen.push(change), { selfWriteWindowMs: 5000 });

		await store.rename('users', 'Renamed by the store');
		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(seen).toEqual([]);
	});

	it('reports that the spec directory must exist before it can be watched', async () => {
		await rm(store.specDir, { recursive: true, force: true });
		expect(() => store.watch(() => undefined)).toThrow(/Scaffold it with v6rInit\(\)/);
	});
});
