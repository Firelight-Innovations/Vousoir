/**
 * The layout engine, tested as a pure function.
 *
 * This is the one part of the canvas reachable without a webview, so it carries the weight:
 * containment, determinism, and — the rule the ADR-003 amendment turns on — that a manual
 * placement is never silently overridden.
 */

import { describe, expect, it } from 'vitest';
import type { CanvasBox, SpecNode, SpecNodeFrontmatter, SpecTree } from '@vousoir/typings';
import { buildSpecTree } from '../spec-store/spec-tree.ts';
import { LAYOUT_METRICS, layoutSpecTree } from './layout-spec-tree.ts';

function node(id: string, parent: string | null, title = id): SpecNode {
	const frontmatter: SpecNodeFrontmatter = { id, title, parent, status: 'specified' };
	return { id, filePath: `/repo/.vousoir/spec/${id}.md`, frontmatter, body: '' };
}

/** root → (api → users, storage): the DoD shape, three modules with one nested. */
function demoTree(): SpecTree {
	return buildSpecTree([node('root', null), node('api', 'root'), node('users', 'api'), node('storage', 'root')]);
}

function boxOf(boxes: readonly CanvasBox[], id: string): CanvasBox {
	const found = boxes.find((box) => box.id === id);
	if (found === undefined) {
		throw new Error(`no box for "${id}"`);
	}
	return found;
}

/** True when `inner` sits entirely within `outer`. */
function contains(outer: CanvasBox, inner: CanvasBox): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	);
}

function overlaps(left: CanvasBox, right: CanvasBox): boolean {
	return (
		left.x < right.x + right.width &&
		right.x < left.x + left.width &&
		left.y < right.y + right.height &&
		right.y < left.y + left.height
	);
}

describe('layoutSpecTree', () => {
	it('places every node exactly once', () => {
		const { boxes } = layoutSpecTree(demoTree());
		expect(boxes.map((box) => box.id).sort()).toEqual(['api', 'root', 'storage', 'users']);
	});

	it('nests every child fully inside its parent', () => {
		const { boxes } = layoutSpecTree(demoTree());
		expect(contains(boxOf(boxes, 'root'), boxOf(boxes, 'api'))).toBe(true);
		expect(contains(boxOf(boxes, 'root'), boxOf(boxes, 'storage'))).toBe(true);
		expect(contains(boxOf(boxes, 'api'), boxOf(boxes, 'users'))).toBe(true);
	});

	it('keeps siblings from overlapping', () => {
		const { boxes } = layoutSpecTree(demoTree());
		expect(overlaps(boxOf(boxes, 'api'), boxOf(boxes, 'storage'))).toBe(false);
	});

	it('leaves room above children for the parent title', () => {
		const { boxes } = layoutSpecTree(demoTree());
		const root = boxOf(boxes, 'root');
		expect(boxOf(boxes, 'api').y - root.y).toBeGreaterThanOrEqual(LAYOUT_METRICS.headerHeight);
	});

	it('is deterministic — the same tree lays out to the same bytes', () => {
		expect(JSON.stringify(layoutSpecTree(demoTree()))).toBe(JSON.stringify(layoutSpecTree(demoTree())));
	});

	it('reports an extent that covers every box', () => {
		const { boxes, width, height } = layoutSpecTree(demoTree());
		for (const box of boxes) {
			expect(box.x + box.width).toBeLessThanOrEqual(width);
			expect(box.y + box.height).toBeLessThanOrEqual(height);
		}
	});

	it('gives a leaf the minimum box size', () => {
		const { boxes } = layoutSpecTree(buildSpecTree([node('solo', null)]));
		expect(boxOf(boxes, 'solo').width).toBe(LAYOUT_METRICS.minWidth);
		expect(boxOf(boxes, 'solo').height).toBe(LAYOUT_METRICS.minHeight);
	});

	it('handles an empty tree without producing a negative extent', () => {
		const layout = layoutSpecTree(buildSpecTree([]));
		expect(layout.boxes).toEqual([]);
		expect(layout.width).toBeGreaterThanOrEqual(0);
		expect(layout.height).toBeGreaterThanOrEqual(0);
	});

	it('grows a parent to fit many children without one runaway row', () => {
		const children = Array.from({ length: 9 }, (_unused, index) => node(`child-${index}`, 'root'));
		const { boxes } = layoutSpecTree(buildSpecTree([node('root', null), ...children]));
		const root = boxOf(boxes, 'root');

		for (const child of children) {
			expect(contains(root, boxOf(boxes, child.id))).toBe(true);
		}
		// A single row of nine would be far wider than tall; the grid keeps it near square.
		expect(root.width).toBeLessThan(root.height * 3);
	});

	it('lays separate roots out side by side without overlapping', () => {
		const { boxes } = layoutSpecTree(buildSpecTree([node('a', null), node('b', null)]));
		expect(overlaps(boxOf(boxes, 'a'), boxOf(boxes, 'b'))).toBe(false);
	});
});

