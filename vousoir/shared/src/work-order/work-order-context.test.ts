/**
 * The property most likely to regress silently: a work order must carry its neighbours'
 * EDGES and none of their substance. Asserted as an explicit leak test against loud
 * markers in the fixture, not inferred from the golden file matching.
 *
 * Also covers the degenerate tree shapes, where the risk is empty headings and stray
 * whitespace rather than leaked content.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { SpecNode, SpecNodeFrontmatter, SpecTree } from '@vousoir/typings';
import { loadWorkOrderTree } from '../fixtures/work-order-tree-fixture.ts';
import { buildSpecTree } from '../spec-store/spec-tree.ts';
import { compileWorkOrder } from './compile-work-order.ts';

function specNode(frontmatter: SpecNodeFrontmatter, body = ''): SpecNode {
	return { id: frontmatter.id, filePath: `/repo/.vousoir/spec/${frontmatter.id}.md`, frontmatter, body };
}

function treeOf(...nodes: readonly SpecNode[]): SpecTree {
	return buildSpecTree(nodes);
}

describe('neighbour substance never crosses into a work order', () => {
	let markdown: string;

	beforeAll(async () => {
		markdown = compileWorkOrder(await loadWorkOrderTree(), 'api').markdown;
	});

	it('includes no neighbour behaviour, from the body or the frontmatter field', () => {
		expect(markdown).not.toContain('LEAKED-CHILD-FRONTMATTER-BEHAVIOUR');
		expect(markdown).not.toContain('LEAKED-CHILD-BODY');
		expect(markdown).not.toContain('LEAKED-SIBLING-FRONTMATTER-BEHAVIOUR');
		expect(markdown).not.toContain('LEAKED-SIBLING-BODY');
	});

	it('includes no neighbour test cases', () => {
		expect(markdown).not.toContain('LEAKED-CHILD-TESTCASE-DESCRIPTION');
		expect(markdown).not.toContain('LEAKED-CHILD-TESTCASE-EXPECTED');
		expect(markdown).not.toContain('LEAKED-SIBLING-TESTCASE-DESCRIPTION');
		expect(markdown).not.toContain('LEAKED-SIBLING-TESTCASE-EXPECTED');
		expect(markdown).not.toContain('tc-users');
		expect(markdown).not.toContain('tc-storage');
	});

	it('still carries every neighbour contract — the leak test is not passing by emitting nothing', () => {
		expect(markdown).toContain('GET /modules/{id}/users');
		expect(markdown).toContain('SpecStore.load');
		expect(markdown).toContain('The product owns nothing directly');
		expect(markdown).toContain('### Child — Users endpoint (`users`)');
		expect(markdown).toContain('### Sibling — Spec storage (`storage`)');
		expect(markdown).toContain('### Parent — Vousoir (`root`)');
	});

	it('reduces an ancestor to its first paragraph only', () => {
		expect(markdown).toContain('A spatial canvas on which an engineer diagrams an application as nested modules.');
		expect(markdown).not.toContain('ROOT-SECOND-PARAGRAPH');
	});
});

describe('degenerate tree shapes', () => {
	const lone = specNode({ id: 'solo', title: 'Solo', parent: null, status: 'unspecified' }, 'It does one thing.\n');

	it('emits no ancestor or neighbour headings for a node that has neither', () => {
		const { markdown } = compileWorkOrder(treeOf(lone), 'solo');
		expect(markdown).not.toContain('## Where this module sits');
		expect(markdown).not.toContain('## Neighbouring contracts');
	});

	it('leaves no stray whitespace behind the omitted sections', () => {
		const { markdown } = compileWorkOrder(treeOf(lone), 'solo');
		expect(markdown).not.toMatch(/\n\n\n/);
		expect(markdown.split('\n').filter((line) => /[ \t]+$/.test(line))).toEqual([]);
		// The last section is the node's own test cases, and it ends in exactly one newline.
		expect(markdown.endsWith('_This module declares no test cases._\n')).toBe(true);
	});

	it('says so explicitly rather than emitting an empty heading for its own empty sections', () => {
		const { markdown } = compileWorkOrder(treeOf(lone), 'solo');
		expect(markdown).toContain('_This module declares no contracts._');
		expect(markdown).toContain('_This module declares no test cases._');
	});

	it('notes a missing behaviour rather than leaving the section blank', () => {
		const bare = specNode({ id: 'bare', title: 'Bare', parent: null, status: 'unspecified' });
		expect(compileWorkOrder(treeOf(bare), 'bare').markdown).toContain('_No behaviour has been written');
	});

	it('omits a neighbour that declares no contracts at all', () => {
		const parent = specNode({ id: 'p', title: 'Parent', parent: null, status: 'specified' });
		const child = specNode({ id: 'c', title: 'Child', parent: 'p', status: 'specified' }, 'Child prose.\n');
		const { markdown } = compileWorkOrder(treeOf(parent, child), 'c');
		// The parent contributes no contracts, so the whole section goes rather than
		// rendering a named-but-empty neighbour. Its title must not appear either.
		expect(markdown).not.toContain('## Neighbouring contracts');
		expect(markdown).not.toContain('### Parent —');
		// The node's own behaviour is of course still there — this is its work order.
		expect(markdown).toContain('Child prose.');
		expect(markdown).toContain('## Where this module sits');
	});

	it('treats co-roots as siblings', () => {
		const first = specNode({ id: 'a', title: 'A', parent: null, status: 'specified' });
		const second = specNode({
			id: 'b',
			title: 'B',
			parent: null,
			status: 'specified',
			contracts: [{ id: 'c-b', kind: 'moduleApi', name: 'B.run', body: 'run(): void' }],
		});
		expect(compileWorkOrder(treeOf(first, second), 'a').markdown).toContain('### Sibling — B (`b`)');
	});
});

describe('field precedence inside a work order', () => {
	it('honours contracts[] over the deprecated scalar, for the node and its neighbours', () => {
		const parent = specNode({
			id: 'p',
			title: 'Parent',
			parent: null,
			status: 'specified',
			contract: 'SCALAR-SHOULD-LOSE',
			contracts: [{ id: 'c-p', kind: 'serviceApi', name: 'P.serve', body: 'TYPED-SHOULD-WIN' }],
		});
		const child = specNode({
			id: 'c',
			title: 'Child',
			parent: 'p',
			status: 'specified',
			contract: 'CHILD-SCALAR-SHOULD-LOSE',
			contracts: [{ id: 'c-c', kind: 'moduleApi', name: 'C.call', body: 'CHILD-TYPED-SHOULD-WIN' }],
		});
		const { markdown } = compileWorkOrder(treeOf(parent, child), 'c');
		expect(markdown).toContain('CHILD-TYPED-SHOULD-WIN');
		expect(markdown).not.toContain('CHILD-SCALAR-SHOULD-LOSE');
		expect(markdown).toContain('TYPED-SHOULD-WIN');
		expect(markdown).not.toContain('SCALAR-SHOULD-LOSE');
	});

	it('renders the deprecated scalar as untyped rather than inventing a kind', () => {
		const solo = specNode({
			id: 'solo',
			title: 'Solo',
			parent: null,
			status: 'specified',
			contract: 'inputs, outputs, invariants',
		});
		const { markdown } = compileWorkOrder(treeOf(solo), 'solo');
		expect(markdown).toContain('_Declared with the deprecated free-form `contract` field, so it carries no kind._');
		expect(markdown).toContain('inputs, outputs, invariants');
		expect(markdown).not.toMatch(/moduleApi|serviceApi|dbSchema/);
	});

	it('prefers the markdown body for behaviour, and falls back to the frontmatter field', () => {
		const fromBody = specNode(
			{ id: 'b', title: 'B', parent: null, status: 'specified', behaviour: 'FRONTMATTER-FALLBACK' },
			'BODY-WINS\n',
		);
		expect(compileWorkOrder(treeOf(fromBody), 'b').markdown).toContain('BODY-WINS');
		expect(compileWorkOrder(treeOf(fromBody), 'b').markdown).not.toContain('FRONTMATTER-FALLBACK');

		const fromField = specNode({ id: 'f', title: 'F', parent: null, status: 'specified', behaviour: 'FIELD-USED' });
		expect(compileWorkOrder(treeOf(fromField), 'f').markdown).toContain('FIELD-USED');
	});
});
