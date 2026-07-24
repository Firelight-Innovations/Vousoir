/**
 * End-to-end lifecycle test against the REAL `@vousoir/dummy-service` package (work order §9.8
 * acceptance test: "service-host spawns, dummy service registers, health check passes; on app
 * exit both terminate cleanly (no orphan processes)"). `servicesRoot` here is the actual
 * `vousoir/services/` directory, so this also exercises the "skip a directory with no manifest"
 * path against the real `service-host` package sitting next to `dummy-service`.
 *
 * Every test disposes its host in a `finally`, and `afterEach` disposes anything left over as a
 * last resort, so a failed assertion can never leak a spawned process.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceHostHandle } from '@vousoir/typings';
import { serviceHostLauncher } from './service-host-launcher.ts';

const SERVICES_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Real dummy-service heartbeats every 1000ms; keep the stale threshold comfortably above that
// while still failing fast if liveness monitoring breaks.
const TEST_HEARTBEAT_INTERVAL_MS = 1000;
const TEST_STARTUP_TIMEOUT_MS = 8000;

const liveHandles = new Set<ServiceHostHandle>();

afterEach(async () => {
	await Promise.all([...liveHandles].map((handle) => handle.dispose()));
	liveHandles.clear();
});

async function startAgainstRealServices(): Promise<ServiceHostHandle> {
	const handle = await serviceHostLauncher.start({
		servicesRoot: SERVICES_ROOT,
		heartbeatIntervalMs: TEST_HEARTBEAT_INTERVAL_MS,
		startupTimeoutMs: TEST_STARTUP_TIMEOUT_MS,
	});
	liveHandles.add(handle);
	return handle;
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

describe('serviceHostLauncher against the real dummy-service', () => {
	it(
		'spawns dummy-service, reports it running, and disposes it cleanly with no orphan process',
		async () => {
			const handle = await startAgainstRealServices();

			const health = await handle.health();
			expect(handle.state).toBe('running');
			expect(health.state).toBe('running');
			expect(health.services).toHaveLength(1);
			const dummy = health.services[0];
			expect(dummy?.name).toBe('dummy-service');
			expect(dummy?.state).toBe('running');
			expect(dummy?.pid).toBeTypeOf('number');

			const pid = dummy?.pid as number;
			expect(isProcessAlive(pid)).toBe(true);

			await handle.dispose();
			liveHandles.delete(handle);

			expect(handle.state).toBe('disposed');
			expect(isProcessAlive(pid)).toBe(false);
		},
		15000,
	);

	it(
		'dispose is idempotent — a second call is a harmless no-op',
		async () => {
			const handle = await startAgainstRealServices();
			const pid = (await handle.health()).services[0]?.pid as number;

			await handle.dispose();
			liveHandles.delete(handle);
			await handle.dispose();

			expect(handle.state).toBe('disposed');
			expect(isProcessAlive(pid)).toBe(false);
		},
		15000,
	);
});

describe('serviceHostLauncher manifest validation', () => {
	it(
		'rejects start() with a clear error when a manifest is invalid, spawning nothing',
		async () => {
			const root = await mkdtemp(join(tmpdir(), 'vousoir-service-host-invalid-'));
			try {
				await mkdir(join(root, 'broken'), { recursive: true });
				await writeFile(
					join(root, 'broken', 'vousoir.service.json'),
					JSON.stringify({ manifestVersion: 1, name: 'Not Kebab', entryPoint: 'src/index.ts' }),
					'utf8',
				);

				await expect(serviceHostLauncher.start({ servicesRoot: root })).rejects.toThrow(/Invalid service manifest/);
			} finally {
				await rm(root, { recursive: true, force: true });
			}
		},
		10000,
	);
});
