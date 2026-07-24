/**
 * End-to-end test of the process entry (`main.ts`) — the actual integration path `vousoir-core`
 * uses (PATCHES.md A1): spawn `main.ts` as a child process and speak `@vousoir/typings`'s
 * `service-host-protocol.ts` to it. Proves the whole two-level process tree (this test →
 * service-host → dummy-service) leaves no orphan on shutdown (work order §9.8), which
 * `service-host-launcher.test.ts` cannot exercise since it drives the library in-process.
 *
 * Waits for the unsolicited `ready` notification before sending any request — per the protocol
 * doc, readiness must not be assumed from process spawn.
 */

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ELECTRON_RUN_AS_NODE_ENV_VAR, SERVICE_HOST_PROTOCOL_VERSION, type ServiceHostResponse } from '@vousoir/typings';

const HERE = dirname(fileURLToPath(import.meta.url));
const MAIN_ENTRY = join(HERE, 'main.ts');
const SERVICES_ROOT = join(HERE, '..', '..');

type ReadyResponse = Extract<ServiceHostResponse, { type: 'ready' }>;
type RequestFn = (type: 'health' | 'shutdown', timeoutMs?: number) => Promise<ServiceHostResponse>;
interface ProtocolClient {
	readonly waitForReady: (timeoutMs?: number) => Promise<ReadyResponse>;
	readonly request: RequestFn;
}

let activeChild: ChildProcessWithoutNullStreams | undefined;

afterEach(() => {
	if (activeChild && activeChild.exitCode === null && activeChild.signalCode === null) {
		activeChild.kill('SIGKILL');
	}
	activeChild = undefined;
});

function spawnServiceHost(): ChildProcessWithoutNullStreams {
	const child = spawn(process.execPath, [MAIN_ENTRY, SERVICES_ROOT], {
		// Harmless under plain Node; required under the real extension host (PATCHES.md A2).
		env: { ...process.env, [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1' },
		stdio: ['pipe', 'pipe', 'pipe'],
		windowsHide: true,
	});
	activeChild = child;
	return child;
}

/** A tiny protocol client over the child's stdio: the unsolicited `ready` notification, plus a
 *  request/response helper that matches responses to requests by `id`. */
function createProtocolClient(child: ChildProcessWithoutNullStreams): ProtocolClient {
	const pending = new Map<string, (response: ServiceHostResponse) => void>();
	let resolveReady: ((response: ReadyResponse) => void) | undefined;
	const readyPromise = new Promise<ReadyResponse>((resolve) => {
		resolveReady = resolve;
	});

	createInterface({ input: child.stdout }).on('line', (line) => {
		const response = tryParseResponse(line);
		if (!response) {
			return;
		}
		if (response.type === 'ready') {
			resolveReady?.(response);
			return;
		}
		if ('id' in response && response.id) {
			pending.get(response.id)?.(response);
			pending.delete(response.id);
		}
	});

	let nextId = 0;
	const request: RequestFn = async (type, timeoutMs = 10000) => {
		const id = String(nextId++);
		const responsePromise = new Promise<ServiceHostResponse>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`timed out waiting for "${type}" response`)), timeoutMs);
			pending.set(id, (response) => {
				clearTimeout(timer);
				resolve(response);
			});
		});
		child.stdin.write(`${JSON.stringify({ id, type })}\n`);
		return responsePromise;
	};

	const waitForReady = (timeoutMs = 10000): Promise<ReadyResponse> =>
		Promise.race([
			readyPromise,
			new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('timed out waiting for "ready"')), timeoutMs)),
		]);

	return { waitForReady, request };
}

function tryParseResponse(line: string): ServiceHostResponse | undefined {
	try {
		return JSON.parse(line) as ServiceHostResponse;
	} catch {
		return undefined;
	}
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

describe('service-host process entry (main.ts)', () => {
	it(
		'emits ready, health round-trip reports dummy-service running, and shutdown terminates the whole tree',
		async () => {
			const child = spawnServiceHost();
			const { waitForReady, request } = createProtocolClient(child);

			const ready = await waitForReady();
			expect(ready.protocolVersion).toBe(SERVICE_HOST_PROTOCOL_VERSION);
			expect(ready.pid).toBe(child.pid);

			const health = await request('health');
			if (health.type !== 'health') {
				throw new Error(`expected a health response, got: ${JSON.stringify(health)}`);
			}
			expect(health.health.state).toBe('running');
			const dummyPid = health.health.services[0]?.pid;
			expect(dummyPid).toBeTypeOf('number');
			expect(isProcessAlive(dummyPid as number)).toBe(true);

			const exitPromise = new Promise<number | null>((resolve) => child.once('exit', resolve));
			const shutdownResponse = await request('shutdown');
			if (shutdownResponse.type !== 'shutdown') {
				throw new Error(`expected a shutdown response, got: ${JSON.stringify(shutdownResponse)}`);
			}
			expect(shutdownResponse.ok).toBe(true);
			const exitCode = await exitPromise;

			expect(exitCode).toBe(0);
			expect(isProcessAlive(dummyPid as number)).toBe(false);
		},
		20000,
	);
});
