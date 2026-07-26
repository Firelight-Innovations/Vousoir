/**
 * Slugs decide filenames, so a collision silently overwrites one node's work order with
 * another's. That is the failure worth testing hardest.
 */

import { describe, expect, it } from 'vitest';
import { workOrderSlug } from './work-order-slug.ts';

describe('workOrderSlug', () => {
	it('leaves a well-formed kebab id alone', () => {
		expect(workOrderSlug('api')).toBe('api');
		expect(workOrderSlug('spec-store-watcher')).toBe('spec-store-watcher');
	});

	it('is deterministic', () => {
		expect(workOrderSlug('HTTP API')).toBe(workOrderSlug('HTTP API'));
	});

	it('keeps two same-titled nodes apart, because it derives from the id', () => {
		expect(workOrderSlug('billing-api')).not.toBe(workOrderSlug('reporting-api'));
	});

	it('keeps ids apart that would otherwise sanitise to the same stem', () => {
		const variants = ['Foo Bar', 'foo bar', 'FOO_BAR', 'foo/bar', 'foo.bar'];
		const slugs = variants.map(workOrderSlug);
		expect(new Set(slugs).size).toBe(variants.length);
		for (const slug of slugs) {
			expect(slug).toMatch(/^foo-bar-[0-9a-f]{8}$/);
		}
	});

	it('never emits a path separator, so a slug cannot escape its directory', () => {
		for (const id of ['../../etc/passwd', 'a/b/c', 'C:\\evil']) {
			expect(workOrderSlug(id)).not.toMatch(/[/\\]/);
			expect(workOrderSlug(id)).not.toContain('..');
		}
	});

	it('still produces a filename for an id with nothing sluggable in it', () => {
		expect(workOrderSlug('…')).toMatch(/^node-[0-9a-f]{8}$/);
		expect(workOrderSlug('…')).not.toBe(workOrderSlug('———'));
	});
});
