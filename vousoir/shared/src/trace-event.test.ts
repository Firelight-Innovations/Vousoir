/**
 * Validates the trace-event zod schema against golden JSONL fixtures (work order §9.11):
 * one positive fixture covering every event kind, one negative fixture where every
 * line must fail validation.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { traceEventSchema } from '@vousoir/typings';
import { describe, expect, it } from 'vitest';

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

async function readJsonlRecords(filename: string): Promise<unknown[]> {
	const raw = await readFile(join(FIXTURES_DIR, filename), 'utf8');
	return raw
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line));
}

describe('traceEventSchema', () => {
	it('validates every event kind in the golden fixture', async () => {
		const records = await readJsonlRecords('trace-event.valid.jsonl');
		expect(records.length).toBeGreaterThan(0);
		for (const record of records) {
			expect(traceEventSchema.safeParse(record).success).toBe(true);
		}
	});

	it('rejects every malformed record in the negative fixture', async () => {
		const records = await readJsonlRecords('trace-event.invalid.jsonl');
		expect(records.length).toBeGreaterThan(0);
		for (const record of records) {
			expect(traceEventSchema.safeParse(record).success).toBe(false);
		}
	});
});
