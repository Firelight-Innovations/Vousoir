/**
 * `serviceHostLauncher` — the concrete `ServiceHostLauncher` implementation `vousoir-core`
 * calls on activation (work order §6.1/§6.2). Discovers manifests under `servicesRoot`, spawns
 * one `ServiceSupervisor` per manifest, waits up to `startupTimeoutMs` for every service to
 * report its first heartbeat, then returns a `ServiceHost` handle reflecting whatever state
 * results.
 *
 * A service that never reports in becomes `failed` inside the returned handle's health, not a
 * rejected `start()` promise — `ServiceHostState` already has `unhealthy`/service-level `failed`
 * for exactly this case. `start()` only rejects for a problem that prevents constructing a host
 * at all: an invalid manifest (work order §6.2: "reject invalid manifests with a clear error").
 */

import type { ServiceHostHandle, ServiceHostLauncher, ServiceHostStartOptions } from '@vousoir/typings';
import { discoverServiceManifests } from './manifest-discovery.ts';
import { ServiceHost } from './service-host-handle.ts';
import { ServiceSupervisor } from './service-supervisor.ts';
import { logHost } from './logger.ts';

const DEFAULT_STARTUP_TIMEOUT_MS = 5000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 2000;
const STARTUP_POLL_INTERVAL_MS = 25;

async function start(options: ServiceHostStartOptions): Promise<ServiceHostHandle> {
	const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
	const heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

	const discovered = await discoverServiceManifests(options.servicesRoot);
	logHost(`discovered ${discovered.length} service(s) under ${options.servicesRoot}.`);

	const supervisors = discovered.map(
		({ manifest, packageDir }) => new ServiceSupervisor({ manifest, packageDir, staleAfterMs: heartbeatIntervalMs * 3 }),
	);

	await waitForStartup(supervisors, startupTimeoutMs);

	return new ServiceHost(supervisors, heartbeatIntervalMs);
}

async function waitForStartup(supervisors: readonly ServiceSupervisor[], timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (supervisors.every((supervisor) => supervisor.getHealth().state !== 'starting')) {
			return;
		}
		await sleep(STARTUP_POLL_INTERVAL_MS);
	}
	for (const supervisor of supervisors) {
		supervisor.markStartupTimedOutIfStillStarting();
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const serviceHostLauncher: ServiceHostLauncher = { start };
