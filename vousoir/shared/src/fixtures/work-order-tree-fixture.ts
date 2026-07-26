/**
 * Test-only helper: loads the `work-order-tree/` fixture.
 *
 * The tree is shaped so that `api` has an ancestor, a sibling and a child *at once* —
 * the only shape that exercises every branch of the context collector in one compile. Its
 * neighbours carry deliberately loud `LEAKED-*` markers in their behaviour and test cases,
 * so a leak shows up as a string match rather than as a reviewer noticing a stray heading.
 *
 * Read directly from the committed fixture rather than copied to a temp dir: compiling is
 * a pure function and never writes, so there is nothing to protect against.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SpecTree } from '@vousoir/typings';
import { parseSpecFile } from '../spec-store/spec-file.ts';
import { findSpecFiles } from '../spec-store/spec-paths.ts';
import { buildSpecTree } from '../spec-store/spec-tree.ts';

/** Absolute path of the committed fixture tree. Read-only. */
export const WORK_ORDER_TREE_DIR = join(import.meta.dirname, 'work-order-tree');

/** Absolute path of the byte-exact expected work order for the `api` node. */
export const WORK_ORDER_GOLDEN_PATH = join(import.meta.dirname, 'work-order-tree.golden.md');

/** Loads the fixture into an assembled `SpecTree`. */
export async function loadWorkOrderTree(): Promise<SpecTree> {
	const paths = await findSpecFiles(WORK_ORDER_TREE_DIR);
	const files = await Promise.all(paths.map(async (path) => parseSpecFile(path, await readFile(path, 'utf8'))));
	return buildSpecTree(files.map((file) => file.node));
}
