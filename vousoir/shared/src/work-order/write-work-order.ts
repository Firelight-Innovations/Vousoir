/**
 * Writes a compiled work order to `.vousoir/cache/work-orders/<slug>.md`.
 *
 * `cache/` is the one gitignored subdir, which is exactly right: a work order is derived
 * data, regenerable from the spec node that produced it. Committing them would put churn
 * in git for files no human authored, and would let a stale work order outlive the spec
 * change that invalidated it.
 *
 * Deliberately separate from `compileWorkOrder`, so compiling stays pure and the user can
 * review before anything touches disk (source-of-truth Feature 4: "a single, deliberate,
 * reviewable action").
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { V6R_ROOT_DIRNAME, V6R_SUBDIRS, V6R_WORK_ORDERS_DIRNAME, type WorkOrder } from '@vousoir/typings';

/** Directory holding compiled work orders for a repo. */
export function workOrdersDir(repoRoot: string): string {
	return join(repoRoot, V6R_ROOT_DIRNAME, V6R_SUBDIRS.cache, V6R_WORK_ORDERS_DIRNAME);
}

/** Writes `workOrder` and returns the absolute path it landed at. */
export async function writeWorkOrder(repoRoot: string, workOrder: WorkOrder): Promise<string> {
	const directory = workOrdersDir(repoRoot);
	await mkdir(directory, { recursive: true });
	const filePath = join(directory, `${workOrder.slug}.md`);
	await writeFile(filePath, workOrder.markdown, 'utf8');
	return filePath;
}
