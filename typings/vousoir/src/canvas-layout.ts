/**
 * Node geometry on the canvas, and the `.vousoir/layout.json` file that persists the
 * user's own placements.
 *
 * Three rules, all from the amended ADR-003:
 *
 * 1. **Positions are never written to spec frontmatter.** That rule survives the
 *    amendment intact — layout churn in every spec diff would defeat Portable Spec Files.
 * 2. **`layout.json` sits at the root of `.vousoir/`, not under `cache/`.** Manual
 *    placement is user work, and `cache/` is the one directory anything may wipe and
 *    regenerate. A cache clear must not destroy where someone put their modules.
 * 3. **Only MANUAL placements are stored.** Auto-layout is deterministic from the tree, so
 *    persisting its output would just be a stale copy of a pure function's return value.
 *    Storing intent rather than result is also what lets auto-tidy be a clean reset.
 */

import { z } from 'zod';

/** Filename of the layout file, directly inside `.vousoir/`. */
export const V6R_LAYOUT_FILENAME = 'layout.json' as const;

/** Bumped only on a breaking layout-file change. */
export const V6R_LAYOUT_VERSION = 1 as const;

/** Where a node's top-left corner sits, in canvas coordinates. */
export const canvasPositionSchema = z.object({
	x: z.number().finite(),
	y: z.number().finite(),
});
export type CanvasPosition = z.infer<typeof canvasPositionSchema>;

/**
 * `.vousoir/layout.json`.
 *
 * Whether this file is committed or gitignored is ADR open question 7, **unruled**.
 * `V6R_GITIGNORE_CONTENTS` currently ignores only `cache/`, so today it is COMMITTED by
 * default. Committed means a collaborator clones into the same arrangement, at the cost of
 * position churn in diffs and conflicts when two people move the same node. Flipping it is
 * one line in `v6r-layout.ts`.
 */
export const v6rLayoutFileSchema = z.object({
	version: z.literal(V6R_LAYOUT_VERSION),
	/**
	 * Manual placements, keyed by node id. A node absent here is auto-placed — which is
	 * why clearing an entry is exactly what "tidy this node" means.
	 */
	positions: z.record(z.string().min(1), canvasPositionSchema),
});
export type V6rLayoutFile = z.infer<typeof v6rLayoutFileSchema>;

/** One laid-out node: a nested box, positioned and sized. */
export interface CanvasBox {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	/** Absolute canvas coordinates of the top-left corner. */
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	/** 0 for a root. Drives nesting colour and z-order in the webview. */
	readonly depth: number;
	/** True when this box came from `layout.json` rather than from auto-layout. */
	readonly manual: boolean;
}

/** A complete canvas layout: every node placed, plus the extent needed to fit them. */
export interface CanvasLayout {
	readonly boxes: readonly CanvasBox[];
	readonly width: number;
	readonly height: number;
}
