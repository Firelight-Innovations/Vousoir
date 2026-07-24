/**
 * Asserts v6rInit() produces exactly the §8 layout, using a temp dir so the test never
 * writes into this repo.
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { V6R_GITIGNORE_CONTENTS, V6R_GITIGNORE_FILENAME, V6R_ROOT_DIRNAME, V6R_SUBDIRS } from '@vousoir/typings';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { v6rInit } from './v6r-init.ts';

describe('v6rInit', () => {
	let repoRoot: string;

	beforeEach(async () => {
		repoRoot = await mkdtemp(join(tmpdir(), 'v6r-init-'));
	});

	afterEach(async () => {
		await rm(repoRoot, { recursive: true, force: true });
	});

	it('creates exactly the §8 layout', async () => {
		const { v6rRoot } = await v6rInit({ repoRoot });
		expect(v6rRoot).toBe(join(repoRoot, V6R_ROOT_DIRNAME));

		const entries = (await readdir(v6rRoot)).sort();
		const expected = [...Object.values(V6R_SUBDIRS), V6R_GITIGNORE_FILENAME].sort();
		expect(entries).toEqual(expected);

		const gitignore = await readFile(join(v6rRoot, V6R_GITIGNORE_FILENAME), 'utf8');
		expect(gitignore).toBe(V6R_GITIGNORE_CONTENTS);
	});

	it('is idempotent against an existing .vousoir/', async () => {
		await v6rInit({ repoRoot });
		const before = (await readdir(join(repoRoot, V6R_ROOT_DIRNAME))).sort();

		const second = await v6rInit({ repoRoot });
		expect(second).toEqual({ v6rRoot: join(repoRoot, V6R_ROOT_DIRNAME) });

		const after = (await readdir(join(repoRoot, V6R_ROOT_DIRNAME))).sort();
		expect(after).toEqual(before);
	});
});
