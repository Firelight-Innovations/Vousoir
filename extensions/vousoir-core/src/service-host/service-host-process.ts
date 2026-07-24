/**
 * Spawns service-host's process entry (`main.ts`) as a child process and talks to it over stdio
 * (`vousoir/PATCHES.md` A1: service-host is a supervised PROCESS, not a library import).
 *
 * `ELECTRON_RUN_AS_NODE` is mandatory (PATCHES.md A2): inside the extension host,
 * `process.execPath` is the Electron binary, not plain node - spawning it without that env var
 * launches a whole Electron instance instead of a Node process. `PARENT_PID_ENV_VAR` lets the
 * spawned process watchdog this one and self-exit if orphaned, a safety net behind section 9.8 for when
 * this extension is hard-killed and never runs `dispose()`.
 *
 * stdout carries protocol traffic only, validated against `@vousoir/typings`'
 * `serviceHostResponseSchema` via `stdio-codec.ts` - never trusted blindly. stderr is
 * human-readable logging, forwarded verbatim to the "Vousoir" output channel. Readiness is the
 * unsolicited `ready` message, not a successful spawn - `main.ts` may still be discovering and
 * starting its own supervised services when the process comes up.
 *
 * Never throws past `spawnServiceHostProcess`'s caller expecting a clean failure: a spawn or
 * handshake problem surfaces as a rejected promise, which `service-host-manager.ts` catches.
 */
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { OutputChannel } from 'vscode';
import {
	ELECTRON_RUN_AS_NODE_ENV_VAR,
	PARENT_PID_ENV_VAR,
	type ServiceHostHandle,
	type ServiceHostHealth,
	type ServiceHostRequest,
	type ServiceHostResponse,
	type ServiceHostState,
} from '@vousoir/typings';
import { formatRequestLine, parseResponseLine } from './stdio-codec.ts';

const STARTUP_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SHUTDOWN_GRACE_MS = 3_000;

export async function spawnServiceHostProcess(entryPath: string, servicesRoot: string, log: OutputChannel): Promise<ServiceHostProcess> {
	const child = spawn(process.execPath, [entryPath, servicesRoot], {
		env: {
			...process.env,
			[ELECTRON_RUN_AS_NODE_ENV_VAR]: '1',
			[PARENT_PID_ENV_VAR]: String(process.pid),
		},
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true,
	});

	const instance = new ServiceHostProcess(child, log);
	await instance.waitUntilReady(STARTUP_TIMEOUT_MS);
	return instance;
}

interface Pending {
	readonly resolve: (response: ServiceHostResponse) => void;
	readonly reject: (error: Error) => void;
}

export class ServiceHostProcess implements ServiceHostHandle {
	private readonly child: ChildProcessByStdio<Writable, Readable, Readable>;
	private readonly log: OutputChannel;
	private readonly pending = new Map<string, Pending>();
	private readonly resolveReady: () => void;
	private readonly rejectReady: (error: Error) => void;
	private readonly readyPromise: Promise<void>;
	private nextRequestId = 0;
	private hostState: ServiceHostState = 'starting';
	private disposePromise: Promise<void> | undefined;

	public constructor(child: ChildProcessByStdio<Writable, Readable, Readable>, log: OutputChannel) {
		this.child = child;
		this.log = log;

		let resolveReady!: () => void;
		let rejectReady!: (error: Error) => void;
		this.readyPromise = new Promise((resolve, reject) => {
			resolveReady = resolve;
			rejectReady = reject;
		});
		this.resolveReady = resolveReady;
		this.rejectReady = rejectReady;

		createInterface({ input: child.stdout }).on('line', (line) => this.onStdoutLine(line));
		createInterface({ input: child.stderr }).on('line', (line) => this.log.appendLine(`[service-host] ${line}`));
		child.once('error', (error) => this.onTerminated(error instanceof Error ? error : new Error(String(error))));
		child.once('exit', (code, signal) => this.onTerminated(new Error(`service host exited (code=${code}, signal=${signal})`)));
	}

	public get state(): ServiceHostState {
		return this.hostState;
	}

	public async waitUntilReady(timeoutMs: number): Promise<void> {
		const timer = setTimeout(() => this.rejectReady(new Error('service host did not signal ready in time')), timeoutMs);
		try {
			await this.readyPromise;
		} finally {
			clearTimeout(timer);
		}
	}

	public async health(): Promise<ServiceHostHealth> {
		const response = await this.request({ type: 'health', id: this.newRequestId() });
		if (response.type === 'error') {
			this.hostState = 'unhealthy';
			throw new Error(`service host reported an error: ${response.message}`);
		}
		if (response.type !== 'health') {
			throw new Error(`unexpected service host response for health: ${JSON.stringify(response)}`);
		}
		this.hostState = response.health.state;
		return response.health;
	}

	public async dispose(): Promise<void> {
		this.disposePromise ??= this.doDispose();
		return this.disposePromise;
	}

	private async doDispose(): Promise<void> {
		try {
			await this.request({ type: 'shutdown', id: this.newRequestId() });
		} catch {
			// No clean ack in time - fall through to killing the process directly below.
		}
		if (!(await this.waitForExit(SHUTDOWN_GRACE_MS))) {
			this.child.kill();
			if (!(await this.waitForExit(SHUTDOWN_GRACE_MS))) {
				this.child.kill('SIGKILL');
			}
		}
		this.hostState = 'disposed';
	}

	private newRequestId(): string {
		return `vousoir-core-${this.nextRequestId++}`;
	}

	private request(request: ServiceHostRequest): Promise<ServiceHostResponse> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(request.id);
				reject(new Error(`service host did not respond to '${request.type}' in time`));
			}, REQUEST_TIMEOUT_MS);
			this.pending.set(request.id, {
				resolve: (response) => { clearTimeout(timer); this.pending.delete(request.id); resolve(response); },
				reject: (error) => { clearTimeout(timer); this.pending.delete(request.id); reject(error); },
			});
			try {
				this.child.stdin.write(formatRequestLine(request));
			} catch (error) {
				this.pending.get(request.id)?.reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	private onStdoutLine(line: string): void {
		const response = parseResponseLine(line);
		if (!response) {
			return;
		}
		switch (response.type) {
			case 'ready':
				this.resolveReady();
				return;
			case 'error':
				if (response.id === undefined) {
					this.log.appendLine(`[service-host] unsolicited error: ${response.message}`);
					return;
				}
				this.pending.get(response.id)?.resolve(response);
				return;
			case 'health':
			case 'shutdown':
				this.pending.get(response.id)?.resolve(response);
				return;
		}
	}

	private onTerminated(error: Error): void {
		this.rejectReady(error);
		for (const entry of this.pending.values()) {
			entry.reject(error);
		}
	}

	private waitForExit(timeoutMs: number): Promise<boolean> {
		if (this.child.exitCode !== null || this.child.signalCode !== null) {
			return Promise.resolve(true);
		}
		return new Promise((resolve) => {
			const timer = setTimeout(() => resolve(false), timeoutMs);
			this.child.once('exit', () => {
				clearTimeout(timer);
				resolve(true);
			});
		});
	}
}
