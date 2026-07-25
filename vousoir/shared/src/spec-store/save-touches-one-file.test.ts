/**
 * ARCHITECTURE.md's M3 acceptance criterion: editing a node "changes on disk **and only
 * that file**". Asserted rather than assumed.
 *
 * It is the property that makes the spec panel safe to use on a real project. A save that
 * rewrote its siblings would produce a git diff nobody could review, and it would do it
 * silently — a whole-tree rewrite looks identical to a one-node edit until you open the
 * diff.
 */

import { readFile, rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedSpecTreeFixture } from '../fixtures/spec-tree-fixture.ts';
import { editSpecNode } from './edit-spec-node.ts';
import { SpecStore } from './spec-store.ts';

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

/** Every spec file's exact bytes, keyed by path. */
async function snapshot(): Promise<Map<string, Buffer>> {
	const files = new Map<string, Buffer>();
	for (const node of store.tree.byId.values()) {
		files.set(node.filePath, await readFile(node.filePath));
	}
	return files;
}

async function changedSince(before: Map<string, Buffer>): Promise<readonly string[]> {
	const changed: string[] = [];
	for (const [filePath, original] of before) {
		if (!(await readFile(filePath)).equals(original)) {
			changed.push(filePath);
		}
	}
	return changed;
}

describe('a panel save writes exactly one file', () => {
	it('touches only the edited node when behaviour changes', async () => {
		const before = await snapshot();
		const node = store.tree.byId.get('api');
		expect(node).toBeDefined();

		await store.save(editSpecNode(node!, { behaviour: 'Rewritten behaviour.' }));

		expect(await changedSince(before)).toEqual([node!.filePath]);
	});

	it('touches only the edited node when contracts and test cases change', async () => {
		const before = await snapshot();
		const node = store.tree.byId.get('storage');
		expect(node).toBeDefined();

		await store.save(
			editSpecNode(node!, {
				title: 'Spec store',
				contracts: [{ id: 'c-1', kind: 'serviceApi', name: 'GET /spec', body: '200 with the tree' }],
				testCases: [{ id: 'tc-1', description: 'it serves', expected: 'a tree comes back' }],
			}),
		);

		expect(await changedSince(before)).toEqual([node!.filePath]);
	});

	it('writes nothing at all when the edit changes nothing', async () => {
		const before = await snapshot();
		const node = store.tree.byId.get('users');
		expect(node).toBeDefined();

		await store.save(editSpecNode(node!, {}));

		// Byte-identical, which is the M1 round-trip guarantee still holding under a panel save.
		expect(await changedSince(before)).toEqual([]);
	});
});
