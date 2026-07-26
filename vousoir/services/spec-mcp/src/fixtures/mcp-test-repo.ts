/**
 * Test-only helper: a throwaway repo whose `.vousoir/spec/` is the work-order fixture.
 *
 * It copies the fixture that `@vousoir/shared` also compiles its golden from, rather than
 * keeping a second copy here. That is the point of the byte-identical assertion: two
 * fixtures would drift and the test would pass while the two compilers diverged.
 */

import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WORK_ORDER_TREE_DIR, v6rInit } from '@vousoir/shared';
import { V6R_ROOT_DIRNAME, V6R_SUBDIRS } from '@vousoir/typings';

/** A seeded temp repo. Delete `repoRoot` when done. */
export interface McpTestRepo {
	readonly repoRoot: string;
	readonly specDir: string;
}

/** Creates a temp repo with a scaffolded `.vousoir/` and the fixture tree in `spec/`. */
export async function seedMcpTestRepo(): Promise<McpTestRepo> {
	const repoRoot = await mkdtemp(join(tmpdir(), 'v6r-mcp-'));
	await v6rInit({ repoRoot });
	const specDir = join(repoRoot, V6R_ROOT_DIRNAME, V6R_SUBDIRS.spec);
	await cp(WORK_ORDER_TREE_DIR, specDir, { recursive: true });
	return { repoRoot, specDir };
}
