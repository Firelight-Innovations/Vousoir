/**
 * Service manifest discovery.
 *
 * Scans `servicesRoot` for immediate subdirectories declaring a `vousoir.service.json`
 * manifest (work order §6.2). A directory without the file is not a service package and is
 * silently skipped — this is how `service-host`'s own package directory, which sits in the
 * same `vousoir/services/` tree as the services it supervises, is naturally excluded without
 * special-casing.
 *
 * A directory WITH the file but a manifest that fails `serviceManifestSchema` validation is a
 * hard error: the work order requires invalid manifests to be rejected with a clear message,
 * not silently skipped.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serviceManifestSchema, type ServiceManifest } from '@vousoir/typings';

/** Every service package declares its manifest under this filename, at its package root. */
export const MANIFEST_FILENAME = 'vousoir.service.json';

/** A service manifest plus the absolute path to the package directory that declared it. */
export interface DiscoveredService {
	readonly manifest: ServiceManifest;
	readonly packageDir: string;
}

export async function discoverServiceManifests(servicesRoot: string): Promise<DiscoveredService[]> {
	const entries = await readdir(servicesRoot, { withFileTypes: true });
	const discovered: DiscoveredService[] = [];
	const seenNames = new Map<string, string>();

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const packageDir = join(servicesRoot, entry.name);
		const manifest = await readManifestIfPresent(join(packageDir, MANIFEST_FILENAME), packageDir);
		if (!manifest) {
			continue;
		}

		const existingOwner = seenNames.get(manifest.name);
		if (existingOwner) {
			throw new Error(`Duplicate service name "${manifest.name}": declared by both "${existingOwner}" and "${packageDir}".`);
		}
		seenNames.set(manifest.name, packageDir);
		discovered.push({ manifest, packageDir });
	}

	return discovered;
}

async function readManifestIfPresent(manifestPath: string, packageDir: string): Promise<ServiceManifest | undefined> {
	let raw: string;
	try {
		raw = await readFile(manifestPath, 'utf8');
	} catch (error) {
		if (isNotFoundError(error)) {
			return undefined;
		}
		throw new Error(`Failed to read ${manifestPath}: ${(error as Error).message}`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new Error(`Invalid service manifest at ${manifestPath}: not valid JSON (${(error as Error).message}).`);
	}

	const result = serviceManifestSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(`Invalid service manifest at ${manifestPath} (package "${packageDir}"): ${result.error.message}`);
	}
	return result.data;
}

function isNotFoundError(error: unknown): boolean {
	return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}
