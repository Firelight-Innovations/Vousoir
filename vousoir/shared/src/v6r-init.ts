/**
 * Scaffolds a well-formed `.v6r/` folder (work order §8) at a given repo root. Used later
 * by "open project" flows; exercised now by a unit test (work order §9.11).
 *
 * Layout is driven entirely by `@vousoir/typings`'s `V6R_SUBDIRS` / `V6R_ROOT_DIRNAME` /
 * `V6R_GITIGNORE_*` constants so this scaffolder can never drift from the §8 spec.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { V6R_GITIGNORE_CONTENTS, V6R_GITIGNORE_FILENAME, V6R_ROOT_DIRNAME, V6R_SUBDIRS } from '@vousoir/typings';

/** Where to scaffold `.v6r/`. */
export interface V6rInitOptions {
	/** Absolute path to the user repository's root; `.v6r/` is created directly under it. */
	readonly repoRoot: string;
}

/** What `v6rInit()` scaffolded. */
export interface V6rInitResult {
	/** Absolute path to the created (or already-existing) `.v6r/` directory. */
	readonly v6rRoot: string;
}

/**
 * Scaffolds `.v6r/` at `options.repoRoot`: the five subdirectories from `V6R_SUBDIRS`
 * plus a `.gitignore` that ignores the derived `cache/`. Idempotent — safe to call
 * against a repo that already has a `.v6r/` folder; existing subdirectory contents are
 * left untouched, and `.gitignore` is simply rewritten to its canonical contents.
 */
export async function v6rInit(options: V6rInitOptions): Promise<V6rInitResult> {
	const v6rRoot = join(options.repoRoot, V6R_ROOT_DIRNAME);
	await mkdir(v6rRoot, { recursive: true });
	await Promise.all(Object.values(V6R_SUBDIRS).map((subdir) => mkdir(join(v6rRoot, subdir), { recursive: true })));
	await writeFile(join(v6rRoot, V6R_GITIGNORE_FILENAME), V6R_GITIGNORE_CONTENTS, 'utf8');
	return { v6rRoot };
}
