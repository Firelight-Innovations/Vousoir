/**
 * Where a node's files live under `.vousoir/spec/`, and how to find them all.
 *
 * The layout is "file beside folder": a node is `<ancestors…>/<id>.md`, and its children
 * live in the sibling directory `<ancestors…>/<id>/`. Nested folders therefore mirror the
 * module hierarchy exactly (`v6r-layout.ts:16`) with no `index.md` special case, and
 * re-parenting a whole subtree is a single directory rename.
 *
 * The path is derived from `id`, never from `title`. Titles are edited constantly; a
 * title-derived path would move a file — and rewrite every diff — on a typo fix.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Every spec node is one markdown file. */
export const SPEC_FILE_EXTENSION = '.md';

/** The two paths one node occupies: its own file, and the directory holding its children. */
export interface SpecNodePaths {
	/** `<specDir>/<ancestors…>/<id>.md` — always exists for a live node. */
	readonly filePath: string;
	/** `<specDir>/<ancestors…>/<id>/` — exists only once the node has a child. */
	readonly childDir: string;
}

/**
 * Maps a root-to-node chain of ids to that node's paths.
 * `['root', 'api', 'users']` → `<specDir>/root/api/users.md` + `<specDir>/root/api/users/`.
 */
export function specNodePaths(specDir: string, idChain: readonly string[]): SpecNodePaths {
	if (idChain.length === 0) {
		throw new Error('specNodePaths requires a non-empty id chain.');
	}
	const childDir = join(specDir, ...idChain);
	return { filePath: `${childDir}${SPEC_FILE_EXTENSION}`, childDir };
}

/**
 * Every `.md` file under `specDir`, recursively, sorted for a deterministic load order.
 * A missing `specDir` is an empty project, not an error — `v6rInit()` may not have run.
 */
export async function findSpecFiles(specDir: string): Promise<readonly string[]> {
	let entries;
	try {
		entries = await readdir(specDir, { recursive: true, withFileTypes: true });
	} catch (cause) {
		if (isNotFound(cause)) {
			return [];
		}
		throw cause;
	}
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(SPEC_FILE_EXTENSION))
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

function isNotFound(cause: unknown): boolean {
	return typeof cause === 'object' && cause !== null && (cause as { code?: unknown }).code === 'ENOENT';
}
