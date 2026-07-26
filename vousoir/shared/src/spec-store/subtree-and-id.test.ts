/**
 * The two pure helpers the canvas's Part B needs: drill-in (`subtreeOf`) and id allocation
 * (`uniqueNodeId`).
 *
 * Both are in `@vousoir/shared` rather than the extension for the usual reason — the
 * extension has no test runner — and both encode a rule worth pinning. Drilling in is a
 * VIEW and must never change what is on disk. An id is permanent, so allocation must never
 * hand back one already in use.
 */

import { describe, expect, it } from 'vitest';
import type { SpecNode, SpecNodeFrontmatter, SpecTree } from '@vousoir/typings';
import { buildSpecTree } from './spec-tree.ts';
import { subtreeOf } from './spec-tree-walk.ts';
import { uniqueNodeId } from './unique-node-id.ts';

function node(id: string, parent: string | null, title = id): SpecNode {
	const frontmatter: SpecNodeFrontmatter = { id, title, parent, status: 'specified' };
	return { id, filePath: `/repo/.vousoir/spec/${id}.md`, frontmatter, body: '' };
}

function tree(): SpecTree {
	return buildSpecTree([
		node('root', null),
		node('api', 'root'),
		node('users', 'api'),
		node('sessions', 'api'),
		node('storage', 'root'),
	]);
}

describe('subtreeOf', () => {
	it('keeps the node and its descendants, and drops everything else', () => {
		const view = subtreeOf(tree(), 'api');
		expect([...view.byId.keys()].sort()).toEqual(['api', 'sessions', 'users']);
	});

	it('re-roots the subtree so it renders on its own', () => {
		const view = subtreeOf(tree(), 'api');
		expect(view.roots.map((root) => root.id)).toEqual(['api']);
		expect(view.byId.get('api')?.frontmatter.parent).toBeNull();
	});

	it('preserves the nesting below the new root', () => {
		const view = subtreeOf(tree(), 'api');
		expect(view.roots[0]?.children.map((child) => child.id)).toEqual(['sessions', 'users']);
	});

	it('does not mutate the source tree — drilling in is a view, not an edit', () => {
		const source = tree();
		subtreeOf(source, 'api');
		expect(source.byId.get('api')?.frontmatter.parent).toBe('root');
		expect(source.byId.size).toBe(5);
	});

	it('handles a leaf as a one-node view', () => {
		const view = subtreeOf(tree(), 'users');
		expect([...view.byId.keys()]).toEqual(['users']);
		expect(view.roots[0]?.children).toEqual([]);
	});

	it('names an unknown id', () => {
		expect(() => subtreeOf(tree(), 'ghost')).toThrow(/no spec node with id "ghost"/);
	});
});

describe('uniqueNodeId', () => {
	it('slugifies the title when nothing collides', () => {
		expect(uniqueNodeId(tree(), 'Task API')).toBe('task-api');
		expect(uniqueNodeId(tree(), '  Spaced   Out  ')).toBe('spaced-out');
	});

	it('suffixes from 2 on a collision, because -1 would imply a first', () => {
		expect(uniqueNodeId(tree(), 'API')).toBe('api-2');
	});

	it('keeps suffixing past an existing suffixed id', () => {
		const crowded = buildSpecTree([node('root', null), node('api', 'root'), node('api-2', 'root')]);
		expect(uniqueNodeId(crowded, 'API')).toBe('api-3');
	});

	it('never returns an id already in the tree', () => {
		const source = tree();
		for (const title of ['API', 'api', 'Users', 'storage', 'Root']) {
			expect(source.byId.has(uniqueNodeId(source, title))).toBe(false);
		}
	});

	it('falls back to a usable stem when the title has nothing sluggable', () => {
		expect(uniqueNodeId(tree(), '???')).toBe('module');
		expect(uniqueNodeId(tree(), '  ')).toBe('module');
	});

	it('produces an id with no path separators', () => {
		expect(uniqueNodeId(tree(), 'a/b\\c')).not.toMatch(/[/\\]/);
	});
});