describe('manual placement', () => {
	it('honours a manual position instead of the auto one', () => {
		const positions = { storage: { x: 900, y: 400 } };
		const { boxes } = layoutSpecTree(demoTree(), { positions });
		const storage = boxOf(boxes, 'storage');

		expect(storage.x).toBe(900);
		expect(storage.y).toBe(400);
		expect(storage.manual).toBe(true);
	});

	it('never silently moves a manually placed node when the tree changes around it', () => {
		const positions = { storage: { x: 900, y: 400 } };
		const before = layoutSpecTree(demoTree(), { positions });
		const grown = buildSpecTree([
			node('root', null),
			node('api', 'root'),
			node('users', 'api'),
			node('storage', 'root'),
			node('traces', 'root'),
			node('cache', 'api'),
		]);
		const after = layoutSpecTree(grown, { positions });

		expect(boxOf(after.boxes, 'storage').x).toBe(boxOf(before.boxes, 'storage').x);
		expect(boxOf(after.boxes, 'storage').y).toBe(boxOf(before.boxes, 'storage').y);
	});

	it('moves a manually placed node together with its whole subtree', () => {
		const auto = layoutSpecTree(demoTree());
		const offsetX = boxOf(auto.boxes, 'users').x - boxOf(auto.boxes, 'api').x;
		const offsetY = boxOf(auto.boxes, 'users').y - boxOf(auto.boxes, 'api').y;

		const moved = layoutSpecTree(demoTree(), { positions: { api: { x: 1000, y: 500 } } });
		expect(boxOf(moved.boxes, 'users').x).toBe(1000 + offsetX);
		expect(boxOf(moved.boxes, 'users').y).toBe(500 + offsetY);
	});

	it('marks only manually placed nodes as manual', () => {
		const { boxes } = layoutSpecTree(demoTree(), { positions: { storage: { x: 900, y: 400 } } });
		expect(boxes.filter((box) => box.manual).map((box) => box.id)).toEqual(['storage']);
	});

	it('returns to the auto position once the placement is cleared — this is auto-tidy', () => {
		const auto = layoutSpecTree(demoTree());
		const moved = layoutSpecTree(demoTree(), { positions: { storage: { x: 900, y: 400 } } });
		const tidied = layoutSpecTree(demoTree(), { positions: {} });

		expect(boxOf(moved.boxes, 'storage').x).not.toBe(boxOf(auto.boxes, 'storage').x);
		expect(boxOf(tidied.boxes, 'storage')).toEqual(boxOf(auto.boxes, 'storage'));
	});

	it('ignores a placement for a node that no longer exists', () => {
		const { boxes } = layoutSpecTree(demoTree(), { positions: { ghost: { x: 10, y: 10 } } });
		expect(boxes.map((box) => box.id)).not.toContain('ghost');
	});
});
