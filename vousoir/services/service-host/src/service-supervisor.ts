/**
 * Supervises exactly one child service process: spawns it, tracks lifecycle state from process
 * events and stdio heartbeats, and terminates it on request. One `ServiceSupervisor` exists per
 * manifest discovered by `discoverServiceManifests`; `ServiceHost` owns the whole set.
 *
 * Entry points are run directly with `node <entryPoint>` — Node 24 strips TypeScript types
 * natively, so no build step or loader (ts-node, tsx, ...) is needed. See the service-host
 * work-package report for the empirical check that this resolves workspace `exports` correctly.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import {
	ELECTRON_RUN_AS_NODE_ENV_VAR,
	PARENT_PID_ENV_VAR,
	type ServiceHealth,
	type ServiceManifest,
	type ServiceState,
} from '@vousoir/typings';
import { parseHeartbeatLine } from './heartbeat-line.ts';
import { logHost } from './logger.ts';

export interface ServiceSupervisorOptions {
	readonly manifest: ServiceManifest;
	readonly packageDir: string;
	/** A `running` service with no heartbeat for longer than this is marked `unhealthy`. */
	readonly staleAfterMs: number;
}

export class ServiceSupervisor {
	private readonly manifest: ServiceManifest;
	private readonly staleAfterMs: number;
	private readonly child: ChildProcess;
	private state: ServiceState = 'starting';
	private since: string = new Date().toISOString();
	private detail: string | undefined;
	private lastHeartbeatAt: number | undefined;
	private terminated = false;
	private terminationPromise: Promise<void> | undefined;

	constructor(options: ServiceSupervisorOptions) {
		this.manifest = options.manifest;
		this.staleAfterMs = options.staleAfterMs;
		this.child = this.spawnChild(options.packageDir);
	}

	private spawnChild(packageDir: string): ChildProcess {
		const entryFile = join(packageDir, this.manifest.entryPoint);
		const child = spawn(process.execPath, [entryFile], {
			cwd: packageDir,
			// ELECTRON_RUN_AS_NODE (PATCHES.md A2): under the real extension host, process.execPath is
			// the Electron binary, not node — this makes it run the entry as plain Node instead of
			// launching a nested Electron instance. Inherited by any process this child spawns; a
			// no-op under plain Node (which is why the launcher's own tests never surfaced the bug).
			env: { ...process.env, [PARENT_PID_ENV_VAR]: String(process.pid), [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1' },
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		});

		child.once('spawn', () => logHost(`"${this.manifest.name}" spawned (pid ${child.pid ?? 'unknown'}).`));
		child.on('error', (error) => this.transition('failed', `spawn error: ${error.message}`));
		child.on('exit', (code, signal) => this.onChildExit(code, signal));

		this.watchStdout(child);
		this.forwardStderr(child);
		return child;
	}

	private onChildExit(code: number | null, signal: NodeJS.Signals | null): void {
		const summary = `code ${code ?? 'null'}, signal ${signal ?? 'null'}`;
		if (this.terminated) {
			this.transition('stopped', `terminated by dispose (${summary}).`);
			return;
		}
		this.transition(code === 0 ? 'stopped' : 'failed', `exited unexpectedly (${summary}).`);
	}

	private watchStdout(child: ChildProcess): void {
		if (!child.stdout) {
			return;
		}
		createInterface({ input: child.stdout }).on('line', (line) => {
			if (!parseHeartbeatLine(line)) {
				return;
			}
			this.lastHeartbeatAt = Date.now();
			if (this.state === 'starting' || this.state === 'unhealthy') {
				this.transition('running');
			}
		});
	}

	private forwardStderr(child: ChildProcess): void {
		if (!child.stderr) {
			return;
		}
		createInterface({ input: child.stderr }).on('line', (line) => logHost(`"${this.manifest.name}" stderr: ${line}`));
	}

	private transition(state: ServiceState, detail?: string): void {
		this.state = state;
		this.since = new Date().toISOString();
		this.detail = detail;
	}

	/** If still `starting` once the launcher's startup window elapses, marks the service failed. */
	markStartupTimedOutIfStillStarting(): void {
		if (this.state === 'starting') {
			this.transition('failed', 'did not report a heartbeat within the startup timeout.');
		}
	}

	/** Re-evaluates heartbeat staleness against the wall clock. Call before reading `getHealth()`. */
	checkStaleness(): void {
		if (this.state !== 'running' || this.lastHeartbeatAt === undefined) {
			return;
		}
		if (Date.now() - this.lastHeartbeatAt > this.staleAfterMs) {
			this.transition('unhealthy', 'no heartbeat received within the expected interval.');
		}
	}

	getHealth(): ServiceHealth {
		return {
			name: this.manifest.name,
			state: this.state,
			...(this.child.pid !== undefined ? { pid: this.child.pid } : {}),
			since: this.since,
			...(this.detail !== undefined ? { detail: this.detail } : {}),
		};
	}

	/** Terminates the child process. Idempotent — safe to call more than once. */
	async terminate(): Promise<void> {
		this.terminationPromise ??= this.doTerminate();
		return this.terminationPromise;
	}

	private async doTerminate(): Promise<void> {
		this.terminated = true;
		if (this.child.exitCode !== null || this.child.signalCode !== null) {
			return;
		}
		await new Promise<void>((resolve) => {
			const escalation = setTimeout(() => this.child.kill('SIGKILL'), 3000);
			this.child.once('exit', () => {
				clearTimeout(escalation);
				resolve();
			});
			this.child.kill();
		});
	}
}
