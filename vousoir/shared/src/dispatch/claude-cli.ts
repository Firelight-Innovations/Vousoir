/**
 * How the `claude` CLI is invoked, and how its absence is reported.
 *
 * The spawn options are built by a pure function on purpose. `ELECTRON_RUN_AS_NODE=1` is
 * mandatory on every spawn from the extension host (`vousoir/PATCHES.md` A2), and no
 * plain-Node test can catch its absence — under vitest `process.execPath` IS node, so a
 * missing env var passes every test and then launches a whole Electron instance in the
 * real product. The only reliable check is asserting on the options object itself, which
 * is why that object is reachable without spawning anything.
 */

import { access, constants } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { ELECTRON_RUN_AS_NODE_ENV_VAR } from '@vousoir/typings';

/** The executable and arguments one dispatch runs. */
export interface ClaudeCli {
	readonly command: string;
	readonly args: readonly string[];
}

/** Options handed to `spawn`. Narrow on purpose — this is the contract the test asserts. */
export interface DispatchSpawnOptions {
	readonly cwd: string;
	readonly env: NodeJS.ProcessEnv;
	/** Mutable tuple, not `readonly`: node's own `SpawnOptions.stdio` will not accept a readonly one. */
	readonly stdio: ['pipe', 'pipe', 'pipe'];
	readonly windowsHide: boolean;
}

/** Default executable name; resolved through `PATH` by the OS. */
export const CLAUDE_COMMAND = 'claude';

/**
 * The work order is written to the child's STDIN, never passed as an argument.
 *
 * `--input-format text` under `--print` makes the CLI read its prompt from stdin. Passing
 * a work order via argv would work until it did not: Windows caps a command line at about
 * 32,768 characters, and a work order for a node with several contracts and test cases
 * plus ancestor and neighbour context reaches that easily. The failure would be a truncated
 * or rejected prompt at some unpredictable spec size, which is a terrible bug to debug.
 * stdin has no such limit.
 *
 * `--output-format stream-json` gives one JSON object per line as the run proceeds, which
 * maps onto the existing trace-event schema (see `claude-stream-mapper.ts`).
 */
export const CLAUDE_DISPATCH_ARGS: readonly string[] = [
	'--print',
	'--input-format',
	'text',
	'--output-format',
	'stream-json',
	'--verbose',
	'--permission-mode',
	'acceptEdits',
];

/** The default CLI invocation. */
export function claudeCli(): ClaudeCli {
	return { command: CLAUDE_COMMAND, args: CLAUDE_DISPATCH_ARGS };
}

/**
 * Spawn options for a dispatch.
 *
 * `ELECTRON_RUN_AS_NODE: '1'` is set even though `claude` is a separate executable rather
 * than `process.execPath`. PATCHES.md A2's inheritance note cuts both ways: the extension
 * host's own environment is Electron-flavoured, and any Node process `claude` itself
 * spawns inherits whatever is passed down. Setting it is free; omitting it is a class of
 * bug no test on this side can see.
 */
export function claudeSpawnOptions(cwd: string, baseEnv: NodeJS.ProcessEnv = process.env): DispatchSpawnOptions {
	return {
		cwd,
		env: { ...baseEnv, [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1' },
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true,
	};
}

/**
 * Whether `claude` is reachable, and if not, a message that says what to do about it.
 *
 * Probed by walking `PATH` rather than by spawning: spawning to find out costs a process
 * and, worse, an `ENOENT` surfaced from deep inside a stream pipeline is exactly the raw
 * error this is meant to replace.
 */
export async function findClaudeCli(
	command: string = CLAUDE_COMMAND,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
	const pathValue = env['PATH'] ?? env['Path'] ?? '';
	const extensions = process.platform === 'win32' ? (env['PATHEXT'] ?? '.EXE;.CMD;.BAT').split(';') : [''];
	for (const directory of pathValue.split(delimiter).filter((entry) => entry.length > 0)) {
		for (const extension of extensions) {
			const candidate = join(directory, `${command}${extension}`);
			try {
				await access(candidate, constants.X_OK);
				return candidate;
			} catch {
				// Not here; keep walking PATH rather than failing on the first miss.
			}
		}
	}
	return undefined;
}

/** The message shown when `claude` is not installed. Names the fix, not the errno. */
export function claudeMissingMessage(command: string = CLAUDE_COMMAND): string {
	return (
		`Vousoir could not find the "${command}" CLI on your PATH, so there is nothing to dispatch to. ` +
		'Install Claude Code (https://claude.com/claude-code), or make sure the CLI is on the PATH of the ' +
		'process running the editor, then try again. The node\'s status is unchanged.'
	);
}
