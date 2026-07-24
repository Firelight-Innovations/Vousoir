import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoverServiceManifests, MANIFEST_FILENAME } from './manifest-discovery.ts';

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'vousoir-manifest-discovery-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

async function makeServiceDir(name: string, manifestContents: string | undefined): Promise<void> {
	const dir = join(root, name);
	await mkdir(dir, { recursive: true });
	if (manifestContents !== undefined) {
		await writeFile(join(dir, MANIFEST_FILENAME), manifestContents, 'utf8');
	}
}

describe('discoverServiceManifests', () => {
	it('finds a valid manifest and returns its package dir', async () => {
		await makeServiceDir(
			'alpha',
			JSON.stringify({ manifestVersion: 1, name: 'alpha', entryPoint: 'src/index.ts' }),
		);

		const discovered = await discoverServiceManifests(root);

		expect(discovered).toHaveLength(1);
		expect(discovered[0]?.manifest.name).toBe('alpha');
		expect(discovered[0]?.packageDir).toBe(join(root, 'alpha'));
	});

	it('skips a directory with no manifest file, such as service-host itself', async () => {
		await makeServiceDir('service-host', undefined);
		await makeServiceDir(
			'alpha',
			JSON.stringify({ manifestVersion: 1, name: 'alpha', entryPoint: 'src/index.ts' }),
		);

		const discovered = await discoverServiceManifests(root);

		expect(discovered.map((d) => d.manifest.name)).toEqual(['alpha']);
	});

	it('rejects malformed JSON with a clear error identifying the file', async () => {
		await makeServiceDir('broken', '{ not valid json');

		await expect(discoverServiceManifests(root)).rejects.toThrow(/Invalid service manifest.*broken.*not valid JSON/s);
	});

	it('rejects a manifest that fails schema validation', async () => {
		// "Not Kebab Case" violates serviceManifestSchema's name pattern.
		await makeServiceDir('broken', JSON.stringify({ manifestVersion: 1, name: 'Not Kebab Case', entryPoint: 'src/index.ts' }));

		await expect(discoverServiceManifests(root)).rejects.toThrow(/Invalid service manifest/);
	});

	it('rejects two services declaring the same name', async () => {
		await makeServiceDir('alpha', JSON.stringify({ manifestVersion: 1, name: 'dup', entryPoint: 'src/index.ts' }));
		await makeServiceDir('beta', JSON.stringify({ manifestVersion: 1, name: 'dup', entryPoint: 'src/index.ts' }));

		await expect(discoverServiceManifests(root)).rejects.toThrow(/Duplicate service name "dup"/);
	});

	it('returns an empty list for an empty services root', async () => {
		expect(await discoverServiceManifests(root)).toEqual([]);
	});
});
