/**
 * Dispatch behaviour, exercised against a real child process that is never `claude`.
 *
 * Tests point `cli` at `process.execPath` running a short inline script. That gives real
 * streaming, real exit codes and real kill semantics — the things a hand-written fake gets
 * wrong — without an agent running loose in a working tree under `--permission-mode
 * acceptEdits`.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ELECTRON_RUN_AS_NODE_ENV_VAR, type DispatchEvent, type WorkOrder } from '@vousoir/typings';
import { dispatchWorkOrder, type DispatchSpawn } from './dispatch-work-order.ts';
import type { DispatchSpawnOptions } from './claude-cli.ts';

/** Reads all of stdin, saves it to `argv[1]`, emits one stream-json line, exits 0. */
const ECHO_SCRIPT = [
	"const fs=require('node:fs');let s='';",
	"process.stdin.setEncoding('utf8');",
	'process.stdin.on(\'data\',(d)=>{s+=d});',
	"process.stdin.on('end',()=>{",
	"fs.writeFileSync(process.argv[1],s,'utf8');",
	'process.stdout.write(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"done"}]}})+"\\n");',
	'process.exit(0);});',
].join('');

/** Writes to stderr and exits non-zero. */
const FAIL_SCRIPT = "process.stdin.resume();process.stderr.write('boom\\n');setTimeout(()=>process.exit(3),10);";

let repoRoot: string;

beforeEach(async () => {
	repoRoot = await mkdtemp(join(tmpdir(), 'v6r-dispatch-'));
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

function workOrder(markdown = '# Work order\n'): WorkOrder {
	return { nodeId: 'api', slug: 'api', markdown };
}

describe('dispatchWorkOrder spawn contract', () => {
	it('passes ELECTRON_RUN_AS_NODE=1 through to the real spawn call', async () => {
		let seen: DispatchSpawnOptions | undefined;
		const recording: DispatchSpawn = (_command, _args, options) => {
			seen = options;
			return nodeSpawn(process.execPath, ['-e', 'process.stdin.resume();process.exit(0)'], options);
		};
		const run = await dispatchWorkOrder({ repoRoot, workOrder: workOrder(), spawn: recording, cli: { command: 'x', args: [] } });
		await run.result;

		expect(seen?.env[ELECTRON_RUN_AS_NODE_ENV_VAR]).toBe('1');
		expect(seen?.cwd).toBe(repoRoot);
		expect(seen?.windowsHide).toBe(true);
	});

	it('sends the work order on stdin, intact, including newlines and unicode', async () => {
		const echoPath = join(repoRoot, 'received.txt');
		const markdown = `---\nv6r-node: api\n---\n\n# Work order — HTTP API\n\nem dash —, arrows →, CJK 模块, emoji 🧱\n${'long line '.repeat(4000)}\n`;
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(markdown),
			cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT, echoPath] },
		});
		const result = await run.result;

		expect(result.status).toBe('done');
		// Over 40k characters: well past the ~32k Windows command-line cap that passing the
		// prompt via argv would have hit. stdin has no such limit, which is the point.
		expect(markdown.length).toBeGreaterThan(40_000);
		expect(await readFile(echoPath, 'utf8')).toBe(markdown);
	});
});

describe('dispatchWorkOrder status sequence', () => {
	it('runs idle → running → done on a clean exit', async () => {
		const events: DispatchEvent[] = [];
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT, join(repoRoot, 'echo.txt')] },
			onEvent: (event) => events.push(event),
		});
		const result = await run.result;

		expect(statuses(events)).toEqual(['running', 'done']);
		expect(run.status).toBe('done');
		expect(result.exitCode).toBe(0);
		expect(result.cancelled).toBe(false);
		expect(result.failure).toBeUndefined();
	});

	it('ends failed on a non-zero exit, naming the code, and forwards stderr', async () => {
		const events: DispatchEvent[] = [];
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', FAIL_SCRIPT] },
			onEvent: (event) => events.push(event),
		});
		const result = await run.result;

		expect(statuses(events)).toEqual(['running', 'failed']);
		expect(result.status).toBe('failed');
		expect(result.exitCode).toBe(3);
		expect(result.failure).toContain('exited with code 3');
		expect(outputs(events, 'stderr')).toContain('boom');
	});

	it('maps a stream-json assistant line into readable output', async () => {
		const events: DispatchEvent[] = [];
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', ECHO_SCRIPT, join(repoRoot, 'echo.txt')] },
			onEvent: (event) => events.push(event),
		});
		await run.result;

		expect(outputs(events, 'stdout')).toContain('done');
	});
});

describe('dispatchWorkOrder when the CLI is missing', () => {
	it('fails with an actionable message rather than a raw ENOENT, and does not throw', async () => {
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: 'vousoir-definitely-not-a-real-binary', args: [] },
		});
		const result = await run.result;

		expect(result.status).toBe('failed');
		expect(result.exitCode).toBeNull();
		expect(result.failure).toMatch(/could not find/i);
		expect(result.failure).toContain('PATH');
		expect(result.failure).not.toMatch(/ENOENT|spawn \w+ ENOENT/);
	});
});

function statuses(events: readonly DispatchEvent[]): readonly string[] {
	// flatMap rather than filter+map: filter does not narrow the discriminated union.
	return events.flatMap((event) => (event.kind === 'status' ? [event.status] : []));
}

function outputs(events: readonly DispatchEvent[], stream: 'stdout' | 'stderr'): readonly string[] {
	return events.flatMap((event) => (event.kind === 'output' && event.stream === stream ? [event.text] : []));
}
