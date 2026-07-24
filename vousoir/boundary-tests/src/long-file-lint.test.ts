/**
 * Proves the 501-line fixture fails `pnpm lint` (work order §9.9 / §9.10), asserting on the
 * specific `max-lines` rule rather than "something failed". Runs the real `eslint` binary with
 * the real `vousoir/eslint.config.mjs`, pointed directly at the fixture file — a path
 * `vousoir/package.json`'s `lint`/`lint:strict` scripts never pass (they only reach
 * `vousoir/boundary-tests/src`, not `fixtures/`), which is what keeps this fixture quarantined.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ESLINT_BIN, PACKAGE_ROOT, REPO_ROOT } from './ci-tooling-paths.ts';

interface EslintMessage {
	ruleId: string | null;
	severity: 1 | 2;
	message: string;
}

interface EslintFileResult {
	filePath: string;
	messages: EslintMessage[];
}

const FIXTURE = join(PACKAGE_ROOT, 'fixtures', 'long-file.fixture.ts');

function lintFixture(): { status: number | null; messages: EslintMessage[] } {
	const run = spawnSync(
		ESLINT_BIN,
		['--config', 'vousoir/eslint.config.mjs', '--max-warnings=0', '--format', 'json', FIXTURE],
		// shell: true — on Windows, spawning a `.CMD` shim directly (without a shell) fails with
		// EINVAL; it must go through cmd.exe, exactly like `pnpm run lint:strict` itself does.
		{ cwd: REPO_ROOT, encoding: 'utf8', shell: true },
	);
	const results = JSON.parse(run.stdout) as EslintFileResult[];
	return { status: run.status, messages: results[0]?.messages ?? [] };
}

describe('501-line fixture', () => {
	it('fails the max-lines error rule (500-line cap)', () => {
		const { status, messages } = lintFixture();

		expect(status).not.toBe(0);
		const maxLines = messages.find((m) => m.ruleId === 'max-lines');
		expect(maxLines).toBeDefined();
		expect(maxLines?.severity).toBe(2); // error
		expect(maxLines?.message).toContain('501');
	});

	it('also trips the soft-max-lines warning (300-line cap), which lint:strict also fails on', () => {
		const { messages } = lintFixture();

		const softMaxLines = messages.find((m) => m.ruleId === 'vousoir/soft-max-lines');
		expect(softMaxLines).toBeDefined();
		expect(softMaxLines?.severity).toBe(1); // warn
	});
});
