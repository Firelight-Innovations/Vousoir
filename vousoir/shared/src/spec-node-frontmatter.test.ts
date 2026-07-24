/**
 * Validates the spec-node frontmatter zod schema against golden fixtures (work order
 * §9.11). Fixtures are the parsed frontmatter object graph (JSON), not raw markdown —
 * this work order defines shapes only; parsing `.md` frontmatter is a later work order's
 * concern, and adding a YAML dependency here is out of scope (see report for deviation).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { specNodeFrontmatterSchema } from '@vousoir/typings';
import { describe, expect, it } from 'vitest';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

async function readJsonArray(filename: string): Promise<unknown[]> {
	const raw = await readFile(join(FIXTURES_DIR, filename), 'utf8');
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed)) {
		throw new Error(`fixture ${filename} must contain a JSON array`);
	}
	return parsed;
}

describe('specNodeFrontmatterSchema', () => {
	it('validates every node in the golden fixture', async () => {
		const nodes = await readJsonArray('spec-node-frontmatter.valid.json');
		expect(nodes.length).toBeGreaterThan(0);
		for (const node of nodes) {
			expect(specNodeFrontmatterSchema.safeParse(node).success).toBe(true);
		}
	});

	it('rejects every malformed node in the negative fixture', async () => {
		const nodes = await readJsonArray('spec-node-frontmatter.invalid.json');
		expect(nodes.length).toBeGreaterThan(0);
		for (const node of nodes) {
			expect(specNodeFrontmatterSchema.safeParse(node).success).toBe(false);
		}
	});
});
