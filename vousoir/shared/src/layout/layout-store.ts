/**
 * Reads and writes `.vousoir/layout.json` — where the user's own node placements live.
 *
 * Deliberately NOT under `cache/`. `cache/` is the one directory anything may wipe and
 * regenerate; manual placement is user work, and a cache clear must not destroy it
 * (amended ADR-003).
 *
 * Only manual placements are stored. Auto-layout is a pure function of the tree, so
 * persisting its output would be a stale copy of something recomputable — and storing
 * intent rather than result is what makes auto-tidy a clean reset instead of a diff.
 *
 * A missing or unreadable file is an empty layout, never an error: a project that has
 * never been arranged is the normal first-open case, and a corrupt layout should cost the
 * user their arrangement, not their ability to open the canvas.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	V6R_LAYOUT_FILENAME,
	V6R_LAYOUT_VERSION,
	V6R_ROOT_DIRNAME,
	v6rLayoutFileSchema,
	type CanvasPosition,
	type V6rLayoutFile,
} from '@vousoir/typings';

/** Absolute path of the layout file for a repo. */
export function layoutFilePath(repoRoot: string): string {
	return join(repoRoot, V6R_ROOT_DIRNAME, V6R_LAYOUT_FILENAME);
}

/** An empty layout: everything auto-placed. */
export function emptyLayout(): V6rLayoutFile {
	return { version: V6R_LAYOUT_VERSION, positions: {} };
}

/** Loads manual placements. Anything missing, malformed or stale yields an empty layout. */
export async function loadLayout(repoRoot: string): Promise<V6rLayoutFile> {
	let raw: string;
	try {
		raw = await readFile(layoutFilePath(repoRoot), 'utf8');
	} catch {
		return emptyLayout();
	}
	try {
		const parsed = v6rLayoutFileSchema.safeParse(JSON.parse(raw) as unknown);
		return parsed.success ? parsed.data : emptyLayout();
	} catch {
		// Invalid JSON. Losing an arrangement is recoverable; refusing to open is not.
		return emptyLayout();
	}
}

/** Writes manual placements, creating `.vousoir/` if the project has never been scaffolded. */
export async function saveLayout(repoRoot: string, layout: V6rLayoutFile): Promise<string> {
	const filePath = layoutFilePath(repoRoot);
	await mkdir(join(repoRoot, V6R_ROOT_DIRNAME), { recursive: true });
	// Trailing newline and two-space indent: this file is committed by default, so it
	// should diff like something a human might open.
	await writeFile(filePath, `${JSON.stringify(layout, null, 2)}\n`, 'utf8');
	return filePath;
}

/** Returns a layout with one node's manual placement set. */
export function withPosition(layout: V6rLayoutFile, id: string, position: CanvasPosition): V6rLayoutFile {
	return { ...layout, positions: { ...layout.positions, [id]: position } };
}

/**
 * Returns a layout with every manual placement removed — what auto-tidy does.
 *
 * Tidying clears the user's overrides so auto-layout applies again. It is deliberately an
 * explicit action: auto-layout must never silently discard a placement.
 */
export function clearedLayout(): V6rLayoutFile {
	return emptyLayout();
}
