/**
 * The ADR-008 precedence rules. These exist so no consumer invents its own answer to
 * "which contract field do I read?" — the failure mode PATCHES.md A3 already recorded
 * once, and one that no enforcement wall catches.
 */

import type { SpecNode, SpecNodeFrontmatter } from '@vousoir/typings';
import { describe, expect, it } from 'vitest';
import { resolveSpecNodeBehaviour, resolveSpecNodeContracts } from './resolve-spec-node.ts';

const BASE: SpecNodeFrontmatter = { id: 'alpha', title: 'Alpha', parent: null, status: 'specified' };

function nodeWith(frontmatter: SpecNodeFrontmatter, body: string): SpecNode {
	return { id: frontmatter.id, filePath: '/repo/.v6r/spec/alpha.md', frontmatter, body };
}

describe('resolveSpecNodeContracts', () => {
	it('falls back to the deprecated scalar when there are no typed contracts', () => {
		expect(resolveSpecNodeContracts({ ...BASE, contract: 'inputs, outputs, invariants' })).toEqual({
			typed: [],
			legacy: 'inputs, outputs, invariants',
		});
	});

	it('prefers typed contracts and does not surface the scalar alongside them', () => {
		const resolved = resolveSpecNodeContracts({
			...BASE,
			contract: 'stale',
			contracts: [{ id: 'c-1', kind: 'moduleApi', name: 'load', body: 'load(): Promise<SpecTree>' }],
		});
		expect(resolved.typed.map((contract) => contract.name)).toEqual(['load']);
		expect(resolved.legacy).toBeUndefined();
	});

	it('treats an explicitly empty contracts list as present, not absent', () => {
		expect(resolveSpecNodeContracts({ ...BASE, contract: 'stale', contracts: [] })).toEqual({
			typed: [],
			legacy: undefined,
		});
	});

	it('never invents a kind for the untyped scalar', () => {
		const { typed, legacy } = resolveSpecNodeContracts({ ...BASE, contract: 'some prose' });
		expect(typed).toEqual([]);
		expect(legacy).toBe('some prose');
	});
});

describe('resolveSpecNodeBehaviour', () => {
	it('prefers the markdown body', () => {
		expect(resolveSpecNodeBehaviour(nodeWith({ ...BASE, behaviour: 'in frontmatter' }, '\nin the body\n'))).toBe(
			'in the body',
		);
	});

	it('falls back to the frontmatter field when the body is blank', () => {
		expect(resolveSpecNodeBehaviour(nodeWith({ ...BASE, behaviour: 'in frontmatter' }, '\n \n'))).toBe('in frontmatter');
	});

	it('is undefined when the node has neither', () => {
		expect(resolveSpecNodeBehaviour(nodeWith(BASE, ''))).toBeUndefined();
	});
});
