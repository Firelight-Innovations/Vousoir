/**
 * The rule under test is a single sentence: editing behaviour writes back to whichever
 * home the node already uses, and never moves the text.
 *
 * A panel that normalised on save would rewrite files the user never asked to restructure
 * — and because `resolveSpecNodeBehaviour` prefers the body, a migration would also
 * silently change which value wins. That is why this is pinned rather than trusted.
 */

import { describe, expect, it } from 'vitest';
import type { SpecNode, SpecNodeFrontmatter } from '@vousoir/typings';
import { editSpecNode, usesFrontmatterBehaviour } from './edit-spec-node.ts';
import { resolveSpecNodeBehaviour } from './resolve-spec-node.ts';

function node(frontmatter: Partial<SpecNodeFrontmatter>, body = ''): SpecNode {
	const full: SpecNodeFrontmatter = { id: 'n', title: 'N', parent: null, status: 'specified', ...frontmatter };
	return { id: full.id, filePath: '/repo/.vousoir/spec/n.md', frontmatter: full, body };
}

describe('editSpecNode preserves the behaviour home', () => {
	it('writes to the body when the node uses the body', () => {
		const edited = editSpecNode(node({}, 'Old prose.\n'), { behaviour: 'New prose.' });
		expect(edited.body).toBe('New prose.\n');
		expect(edited.frontmatter.behaviour).toBeUndefined();
	});

	it('writes to the frontmatter field when the node uses the frontmatter field', () => {
		const edited = editSpecNode(node({ behaviour: 'Old.' }), { behaviour: 'New.' });
		expect(edited.frontmatter.behaviour).toBe('New.');
		expect(edited.body).toBe('');
	});

	it('never migrates a frontmatter node into a body node', () => {
		const before = node({ behaviour: 'Lives in frontmatter.' });
		const after = editSpecNode(before, { behaviour: 'Still in frontmatter.' });
		expect(usesFrontmatterBehaviour(after)).toBe(true);
		expect(after.body).toBe(before.body);
	});

	it('treats a node with both as a body node, because the body already wins', () => {
		const both = node({ behaviour: 'loser' }, 'winner\n');
		expect(resolveSpecNodeBehaviour(both)).toBe('winner');
		const edited = editSpecNode(both, { behaviour: 'new winner' });
		expect(edited.body).toBe('new winner\n');
		// The deprecated field is left exactly as it was, not cleared.
		expect(edited.frontmatter.behaviour).toBe('loser');
	});

	it('puts brand-new behaviour in the body, the canonical home', () => {
		const edited = editSpecNode(node({}), { behaviour: 'First words.' });
		expect(edited.body).toBe('First words.\n');
		expect(edited.frontmatter.behaviour).toBeUndefined();
	});

	it('ends a body in exactly one newline, so a save does not churn whitespace', () => {
		expect(editSpecNode(node({}), { behaviour: 'x\n\n\n' }).body).toBe('x\n');
		expect(editSpecNode(node({}), { behaviour: 'x' }).body).toBe('x\n');
		expect(editSpecNode(node({}), { behaviour: '   ' }).body).toBe('');
	});
});

describe('editSpecNode applies only what it is given', () => {
	it('leaves untouched fields alone', () => {
		const before = node({ behaviour: 'b', contracts: [{ id: 'c', kind: 'moduleApi', name: 'n', body: 'x' }] });
		const after = editSpecNode(before, { title: 'Renamed' });
		expect(after.frontmatter.title).toBe('Renamed');
		expect(after.frontmatter.behaviour).toBe('b');
		expect(after.frontmatter.contracts).toEqual(before.frontmatter.contracts);
	});

	it('replaces contracts and test cases wholesale when given', () => {
		const after = editSpecNode(node({}), {
			contracts: [{ id: 'c2', kind: 'dbSchema', name: 'tbl', body: 'id TEXT' }],
			testCases: [{ id: 'tc', description: 'd', expected: 'e' }],
		});
		expect(after.frontmatter.contracts?.map((contract) => contract.id)).toEqual(['c2']);
		expect(after.frontmatter.testCases?.map((testCase) => testCase.id)).toEqual(['tc']);
	});

	it('does not mutate the node it was given', () => {
		const before = node({ behaviour: 'original' });
		editSpecNode(before, { behaviour: 'changed', title: 'changed' });
		expect(before.frontmatter.behaviour).toBe('original');
		expect(before.frontmatter.title).toBe('N');
	});

	it('keeps id, parent, status and file path out of scope', () => {
		const after = editSpecNode(node({ parent: 'p', status: 'built' }), { behaviour: 'x' });
		expect(after.id).toBe('n');
		expect(after.frontmatter.parent).toBe('p');
		expect(after.frontmatter.status).toBe('built');
		expect(after.filePath).toBe('/repo/.vousoir/spec/n.md');
	});
});
