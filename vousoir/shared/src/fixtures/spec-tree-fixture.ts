/**
 * Test-only helper: seeds a throwaway repo whose `.vousoir/spec/` is a copy of the
 * `spec-tree/` fixture — a three-level tree (root → api → users, root → storage) that
 * deliberately mixes the pre-M1 scalar `contract` with ADR-008 typed `contracts`, and
 * carries a hand-written YAML comment.
 *
 * Copying rather than reading in place is the point: a round-trip test that wrote to the
 * fixture would corrupt a tracked file the moment it regressed.
 */

import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { V6R_ROOT_DIRNAME, V6R_SUBDIRS } from '@vousoir/typings';
import { v6rInit } from '../v6r-init.ts';

/** Absolute path of the committed fixture tree. Read-only. */
export const SPEC_TREE_FIXTURE_DIR = join(import.meta.dirname, 'spec-tree');

/** A seeded temp repo. Delete `repoRoot` when done. */
export interface SpecTreeFixture {
	readonly repoRoot: string;
	readonly specDir: string;
}

/** Creates a temp repo with a scaffolded `.vousoir/` and the fixture tree copied into `spec/`. */
export async function seedSpecTreeFixture(): Promise<SpecTreeFixture> {
	const repoRoot = await mkdtemp(join(tmpdir(), 'v6r-spec-store-'));
	await v6rInit({ repoRoot });
	const specDir = join(repoRoot, V6R_ROOT_DIRNAME, V6R_SUBDIRS.spec);
	await cp(SPEC_TREE_FIXTURE_DIR, specDir, { recursive: true });
	return { repoRoot, specDir };
}
