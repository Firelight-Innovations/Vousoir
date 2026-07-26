/**
 * Spec completeness — a product definition, so tested as one.
 *
 * The assertions that matter most are the negative ones: that it ignores `status`, that a
 * whitespace-only field does not count, and that it says nothing about `built` or
 * `verified`. Those are the ways a completeness badge quietly starts lying.
 */

import { describe, expect, it } from 'vitest';
import type { SpecNode, SpecNodeFrontmatter, SpecNodeStatus } from '@vousoir/typings';
import { specCompleteness } from './spec-completeness.ts';

function node(frontmatter: Partial<SpecNodeFrontmatter>, body = ''): SpecNode {
	const full: SpecNodeFrontmatter = {
		id: 'n',
		title: 'N',
		parent: null,
		status: 'unspecified',
		...frontmatter,
	};
	return { id: full.id, filePath: '/repo/.vousoir/spec/n.md', frontmatter: full, body };
}

const CONTRACT = { id: 'c', kind: 'moduleApi' as const, name: 'run', body: 'run(): void' };
const TEST_CASE = { id: 'tc', description: 'does the thing', expected: 'the thing happens' };

describe('specCompleteness', () => {
	it('is specified only when behaviour, contracts and test cases are all present', () => {
		const full = node({ contracts: [CONTRACT], testCases: [TEST_CASE] }, 'It does one thing.\n');
		const result = specCompleteness(full);
		expect(result.isSpecified).toBe(true);
		expect(result.missing).toEqual([]);
		expect(result.ratio).toBe(1);
	});

	it('names exactly what is missing, in a stable order', () => {
		expect(specCompleteness(node({})).missing).toEqual(['behaviour', 'contracts', 'testCases']);
		expect(specCompleteness(node({}, 'prose')).satisfied).toEqual(['behaviour']);
		expect(specCompleteness(node({ contracts: [CONTRACT] }, 'prose')).missing).toEqual(['testCases']);
	});

	it('reports a ratio for a partial spec', () => {
		expect(specCompleteness(node({ contracts: [CONTRACT] }, 'prose')).ratio).toBeCloseTo(2 / 3);
	});
});

describe('what completeness deliberately ignores', () => {
	it('ignores the status field entirely — status is a claim, completeness is a fact', () => {
		for (const status of ['unspecified', 'specified', 'building', 'built', 'verified'] as SpecNodeStatus[]) {
			expect(specCompleteness(node({ status })).isSpecified).toBe(false);
		}
		const complete = node({ status: 'unspecified', contracts: [CONTRACT], testCases: [TEST_CASE] }, 'prose');
		expect(specCompleteness(complete).isSpecified).toBe(true);
	});

	it('does not count a whitespace-only field as specified', () => {
		expect(specCompleteness(node({}, '   \n\t ')).missing).toContain('behaviour');
		expect(specCompleteness(node({ behaviour: '  ' })).missing).toContain('behaviour');
		expect(specCompleteness(node({ contracts: [{ ...CONTRACT, body: '   ' }] })).missing).toContain('contracts');
		expect(specCompleteness(node({ contract: '  ' })).missing).toContain('contracts');
	});

	it('says nothing about built or verified — those depend on unanswered questions', () => {
		const result = specCompleteness(node({ status: 'verified' }, 'prose'));
		expect(Object.keys(result)).toEqual(['isSpecified', 'satisfied', 'missing', 'ratio']);
		expect(JSON.stringify(result)).not.toMatch(/built|verified/);
	});

	it('does not require given/when/then, which ADR-008 kept optional', () => {
		const bare = node({ contracts: [CONTRACT], testCases: [TEST_CASE] }, 'prose');
		expect(specCompleteness(bare).isSpecified).toBe(true);
	});
});

describe('which homes count', () => {
	it('counts behaviour from the markdown body', () => {
		expect(specCompleteness(node({}, 'In the body.')).satisfied).toContain('behaviour');
	});

	it('counts behaviour from the deprecated frontmatter field', () => {
		expect(specCompleteness(node({ behaviour: 'In frontmatter.' })).satisfied).toContain('behaviour');
	});

	it('counts the deprecated scalar contract — a pre-ADR-008 file is not less specified', () => {
		expect(specCompleteness(node({ contract: 'inputs, outputs, invariants' })).satisfied).toContain('contracts');
	});

	it('requires a contract of roots and parents too, since a missing boundary is the point', () => {
		const root = node({ id: 'root', parent: null, testCases: [TEST_CASE] }, 'A grouping module.');
		expect(specCompleteness(root).missing).toEqual(['contracts']);
	});

	it('does not count an empty contracts array as a declared boundary', () => {
		expect(specCompleteness(node({ contracts: [] }, 'prose')).missing).toContain('contracts');
	});
});
