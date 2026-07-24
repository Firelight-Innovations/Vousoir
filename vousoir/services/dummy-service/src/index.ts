/**
 * @vousoir/dummy-service — process entry point.
 *
 * Registered through `vousoir.service.json` as this service's `entryPoint`. `service-host`
 * spawns it directly with `node src/index.ts` — Node 24 strips TypeScript types natively, so no
 * build step or loader is needed (verified against this exact workspace-linked import during
 * development; see the service-host work-package report). Its only job is to prove the
 * spawn → monitor → dispose lifecycle end to end (work order §6.2): start, emit a stdio
 * heartbeat, watchdog its parent so a killed service-host never orphans it, and exit cleanly.
 *
 * Nothing imports this module as a library — services communicate via MCP/IPC only (§7.1) and
 * this package has no consumers yet — so it runs its main loop unconditionally at load time.
 * stdout is reserved for heartbeat lines only (that is what `service-host` parses); human logs
 * go to stderr, which `service-host` forwards verbatim.
 */

import { PARENT_PID_ENV_VAR } from '@vousoir/typings';
import { watchParentProcess } from './parent-watchdog.ts';

export const DUMMY_SERVICE_PACKAGE = 'vousoir-dummy-service' as const;

const HEARTBEAT_INTERVAL_MS = 1000;

function emitHeartbeat(): void {
	process.stdout.write(`${JSON.stringify({ vousoirHeartbeat: true, ts: new Date().toISOString() })}\n`);
}

function main(): void {
	const parentPidRaw = process.env[PARENT_PID_ENV_VAR];
	if (parentPidRaw) {
		watchParentProcess(Number(parentPidRaw));
	}

	console.error(`[${DUMMY_SERVICE_PACKAGE}] starting (pid ${process.pid}).`);
	emitHeartbeat();
	const heartbeatTimer = setInterval(emitHeartbeat, HEARTBEAT_INTERVAL_MS);

	const shutdown = (): void => {
		clearInterval(heartbeatTimer);
		console.error(`[${DUMMY_SERVICE_PACKAGE}] shutting down (pid ${process.pid}).`);
		process.exit(0);
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

main();
