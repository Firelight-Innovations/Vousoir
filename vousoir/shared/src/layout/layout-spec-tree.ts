/**
 * Nested-box layout for the module tree — hand-rolled, per ADR-003.
 *
 * A pure function: tree in, boxes out. No DOM, no `vscode`, no clock, no randomness. That
 * is what lets it be tested directly, which matters because everything else on the canvas
 * sits behind a `postMessage` seam and is far harder to reach.
 *
 * No ELK, no dagre. The model is a strict tree — every node has exactly one parent and
 * there are no arbitrary edges — so the crossing-minimisation and edge-routing those
 * libraries exist for is unused. **The revisit trigger is specific:** if the canvas ever
 * renders contract edges between non-parent/child nodes *and* hand-rolled routing gets
 * ugly, that is when to reconsider. Not before.
 *
 * The algorithm is two passes. `measure` walks post-order, sizing each subtree from its
 * children. `place` walks pre-order, assigning absolute coordinates. Children are arranged
 * in a roughly square grid rather than one row, so a parent with eight children does not
 * produce a box eight screens wide.
 */

import type { CanvasBox, CanvasLayout, CanvasPosition, SpecTree, SpecTreeNode } from '@vousoir/typings';

/** Geometry constants. Exported so the webview's CSS can stay consistent with them. */
export const LAYOUT_METRICS = {
	/** Minimum box size for a leaf module. */
	minWidth: 180,
	minHeight: 72,
	/** Space reserved at the top of a parent box for its own title. */
	headerHeight: 34,
	/** Padding between a parent's inner edge and its children. */
	padding: 16,
	/** Gap between sibling boxes. */
	gap: 14,
	/** Gap between separate root trees. */
	rootGap: 40,
	/** Margin around the whole canvas. */
	margin: 24,
} as const;

/** Options for one layout pass. */
export interface LayoutOptions {
	/**
	 * Manual placements from `layout.json`, keyed by node id.
	 *
	 * A manual position moves the node's whole subtree and **always wins** — auto-layout
	 * never silently overrides a placement the user made (amended ADR-003). Tidying is the
	 * user removing entries from this map, not this function ignoring them.
	 */
	readonly positions?: Readonly<Record<string, CanvasPosition>>;
}

interface Measured {
	readonly node: SpecTreeNode;
	readonly width: number;
	readonly height: number;
	readonly children: readonly Measured[];
}

/** Lays the whole tree out as nested boxes. */
export function layoutSpecTree(tree: SpecTree, options: LayoutOptions = {}): CanvasLayout {
	const positions = options.positions ?? {};
	const measured = tree.roots.map(measure);
	const boxes: CanvasBox[] = [];

	let cursorX = LAYOUT_METRICS.margin;
	for (const root of measured) {
		const manual = positions[root.node.id];
		const origin = manual ?? { x: cursorX, y: LAYOUT_METRICS.margin };
		place(root, origin.x, origin.y, 0, positions, boxes);
		// Auto-placed roots march left to right; a manually placed root does not consume
		// the cursor, so moving one root does not shove its neighbours around.
		if (manual === undefined) {
			cursorX = origin.x + root.width + LAYOUT_METRICS.rootGap;
		}
	}

	return {
		boxes,
		width: extent(boxes, (box) => box.x + box.width) + LAYOUT_METRICS.margin,
		height: extent(boxes, (box) => box.y + box.height) + LAYOUT_METRICS.margin,
	};
}

/** Post-order: a node is as big as its children need, never smaller than the minimum. */
function measure(node: SpecTreeNode): Measured {
	const children = node.children.map(measure);
	if (children.length === 0) {
		return { node, width: LAYOUT_METRICS.minWidth, height: LAYOUT_METRICS.minHeight, children };
	}
	const rows = toRows(children);
	const innerWidth = Math.max(...rows.map(rowWidth));
	const innerHeight =
		rows.reduce((total, row) => total + rowHeight(row), 0) + LAYOUT_METRICS.gap * (rows.length - 1);
	return {
		node,
		width: Math.max(LAYOUT_METRICS.minWidth, innerWidth + LAYOUT_METRICS.padding * 2),
		height: LAYOUT_METRICS.headerHeight + innerHeight + LAYOUT_METRICS.padding * 2,
		children,
	};
}

/** Pre-order: hand out absolute coordinates, honouring any manual placement on the way. */
function place(
	measured: Measured,
	x: number,
	y: number,
	depth: number,
	positions: Readonly<Record<string, CanvasPosition>>,
	out: CanvasBox[],
): void {
	const manual = positions[measured.node.id];
	const originX = depth === 0 ? x : (manual?.x ?? x);
	const originY = depth === 0 ? y : (manual?.y ?? y);

	out.push({
		id: measured.node.id,
		title: measured.node.frontmatter.title,
		status: measured.node.frontmatter.status,
		x: originX,
		y: originY,
		width: measured.width,
		height: measured.height,
		depth,
		manual: manual !== undefined,
	});

	let childY = originY + LAYOUT_METRICS.headerHeight + LAYOUT_METRICS.padding;
	for (const row of toRows(measured.children)) {
		let childX = originX + LAYOUT_METRICS.padding;
		for (const child of row) {
			place(child, childX, childY, depth + 1, positions, out);
			childX += child.width + LAYOUT_METRICS.gap;
		}
		childY += rowHeight(row) + LAYOUT_METRICS.gap;
	}
}

/**
 * Splits children into a roughly square grid.
 *
 * One row per parent would make a wide tree unusable horizontally; `ceil(sqrt(n))` columns
 * keeps a parent box close to square whatever its fan-out.
 */
function toRows(children: readonly Measured[]): readonly (readonly Measured[])[] {
	if (children.length === 0) {
		return [];
	}
	const columns = Math.ceil(Math.sqrt(children.length));
	const rows: Measured[][] = [];
	for (let index = 0; index < children.length; index += columns) {
		rows.push([...children.slice(index, index + columns)]);
	}
	return rows;
}

function rowWidth(row: readonly Measured[]): number {
	return row.reduce((total, child) => total + child.width, 0) + LAYOUT_METRICS.gap * (row.length - 1);
}

function rowHeight(row: readonly Measured[]): number {
	return Math.max(...row.map((child) => child.height));
}

function extent(boxes: readonly CanvasBox[], edge: (box: CanvasBox) => number): number {
	return boxes.reduce((max, box) => Math.max(max, edge(box)), 0);
}
