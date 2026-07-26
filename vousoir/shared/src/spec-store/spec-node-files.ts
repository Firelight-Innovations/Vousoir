/**
 * The filesystem half of a structural edit: writing, moving and removing the `.md` file
 * and child directory that make up one node.
 *
 * Kept separate from `SpecStore` so the class stays a thin orchestrator over pure
 * functions, and so the "file beside folder" layout has exactly one implementation.
 */

import { mkdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { findSpecFiles, type SpecNodePaths } from './spec-paths.ts';
import { SpecStoreError } from './spec-store-error.ts';

/** Writes a node's `.md`, creating any missing ancestor directories. */
export async function writeSpecNodeFile(filePath: string, text: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, text, 'utf8');
}

/**
 * Moves a node and, with it, its entire subtree — the child directory rename carries every
 * descendant in one operation, which is why re-parenting never touches descendant files.
 */
export async function moveSpecNodeFiles(from: SpecNodePaths, to: SpecNodePaths): Promise<void> {
	await mkdir(dirname(to.filePath), { recursive: true });
	await rename(from.filePath, to.filePath);
	if (await exists(from.childDir)) {
		await rename(from.childDir, to.childDir);
	}
}

/**
 * Removes a node's file and its child directory.
 *
 * Caller contract: every child has already been re-parented out. This re-checks it rather
 * than trusting it — a stray `.md` left under `childDir` would be silently destroyed
 * otherwise, and losing a user's spec is the one failure mode worth extra code.
 */
export async function deleteSpecNodeFiles(paths: SpecNodePaths): Promise<void> {
	if (await exists(paths.childDir)) {
		const stranded = await findSpecFiles(paths.childDir);
		if (stranded.length > 0) {
			throw new SpecStoreError(
				`still holds ${stranded.length} spec file(s) after its children were re-parented; refusing to delete it.`,
				{ filePath: paths.childDir },
			);
		}
		// Only empty scaffolding directories remain, left behind by the children that moved out.
		await rm(paths.childDir, { recursive: true, force: true });
	}
	await unlink(paths.filePath);
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
