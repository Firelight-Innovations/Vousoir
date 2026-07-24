/**
 * @vousoir/service-host — process entry point.
 *
 * This file, not the `serviceHostLauncher` library export, is the supported integration path
 * (PATCHES.md A1): `vousoir-core` spawns this as a child process rather than importing
 * `@vousoir/service-host` in-process — the extension may only import `@vousoir/typings` and
 * `@vousoir/shared` (work order §7.1), and a "supervisor process" (§6.2) is, per the work
 * order's own words, a process.
 *
 * Spawn convention (documented here because the boundary rule means `vousoir-core` cannot
 * import this package to discover its own entry path):
 *
 *   spawn(process.execPath, ['<repoRoot>/vousoir/services/service-host/src/main.ts', servicesRoot], {
 *     env: {
 *       ...process.env,
 *       [ELECTRON_RUN_AS_NODE_ENV_VAR]: '1',
 *       [PARENT_PID_ENV_VAR]: String(process.pid),
 *     },
 *     stdio: ['pipe', 'pipe', 'pipe'],
 *   })
 *
 * (constants from `@vousoir/typings`). `ELECTRON_RUN_AS_NODE` is required under the real
 * extension host (PATCHES.md A2: `execPath` there is Electron, not node) and harmless under
 * plain Node. `VOUSOIR_PARENT_PID` is optional but strongly recommended — without it this
 * process cannot detect an orphaning extension-host crash.
 *
 * Speaks `@vousoir/typings`'s `service-host-protocol.ts` on stdin/stdout — `health` and
 * `shutdown` requests in, `ready` (once, unsolicited) / `health` / `shutdown` / `error`
 * responses out. stdout carries protocol traffic ONLY; every human-readable log goes to
 * stderr (`logger.ts`).
 */

import { createInterface } from 'node:readline';
import {
	PARENT_PID_ENV_VAR,
	SERVICE_HOST_PROTOCOL_VERSION,
	serviceHostRequestSchema,
	type ServiceHostHandle,
	type ServiceHostResponse,
} from '@vousoir/typings';
import { serviceHostLauncher } from './service-host-launcher.ts';
import { watchParentProcess } from './parent-watchdog.ts';
import { logHost } from './logger.ts';

const DEFAULT_STARTUP_TIMEOUT_MS = 5000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 2000;

let handle: ServiceHostHandle | undefined;
let shuttingDown = false;

async function main(): Promise<void> {
	const servicesRoot = process.argv[2];
	if (!servicesRoot) {
		console.error('[vousoir:service-host] usage: node main.ts <servicesRoot>');
		process.exitCode = 1;
		return;
	}

	const parentPidRaw = process.env[PARENT_PID_ENV_VAR];
	if (parentPidRaw) {
		watchParentProcess(Number(parentPidRaw), () => void shutdown(0));
	}

	handle = await serviceHostLauncher.start({
		servicesRoot,
		startupTimeoutMs: readIntEnv('VOUSOIR_STARTUP_TIMEOUT_MS', DEFAULT_STARTUP_TIMEOUT_MS),
		heartbeatIntervalMs: readIntEnv('VOUSOIR_HEARTBEAT_INTERVAL_MS', DEFAULT_HEARTBEAT_INTERVAL_MS),
	});
	logHost(`ready; state=${handle.state}.`);
	writeResponse({ type: 'ready', protocolVersion: SERVICE_HOST_PROTOCOL_VERSION, pid: process.pid });

	createInterface({ input: process.stdin }).on('line', (line) => void handleLine(line));
	process.on('SIGINT', () => void shutdown(0));
	process.on('SIGTERM', () => void shutdown(0));
}

function readIntEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	const parsed = raw ? Number(raw) : NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function handleLine(line: string): Promise<void> {
	const activeHandle = handle;
	if (!activeHandle) {
		return;
	}

	const trimmed = line.trim();
	if (!trimmed) {
		return;
	}

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(trimmed);
	} catch {
		writeResponse({ type: 'error', message: `malformed JSON request: ${trimmed}` });
		return;
	}

	const result = serviceHostRequestSchema.safeParse(parsedJson);
	if (!result.success) {
		const id = extractId(parsedJson);
		writeResponse(id ? { type: 'error', id, message: result.error.message } : { type: 'error', message: result.error.message });
		return;
	}

	const request = result.data;
	if (request.type === 'health') {
		writeResponse({ type: 'health', id: request.id, health: await activeHandle.health() });
		return;
	}

	writeResponse({ type: 'shutdown', id: request.id, ok: true });
	await shutdown(0);
}

function extractId(value: unknown): string | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined;
	}
	const id = (value as Record<string, unknown>)['id'];
	return typeof id === 'string' ? id : undefined;
}

function writeResponse(response: ServiceHostResponse): void {
	process.stdout.write(`${JSON.stringify(response)}\n`);
}

async function shutdown(exitCode: number): Promise<void> {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	logHost('shutting down.');
	await handle?.dispose();
	process.exit(exitCode);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[vousoir:service-host] fatal: ${error instanceof Error ? (error.stack ?? message) : message}`);
	try {
		writeResponse({ type: 'error', message });
	} catch {
		// stdout may already be gone during a shutdown race; nothing more to do.
	}
	process.exit(1);
});
