/**
 * Proves the cross-service-import fixture fails dependency-cruiser (work order §9.9 / §7.1),
 * asserting on the specific `no-cross-service-imports` rule rather than "something failed".
 *
 * Runs the real `depcruise` binary with the real `.dependency-cruiser.cjs`, pointed directly at
 * the quarantined fixture — deliberately without the `-x "__ci-fixtures__"` exclusion flag that
 * `vousoir/package.json`'s `dep-check` script applies for the normal run. That flag is what keeps
 * this fixture out of `pnpm run dep-check`; omitting it here is what lets this test see it.
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { DEPCRUISE_BIN, REPO_ROOT } from './ci-tooling-paths.ts';

interface DepcruiseViolation {
	rule: { name: string; severity: string };
	from: string;
	to: string;
}

interface DepcruiseResult {
	summary: { violations: DepcruiseViolation[] };
}

const FIXTURE_ARGS = ['--config', '.dependency-cruiser.cjs', 'vousoir/services/__ci-fixtures__'];

// shell: true — on Windows, spawning a `.CMD` shim directly (without a shell) fails with EINVAL;
// it must go through cmd.exe, exactly like `pnpm run dep-check` itself does.
const SPAWN_OPTS = { cwd: REPO_ROOT, encoding: 'utf8' as const, shell: true };

describe('cross-service import (vousoir/services/__ci-fixtures__ → service-host)', () => {
	it('fails the same way `pnpm run dep-check` would gate CI (non-zero exit, err reporter)', () => {
		const run = spawnSync(DEPCRUISE_BIN, ['--output-type', 'err', ...FIXTURE_ARGS], SPAWN_OPTS);

		expect(run.status).not.toBe(0);
		expect(run.stdout).toContain('no-cross-service-imports');
	});

	it('is rejected specifically by the no-cross-service-imports rule, not some other rule', () => {
		const run = spawnSync(DEPCRUISE_BIN, ['--output-type', 'json', ...FIXTURE_ARGS], SPAWN_OPTS);
		const result = JSON.parse(run.stdout) as DepcruiseResult;

		const violation = result.summary.violations.find((v) => v.rule.name === 'no-cross-service-imports');
		expect(violation).toBeDefined();
		expect(violation?.rule.severity).toBe('error');
		expect(violation?.to).toContain('services/service-host/src/index.ts');
	});
});
