/**
 * The trace is what survives a run, so it has to be readable when the run was not clean —
 * and cancellation has to actually stop the agent, not just flip a flag in our own state.
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { traceEventSchema, type TraceEvent, type WorkOrder } from '@vousoir/typings';
import { dispatchWorkOrder, type DispatchSpawn } from './dispatch-work-order.ts';

/** Emits one stream-json line, then stays alive until killed. */
const FOREVER_SCRIPT = [
	'process.stdin.resume();',
	'process.stdout.write(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"working"}]}})+"\\n");',
	'setInterval(()=>{},1000);',
].join('');

/** Emits a tool_use then dies abruptly, leaving a partial run. */
const CRASH_SCRIPT = [
	'process.stdin.resume();',
	'process.stdout.write(JSON.stringify({type:"assistant",message:{content:[{type:"tool_use",id:"toolu_1",name:"Write",input:{path:"a.ts"}}]}})+"\\n");',
	'setTimeout(()=>process.abort(),20);',
].join('');

let repoRoot: string;

beforeEach(async () => {
	repoRoot = await mkdtemp(join(tmpdir(), 'v6r-trace-'));
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

function workOrder(): WorkOrder {
	return { nodeId: 'api', slug: 'api', markdown: '# Work order\n' };
}

async function readTrace(tracePath: string): Promise<readonly TraceEvent[]> {
	const raw = await readFile(tracePath, 'utf8');
	const lines = raw.split('\n').filter((line) => line.length > 0);
	// Every line must be a complete JSON object AND a valid trace event; a half-written
	// last line would mean a crash could make the whole trace unreadable.
	return lines.map((line) => traceEventSchema.parse(JSON.parse(line) as unknown));
}

/** Polls until the pid is gone, so the assertion is about the OS, not about our flag. */
async function expectProcessGone(pid: number): Promise<void> {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			process.kill(pid, 0);
		} catch {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error(`process ${pid} is still alive after cancellation`);
}

describe('dispatch traces', () => {
	it('writes one valid trace event per line, opening with started and closing with completed', async () => {
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', 'process.stdin.resume();process.exit(0)'] },
		});
		const result = await run.result;
		const events = await readTrace(result.tracePath);

		expect(result.tracePath).toBe(join(repoRoot, '.vousoir', 'traces', `${run.runId}.jsonl`));
		expect(events[0]).toMatchObject({ type: 'status', status: 'started' });
		expect(events.at(-1)).toMatchObject({ type: 'status', status: 'completed' });
		expect(events.map((event) => event.seq)).toEqual(events.map((_event, index) => index));
		expect(new Set(events.map((event) => event.runId))).toEqual(new Set([run.runId]));
	});

	it('leaves a readable trace when the agent dies mid-run', async () => {
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', CRASH_SCRIPT] },
		});
		const result = await run.result;
		const events = await readTrace(result.tracePath);

		expect(result.status).toBe('failed');
		expect(events.some((event) => event.type === 'tool_call' && event.toolName === 'Write')).toBe(true);
		expect(events.at(-1)).toMatchObject({ type: 'status', status: 'failed' });
	});

	it('records a cancelled run as cancelled, not merely failed', async () => {
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', FOREVER_SCRIPT] },
		});
		run.cancel();
		const result = await run.result;

		expect(result.cancelled).toBe(true);
		expect(result.status).toBe('failed');
		expect((await readTrace(result.tracePath)).at(-1)).toMatchObject({ type: 'status', status: 'cancelled' });
	});
});

describe('cancellation', () => {
	it('actually kills the child process', async () => {
		let child: ChildProcess | undefined;
		const recording: DispatchSpawn = (command, args, options) => {
			const spawned = nodeSpawn(command, [...args], options);
			child = spawned;
			return spawned;
		};
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', FOREVER_SCRIPT] },
			spawn: recording,
		});

		const pid = child?.pid;
		expect(pid).toBeGreaterThan(0);
		run.cancel();
		await run.result;

		expect(child?.killed).toBe(true);
		await expectProcessGone(pid ?? 0);
	});

	it('is a no-op once the run has already finished', async () => {
		const run = await dispatchWorkOrder({
			repoRoot,
			workOrder: workOrder(),
			cli: { command: process.execPath, args: ['-e', 'process.stdin.resume();process.exit(0)'] },
		});
		const result = await run.result;
		run.cancel();

		expect(result.status).toBe('done');
		expect(result.cancelled).toBe(false);
		expect(run.status).toBe('done');
	});
});
