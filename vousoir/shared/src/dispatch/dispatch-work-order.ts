/**
 * Runs one compiled work order through the `claude` CLI and records the run (Feature 5).
 *
 * Lives in `@vousoir/shared` rather than in the extension so it can be tested at all:
 * `extensions/vousoir-core` has no test runner and cannot get one cheaply while it imports
 * `vscode`. The extension keeps the parts that genuinely need the editor — quick pick,
 * confirmation, output channel — and this keeps everything else.
 *
 * `spawn` and `cli` are injectable so tests never launch a real agent. Tests point `cli`
 * at `process.execPath` running a short script: that exercises real process semantics —
 * streaming, exit codes, and whether a kill actually kills — without an agent loose in a
 * working tree with `--permission-mode acceptEdits`.
 *
 * Run status is transient and event-only. Nothing here writes to a spec file.
 */

import type { ChildProcess } from 'node:child_process';
import { spawn as nodeSpawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { DispatchEvent, DispatchRunResult, DispatchRunStatus, WorkOrder } from '@vousoir/typings';
import { workOrderSlug } from '../work-order/work-order-slug.ts';
import { claudeCli, claudeMissingMessage, claudeSpawnOptions, type ClaudeCli, type DispatchSpawnOptions } from './claude-cli.ts';
import { mapClaudeStreamLine } from './claude-stream-mapper.ts';
import { TraceWriter, type TraceEventBody } from './trace-writer.ts';

/** The `spawn` seam. Node's own `spawn` satisfies it; tests pass a recorder. */
export type DispatchSpawn = (command: string, args: readonly string[], options: DispatchSpawnOptions) => ChildProcess;

/** What one dispatch needs to run. */
export interface DispatchWorkOrderOptions {
	/** Repo root; the child runs here and the trace lands under its `.vousoir/traces/`. */
	readonly repoRoot: string;
	readonly workOrder: WorkOrder;
	readonly cli?: ClaudeCli;
	readonly spawn?: DispatchSpawn;
	readonly onEvent?: (event: DispatchEvent) => void;
	/** Injectable clock, so trace timestamps and run ids are deterministic under test. */
	readonly now?: () => Date;
	/** Grace period between the polite kill and `SIGKILL` on cancellation. */
	readonly killGraceMs?: number;
}

/** A dispatch in flight. */
export interface DispatchRun {
	readonly runId: string;
	readonly tracePath: string;
	readonly status: DispatchRunStatus;
	/** Resolves once the child has exited and the trace is closed. Never rejects. */
	readonly result: Promise<DispatchRunResult>;
	/** Terminates the child and settles the run as `failed` with `cancelled: true`. */
	cancel(): void;
}

const DEFAULT_KILL_GRACE_MS = 3_000;

/** Spawns the agent and starts recording. Resolves as soon as the run is under way. */
export async function dispatchWorkOrder(options: DispatchWorkOrderOptions): Promise<DispatchRun> {
	const now = options.now ?? (() => new Date());
	const cli = options.cli ?? claudeCli();
	const runId = buildRunId(options.workOrder.nodeId, now());
	const writer = await TraceWriter.open(options.repoRoot, runId, now);
	return new DispatchRunner(options, cli, runId, writer).start();
}

function buildRunId(nodeId: string, at: Date): string {
	return `${workOrderSlug(nodeId)}-${at.toISOString().replace(/[:.]/g, '-')}`;
}

class DispatchRunner {
	readonly #options: DispatchWorkOrderOptions;
	readonly #cli: ClaudeCli;
	readonly #runId: string;
	readonly #writer: TraceWriter;
	#status: DispatchRunStatus = 'idle';
	#child: ChildProcess | undefined;
	#cancelled = false;
	#killTimer: NodeJS.Timeout | undefined;
	#settle!: (result: DispatchRunResult) => void;
	readonly #result: Promise<DispatchRunResult>;

	constructor(options: DispatchWorkOrderOptions, cli: ClaudeCli, runId: string, writer: TraceWriter) {
		this.#options = options;
		this.#cli = cli;
		this.#runId = runId;
		this.#writer = writer;
		this.#result = new Promise((resolve) => {
			this.#settle = resolve;
		});
	}

	start(): DispatchRun {
		void this.#writer.append({ type: 'status', status: 'started', detail: this.#cli.command });
		this.#setStatus('running', undefined);

		const spawnFn = this.#options.spawn ?? nodeSpawn;
		const spawnOptions = claudeSpawnOptions(this.#options.repoRoot);
		try {
			this.#child = spawnFn(this.#cli.command, this.#cli.args, spawnOptions);
		} catch (error) {
			void this.#finish(null, describeSpawnFailure(error, this.#cli.command));
			return this.#handle();
		}
		this.#wire(this.#child);
		return this.#handle();
	}

	#handle(): DispatchRun {
		const runner = this;
		return {
			runId: this.#runId,
			tracePath: this.#writer.filePath,
			get status(): DispatchRunStatus {
				return runner.#status;
			},
			result: this.#result,
			cancel: () => {
				this.cancel();
			},
		};
	}

	#wire(child: ChildProcess): void {
		// The work order goes to stdin, never argv — see CLAUDE_DISPATCH_ARGS for why.
		child.stdin?.on('error', () => undefined);
		child.stdin?.end(this.#options.workOrder.markdown, 'utf8');

		if (child.stdout !== null) {
			createInterface({ input: child.stdout }).on('line', (line) => {
				for (const event of mapClaudeStreamLine(line)) {
					void this.#writer.append(event);
					this.#emit({ kind: 'output', stream: 'stdout', text: summarise(event) });
				}
			});
		}
		if (child.stderr !== null) {
			createInterface({ input: child.stderr }).on('line', (line) => {
				void this.#writer.append({ type: 'message', role: 'system', content: line });
				this.#emit({ kind: 'output', stream: 'stderr', text: line });
			});
		}
		child.once('error', (error) => {
			void this.#finish(null, describeSpawnFailure(error, this.#cli.command));
		});
		child.once('exit', (code, signal) => {
			void this.#finish(code, this.#exitFailure(code, signal));
		});
	}

	cancel(): void {
		if (this.#status !== 'running' || this.#child === undefined) {
			return;
		}
		this.#cancelled = true;
		this.#child.kill();
		// A polite kill can be ignored. Escalate rather than leaving an agent running:
		// an agent the user cannot stop is worse than no dispatch at all.
		this.#killTimer = setTimeout(() => this.#child?.kill('SIGKILL'), this.#options.killGraceMs ?? DEFAULT_KILL_GRACE_MS);
		this.#killTimer.unref?.();
	}

	#exitFailure(code: number | null, signal: NodeJS.Signals | null): string | undefined {
		if (this.#cancelled) {
			return 'The run was cancelled.';
		}
		if (code === 0) {
			return undefined;
		}
		return signal === null
			? `${this.#cli.command} exited with code ${code}.`
			: `${this.#cli.command} was terminated by ${signal}.`;
	}

	async #finish(exitCode: number | null, failure: string | undefined): Promise<void> {
		if (this.#status === 'done' || this.#status === 'failed') {
			return;
		}
		if (this.#killTimer !== undefined) {
			clearTimeout(this.#killTimer);
			this.#killTimer = undefined;
		}
		const status = failure === undefined ? 'done' : 'failed';
		const traceStatus = this.#cancelled ? 'cancelled' : status === 'done' ? 'completed' : 'failed';
		this.#writer.append({
			type: 'status',
			status: traceStatus,
			...(failure === undefined ? {} : { detail: failure }),
		});
		await this.#writer.close();
		this.#setStatus(status, failure);
		this.#settle({
			runId: this.#runId,
			nodeId: this.#options.workOrder.nodeId,
			status,
			exitCode,
			cancelled: this.#cancelled,
			tracePath: this.#writer.filePath,
			failure,
		});
	}

	#setStatus(status: DispatchRunStatus, detail: string | undefined): void {
		this.#status = status;
		this.#emit({ kind: 'status', status, detail });
	}

	#emit(event: DispatchEvent): void {
		this.#options.onEvent?.(event);
	}
}

/** Turns a spawn failure into something a user can act on, never a bare ENOENT. */
function describeSpawnFailure(error: unknown, command: string): string {
	const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
	if (code === 'ENOENT') {
		return claudeMissingMessage(command);
	}
	return `Could not start "${command}": ${error instanceof Error ? error.message : String(error)}`;
}

/** One readable line per trace event; the raw stream stays in the JSONL. */
function summarise(event: TraceEventBody): string {
	switch (event.type) {
		case 'message':
			return event.content;
		case 'thinking':
			return '(thinking)';
		case 'tool_call':
			return `→ ${event.toolName}`;
		case 'tool_result':
			return `← ${event.toolCallId}${event.isError === true ? ' (error)' : ''}`;
		case 'diff':
			return `± ${event.path}`;
		case 'status':
			return `[${event.status}]`;
	}
}
