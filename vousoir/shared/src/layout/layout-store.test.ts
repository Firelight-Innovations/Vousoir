/**
 * `.vousoir/layout.json`.
 *
 * The behaviours that matter are where it lives (not `cache/`, so a cache clear cannot
 * destroy user work) and that no failure mode stops the canvas opening.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { V6R_LAYOUT_VERSION, V6R_ROOT_DIRNAME, V6R_SUBDIRS } from '@vousoir/typings';
import { clearedLayout, emptyLayout, layoutFilePath, loadLayout, saveLayout, withPosition } from './layout-store.ts';

let repoRoot: string;

beforeEach(async () => {
	repoRoot = await mkdtemp(join(tmpdir(), 'v6r-layout-'));
});

afterEach(async () => {
	await rm(repoRoot, { recursive: true, force: true });
});

describe('layoutFilePath', () => {
	it('sits at the root of .vousoir/, not inside the wipeable cache', () => {
		expect(layoutFilePath(repoRoot)).toBe(join(repoRoot, V6R_ROOT_DIRNAME, 'layout.json'));
		expect(layoutFilePath(repoRoot)).not.toContain(join(V6R_ROOT_DIRNAME, V6R_SUBDIRS.cache));
	});
});

describe('loadLayout', () => {
	it('treats a project that has never been arranged as empty', async () => {
		expect(await loadLayout(repoRoot)).toEqual(emptyLayout());
	});

	it('round-trips saved placements', async () => {
		const layout = withPosition(emptyLayout(), 'api', { x: 120, y: 40 });
		await saveLayout(repoRoot, layout);
		expect(await loadLayout(repoRoot)).toEqual(layout);
	});

	it('falls back to empty rather than refusing to open on invalid JSON', async () => {
		await mkdir(join(repoRoot, V6R_ROOT_DIRNAME), { recursive: true });
		await writeFile(layoutFilePath(repoRoot), '{ not json', 'utf8');
		expect(await loadLayout(repoRoot)).toEqual(emptyLayout());
	});

	it('falls back to empty on a version it does not understand', async () => {
		await mkdir(join(repoRoot, V6R_ROOT_DIRNAME), { recursive: true });
		await writeFile(layoutFilePath(repoRoot), JSON.stringify({ version: 999, positions: {} }), 'utf8');
		expect(await loadLayout(repoRoot)).toEqual(emptyLayout());
	});

	it('falls back to empty when a position is not a number', async () => {
		await mkdir(join(repoRoot, V6R_ROOT_DIRNAME), { recursive: true });
		const bad = { version: V6R_LAYOUT_VERSION, positions: { api: { x: 'left', y: 0 } } };
		await writeFile(layoutFilePath(repoRoot), JSON.stringify(bad), 'utf8');
		expect(await loadLayout(repoRoot)).toEqual(emptyLayout());
	});
});

describe('saveLayout', () => {
	it('creates .vousoir/ when the project has never been scaffolded', async () => {
		const filePath = await saveLayout(repoRoot, emptyLayout());
		expect(filePath).toBe(layoutFilePath(repoRoot));
		expect(await readFile(filePath, 'utf8')).toContain('"version": 1');
	});

	it('writes indented JSON with a trailing newline, since it is committed by default', async () => {
		await saveLayout(repoRoot, withPosition(emptyLayout(), 'api', { x: 1, y: 2 }));
		const raw = await readFile(layoutFilePath(repoRoot), 'utf8');
		expect(raw.endsWith('\n')).toBe(true);
		expect(raw).toContain('\n  "positions"');
	});
});

describe('withPosition and clearedLayout', () => {
	it('adds a placement without disturbing the others', () => {
		const one = withPosition(emptyLayout(), 'api', { x: 1, y: 2 });
		const two = withPosition(one, 'storage', { x: 3, y: 4 });
		expect(two.positions).toEqual({ api: { x: 1, y: 2 }, storage: { x: 3, y: 4 } });
		// The original is untouched: callers hold onto layouts across messages.
		expect(one.positions).toEqual({ api: { x: 1, y: 2 } });
	});

	it('clears every placement, which is what auto-tidy persists', () => {
		expect(clearedLayout().positions).toEqual({});
	});
});
