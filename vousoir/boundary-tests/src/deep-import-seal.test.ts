/**
 * Proves the deep-import fixture fails at real Node module resolution (work order §9.9 / §6.3),
 * not merely that some linter dislikes it. Spawns a genuine `node` process on the fixture file —
 * bypassing vitest's own (Vite-powered) module loader entirely — with cwd set to this package,
 * whose `@vousoir/shared` workspace dependency gives Node's resolver the real, sealed
 * package.json `exports` map to enforce against.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from './ci-tooling-paths.ts';

const FIXTURE = join(PACKAGE_ROOT, 'fixtures', 'deep-import-into-shared.fixture.mjs');

describe('deep import into a sealed package (@vousoir/shared)', () => {
	it('fails module resolution with ERR_PACKAGE_PATH_NOT_EXPORTED', () => {
		const result = spawnSync(process.execPath, [FIXTURE], {
			cwd: PACKAGE_ROOT,
			encoding: 'utf8',
		});

		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('ERR_PACKAGE_PATH_NOT_EXPORTED');
		expect(result.stderr).toContain("Package subpath './src/index.ts' is not defined by \"exports\"");
		expect(result.stderr).toMatch(/@vousoir[\\/]shared[\\/]package\.json/);
	});

	it('confirms the public surface ("@vousoir/shared") still resolves normally', () => {
		const result = spawnSync(
			process.execPath,
			['--input-type=module', '-e', "import('@vousoir/shared').then(() => process.exit(0), () => process.exit(1))"],
			{ cwd: PACKAGE_ROOT, encoding: 'utf8' },
		);

		expect(result.status).toBe(0);
	});
});
