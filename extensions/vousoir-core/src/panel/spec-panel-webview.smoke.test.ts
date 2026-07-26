/**
 * Smoke test for the real spec panel webview script.
 *
 * Loads `media/spec-panel.js` off disk into HTML from the real `specPanelHtml` builder, so
 * the three sections, the save round trip and the external-change warning are exercised
 * against the shipped source rather than a description of it.
 *
 * See `webview-harness.ts` for what this deliberately does not prove.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { specPanelHtml } from './spec-panel-html.ts';
import { fakeUri, fakeWebview, mountWebview, type MountedWebview, type PostedMessage } from '../webview-harness.ts';

const NODE = {
	id: 'task-api',
	title: 'Task API',
	status: 'specified',
	behaviour: 'Serves the task list over HTTP.',
	behaviourInFrontmatter: false,
	contracts: [{ id: 'c-1', kind: 'serviceApi', name: 'GET /tasks', body: '200 with a JSON array' }],
	testCases: [{ id: 'tc-1', description: 'lists tasks', expected: 'an array comes back' }],
	filePath: '/repo/.vousoir/spec/task-api.md',
	missing: [],
	isSpecified: true,
};

function byId(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`no element "${id}"`);
	}
	return element as HTMLElement;
}

function inputsIn(hostId: string): HTMLInputElement[] {
	return [...byId(hostId).querySelectorAll('input, textarea, select')] as HTMLInputElement[];
}

/** Indexed access under `noUncheckedIndexedAccess`; a missing field is a broken test. */
function at(list: readonly HTMLInputElement[], index: number): HTMLInputElement {
	const element = list[index];
	if (element === undefined) {
		throw new Error(`no form field at index ${index}`);
	}
	return element;
}

