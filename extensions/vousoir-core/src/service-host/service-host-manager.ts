/**
 * Owns the service host's lifecycle (work order section 6.1/section 6.2/section 9.8, `vousoir/PATCHES.md` A1): spawns
 * service-host's process entry, confirms it actually came up via a health check, and hands back a
 * handle whose `dispose()` terminates it.
 *
 * Never throws. A spawn or handshake failure is logged and the extension keeps activating in a
 * degraded state (section 6.1 point 5) rather than crashing the window.
 */
import * as path from 'node:path';
import type { OutputChannel } from 'vscode';
import type { ServiceHostHandle } from '@vousoir/typings';
import { resolveServiceHostEntryPath } from './resolve-service-host-entry.ts';
import { spawnServiceHostProcess } from './service-host-process.ts';

export async function startServiceHost(appRoot: string, log: OutputChannel): Promise<ServiceHostHandle | undefined> {
	const entryPath = resolveServiceHostEntryPath(appRoot);
	const servicesRoot = path.join(appRoot, 'vousoir', 'services');

	try {
		const handle = await spawnServiceHostProcess(entryPath, servicesRoot, log);
		const health = await handle.health();
		log.appendLine(`Service host started: state=${health.state}, services=${health.services.length}, pid=${health.pid ?? 'n/a'}.`);
		return handle;
	} catch (error) {
		log.appendLine(`Service host failed to start: ${error instanceof Error ? error.message : String(error)}`);
		return undefined;
	}
}
