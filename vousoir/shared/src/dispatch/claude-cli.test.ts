/**
 * The `ELECTRON_RUN_AS_NODE` assertion is the whole reason `claudeSpawnOptions` is a pure
 * function rather than inline in the spawn call.
 *
 * `vousoir/PATCHES.md` A2: inside the extension host `process.execPath` is the Electron
 * binary, and a spawn without this env var launches an entire Electron instance. A
 * plain-Node test cannot observe that — under vitest `process.execPath` IS node, so the
 * spawn succeeds either way. Asserting on the options object is the only check that works
 * on this side of the boundary; the other half is a manual run in the real shell.
 */

import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ELECTRON_RUN_AS_NODE_ENV_VAR } from '@vousoir/typings';
import { CLAUDE_COMMAND, CLAUDE_DISPATCH_ARGS, claudeCli, claudeMissingMessage, claudeSpawnOptions, findClaudeCli } from './claude-cli.ts';

describe('claudeSpawnOptions', () => {
	it('sets ELECTRON_RUN_AS_NODE=1', () => {
		expect(claudeSpawnOptions('/repo', {}).env[ELECTRON_RUN_AS_NODE_ENV_VAR]).toBe('1');
	});

	it('keeps the surrounding environment rather than replacing it', () => {
		const options = claudeSpawnOptions('/repo', { PATH: '/usr/bin', ANTHROPIC_API_KEY: 'secret' });
		expect(options.env['PATH']).toBe('/usr/bin');
		expect(options.env['ANTHROPIC_API_KEY']).toBe('secret');
		expect(options.env[ELECTRON_RUN_AS_NODE_ENV_VAR]).toBe('1');
	});

	it('runs in the repo root, pipes all three streams, and hides the console window', () => {
		const options = claudeSpawnOptions('/repo/here', {});
		expect(options.cwd).toBe('/repo/here');
		expect(options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
		expect(options.windowsHide).toBe(true);
	});
});

describe('claudeCli', () => {
	it('asks for stream-json output and acceptEdits, and never puts the prompt in argv', () => {
		const { command, args } = claudeCli();
		expect(command).toBe(CLAUDE_COMMAND);
		expect(args).toContain('--print');
		expect(args).toContain('stream-json');
		expect(args.join(' ')).toContain('--permission-mode acceptEdits');
		// The work order goes to stdin. Anything resembling a prompt positional here would
		// reintroduce the ~32k Windows command-line limit this deliberately avoids.
		expect(args.every((arg) => arg.startsWith('-') || CLAUDE_DISPATCH_ARGS.includes(arg))).toBe(true);
	});
});

describe('findClaudeCli', () => {
	it('finds an executable on a synthetic PATH', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'v6r-cli-'));
		try {
			const name = process.platform === 'win32' ? 'faux.CMD' : 'faux';
			const filePath = join(directory, name);
			await writeFile(filePath, '', 'utf8');
			await chmod(filePath, 0o755);
			const found = await findClaudeCli('faux', { PATH: directory, PATHEXT: '.CMD' });
			expect(found).toBe(filePath);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('returns undefined when nothing on PATH matches', async () => {
		const empty = await mkdtemp(join(tmpdir(), 'v6r-cli-empty-'));
		try {
			expect(await findClaudeCli('definitely-not-here', { PATH: empty })).toBeUndefined();
		} finally {
			await rm(empty, { recursive: true, force: true });
		}
	});

	it('tolerates an empty or absent PATH instead of throwing', async () => {
		expect(await findClaudeCli('anything', {})).toBeUndefined();
		expect(await findClaudeCli('anything', { PATH: `${delimiter}${delimiter}` })).toBeUndefined();
	});
});

describe('claudeMissingMessage', () => {
	it('names the command, the fix, and that nothing changed', () => {
		const message = claudeMissingMessage();
		expect(message).toContain('claude');
		expect(message).toContain('PATH');
		expect(message).toMatch(/install/i);
		expect(message).toContain('status is unchanged');
		expect(message).not.toMatch(/ENOENT|errno/);
	});
});