function type(element: HTMLInputElement, value: string): void {
	element.value = value;
	element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

let panel: MountedWebview;

beforeEach(() => {
	panel = mountWebview(specPanelHtml(fakeWebview() as never, fakeUri('/media') as never), 'spec-panel.js');
});

describe('the panel renders a module', () => {
	it('signals ready on load and shows the empty state until told otherwise', () => {
		expect(panel.lastPosted('ready')).toBeDefined();
		expect(byId('v6r-empty').hidden).toBe(false);
	});

	it('fills all three sections', () => {
		panel.send({ type: 'showNode', node: NODE });
		expect((byId('v6r-title') as HTMLInputElement).value).toBe('Task API');
		expect((byId('v6r-behaviour') as HTMLInputElement).value).toBe('Serves the task list over HTTP.');
		expect(byId('v6r-contracts').children).toHaveLength(1);
		expect(byId('v6r-tests').children).toHaveLength(1);
	});

	it('offers exactly the three ADR-008 contract kinds, and selects the current one', () => {
		panel.send({ type: 'showNode', node: NODE });
		const select = byId('v6r-contracts').querySelector('select') as HTMLSelectElement;
		expect([...select.options].map((option) => option.value)).toEqual(['moduleApi', 'serviceApi', 'dbSchema']);
		expect(select.value).toBe('serviceApi');
	});

	it('badges a complete node as specified', () => {
		panel.send({ type: 'showNode', node: NODE });
		expect(byId('v6r-badge').textContent).toBe('specified');
	});

	it('badges an incomplete node with what is missing, not just "incomplete"', () => {
		panel.send({ type: 'showNode', node: { ...NODE, isSpecified: false, missing: ['contracts', 'testCases'] } });
		expect(byId('v6r-badge').textContent).toContain('contracts');
		expect(byId('v6r-badge').textContent).toContain('testCases');
	});

	it('warns when behaviour lives in the deprecated frontmatter field, and says it will not move', () => {
		panel.send({ type: 'showNode', node: { ...NODE, behaviourInFrontmatter: true } });
		const home = byId('v6r-behaviour-home');
		expect(home.hidden).toBe(false);
		expect(home.textContent).toContain('not moved');
	});

	it('hides that warning for a body-node', () => {
		panel.send({ type: 'showNode', node: NODE });
		expect(byId('v6r-behaviour-home').hidden).toBe(true);
	});

	it('returns to the empty state when the selection is cleared', () => {
		panel.send({ type: 'showNode', node: NODE });
		panel.send({ type: 'showEmpty', message: 'Select a module on the canvas.' });
		expect(byId('v6r-panel').hidden).toBe(true);
		expect(byId('v6r-empty').textContent).toContain('Select a module');
	});
});

describe('the panel saves', () => {
	beforeEach(() => {
		panel.send({ type: 'showNode', node: NODE });
	});

	it('does not save while the user types — only on an explicit Save', () => {
		type(byId('v6r-behaviour') as HTMLInputElement, 'Rewritten.');
		expect(panel.lastPosted('save')).toBeUndefined();
		expect(panel.lastPosted('dirty')).toMatchObject({ dirty: true });
	});

	it('sends the whole spec on Save', () => {
		type(byId('v6r-behaviour') as HTMLInputElement, 'Rewritten.');
		byId('v6r-save').click();

		const saved = panel.lastPosted('save');
		expect(saved).toMatchObject({ id: 'task-api', title: 'Task API', behaviour: 'Rewritten.' });
		expect((saved?.['contracts'] as PostedMessage[])[0]).toMatchObject({ kind: 'serviceApi', name: 'GET /tasks' });
		expect((saved?.['testCases'] as PostedMessage[])[0]).toMatchObject({ description: 'lists tasks' });
	});

	it('adds and removes a contract, and the change reaches the save payload', () => {
		byId('v6r-add-contract').click();
		expect(byId('v6r-contracts').children).toHaveLength(2);

		const added = inputsIn('v6r-contracts').slice(3);
		type(at(added, 0), 'dbSchema');
		type(at(added, 1), 'tasks');
		type(at(added, 2), 'id TEXT PRIMARY KEY');
		byId('v6r-save').click();

		const contracts = panel.lastPosted('save')?.['contracts'] as PostedMessage[];
		expect(contracts).toHaveLength(2);
		expect(contracts[1]).toMatchObject({ kind: 'dbSchema', name: 'tasks', body: 'id TEXT PRIMARY KEY' });
	});

	it('omits blank optional test-case fields rather than writing empty strings', () => {
		byId('v6r-save').click();
		const testCase = (panel.lastPosted('save')?.['testCases'] as PostedMessage[])[0];
		expect(testCase).toBeDefined();
		expect(Object.keys(testCase ?? {})).toEqual(['id', 'description', 'expected']);
	});

	it('keeps an optional field that was filled in', () => {
		byId('v6r-add-test').click();
		const fields = inputsIn('v6r-tests').slice(6);
		type(at(fields, 0), 'a case');
		type(at(fields, 1), 'it passes');
		type(at(fields, 2), 'a seeded store');
		byId('v6r-save').click();

		const cases = panel.lastPosted('save')?.['testCases'] as PostedMessage[];
		expect(cases[1]).toMatchObject({ description: 'a case', expected: 'it passes', given: 'a seeded store' });
	});

	it('refuses to save a test case missing its required fields, with a pointed message', () => {
		byId('v6r-add-test').click();
		byId('v6r-save').click();
		expect(panel.lastPosted('save')).toBeUndefined();
		expect(byId('v6r-notice').textContent).toContain('description and an expected');
	});

	it('refuses to save a nameless contract', () => {
		byId('v6r-add-contract').click();
		byId('v6r-save').click();
		expect(panel.lastPosted('save')).toBeUndefined();
		expect(byId('v6r-notice').textContent).toContain('needs a name');
	});

	it('clears the dirty flag once the extension confirms the save', () => {
		type(byId('v6r-behaviour') as HTMLInputElement, 'Rewritten.');
		panel.send({ type: 'saved', message: 'Saved.' });
		expect(byId('v6r-dirty').hidden).toBe(true);
		expect(panel.lastPosted('dirty')).toMatchObject({ dirty: false });
	});

	it('asks to open the underlying markdown file', () => {
		byId('v6r-open').click();
		expect(panel.lastPosted('openFile')).toMatchObject({ id: 'task-api' });
	});
});

describe('an external change while editing', () => {
	it('warns and does NOT discard what the user typed', () => {
		panel.send({ type: 'showNode', node: NODE });
		type(byId('v6r-behaviour') as HTMLInputElement, 'Half-typed words.');

		panel.send({ type: 'externalChange', message: 'This module changed on disk while you were editing.' });

		expect(byId('v6r-notice').textContent).toContain('changed on disk');
		// The whole point of the rule: the irreplaceable side survives.
		expect((byId('v6r-behaviour') as HTMLInputElement).value).toBe('Half-typed words.');
	});
});
