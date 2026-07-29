/**
 * Smoke test for the real canvas webview script: rendering, and the messages it sends back.
 *
 * This crosses the gap that three milestones never crossed: "boxes computed" to "boxes in
 * the DOM". It loads `media/canvas.js` off disk — the shipped file — into HTML produced by
 * the real `canvasHtml` builder, and drives it with the real layout output.
 *
 * Smoke, not exhaustive: each path is proven once. See `webview-harness.ts` for the four
 * things this deliberately does not prove, the CSP most importantly. Pointer gestures live
 * in `canvas-webview-gestures.smoke.test.ts`; the shared setup in `canvas-webview-fixture.ts`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CanvasBox } from '@vousoir/typings';
import {
	mountCanvas,
	nodeFor,
	nodes,
	renderMessage,
	withRealStyles,
} from './canvas-webview-fixture.ts';
import type { MountedWebview } from '../webview-harness.ts';
import { mouse } from '../webview-harness.ts';

let canvas: MountedWebview;

beforeEach(() => {
	canvas = mountCanvas();
});

describe('the canvas renders', () => {
	it('signals ready as soon as it loads', () => {
		expect(canvas.lastPosted('ready')).toBeDefined();
	});

	it('puts one element in the DOM per laid-out box', () => {
		canvas.send(renderMessage());
		expect(nodes()).toHaveLength(4);
	});

	it('labels every box with its title and status', () => {
		canvas.send(renderMessage());
		expect(nodeFor('api').textContent).toContain('Task API');
		expect(nodeFor('api').textContent).toContain('specified');
		expect(nodeFor('validation').textContent).toContain('Request Validation');
	});

	it('positions and sizes each box from the layout, in pixels', () => {
		const message = renderMessage();
		canvas.send(message);
		const boxes = message['boxes'] as CanvasBox[];
		const api = boxes.find((box) => box.id === 'api');
		expect(api).toBeDefined();
		expect(nodeFor('api').style.left).toBe(`${api?.x}px`);
		expect(nodeFor('api').style.width).toBe(`${api?.width}px`);
	});

	it('carries nesting depth onto the element, so CSS can tint by level', () => {
		canvas.send(renderMessage());
		expect(nodeFor('root').dataset['depth']).toBe('0');
		expect(nodeFor('api').dataset['depth']).toBe('1');
		expect(nodeFor('validation').dataset['depth']).toBe('2');
	});

	it('paints children after parents, so a nested box is not hidden', () => {
		canvas.send(renderMessage());
		const order = nodes().map((element) => (element as HTMLElement).dataset['id']);
		expect(order.indexOf('root')).toBeLessThan(order.indexOf('api'));
		expect(order.indexOf('api')).toBeLessThan(order.indexOf('validation'));
	});

	it('replaces the previous render rather than appending to it', () => {
		canvas.send(renderMessage());
		canvas.send(renderMessage());
		expect(nodes()).toHaveLength(4);
	});

	it('shows a helpful message for an empty spec instead of a blank canvas', () => {
		canvas.send({ type: 'render', projectName: 'Empty', width: 0, height: 0, boxes: [] });
		const empty = document.getElementById('v6r-empty');
		expect(empty?.hidden).toBe(false);
		expect(empty?.textContent).toContain('No modules yet');
	});

	it('titles the canvas from the render, so a drilled-in subtree says where you are', () => {
		canvas.send({ ...renderMessage(), projectName: 'Vousoir Demo / Task API' });
		expect(document.getElementById('v6r-project')?.textContent).toBe('Vousoir Demo / Task API');
	});

	it('takes the empty-state overlay out of the layout once modules render', () => {
		// Regression: `#v6r-empty` sets `display: flex`, which outranks the user agent's
		// `[hidden] { display: none }`. Hiding it therefore left an invisible, full-viewport
		// element over the canvas that swallowed every click, drag and wheel.
		withRealStyles();
		canvas.send(renderMessage());
		const empty = document.getElementById('v6r-empty') as HTMLElement;
		expect(empty.hidden).toBe(true);
		expect(window.getComputedStyle(empty).display).toBe('none');
	});

	it('shows an error in place of the canvas when the extension reports one', () => {
		canvas.send({ type: 'showError', message: 'spec directory unreadable' });
		expect(document.getElementById('v6r-empty')?.textContent).toContain('unreadable');
	});

	it('surfaces a transient notice without wiping the canvas', () => {
		canvas.send(renderMessage());
		canvas.send({ type: 'notice', message: 'cannot drop a module inside itself' });
		expect(document.getElementById('v6r-notice')?.textContent).toContain('inside itself');
		expect(nodes()).toHaveLength(4);
	});

	it('ignores a message shape it does not know, rather than throwing', () => {
		canvas.send(renderMessage());
		canvas.send({ type: 'no-such-message' });
		canvas.send(null);
		expect(nodes()).toHaveLength(4);
	});
});

describe('the canvas talks back', () => {
	beforeEach(() => {
		canvas.send(renderMessage());
	});

	it('reports a selection when a module is clicked', () => {
		mouse(nodeFor('api'), 'mousedown', 10, 10);
		expect(canvas.lastPosted('selectNode')).toMatchObject({ id: 'api' });
	});

	it('clears the selection when empty canvas is clicked', () => {
		const viewport = document.getElementById('v6r-viewport');
		expect(viewport).not.toBeNull();
		mouse(viewport as Element, 'mousedown', 5, 5);
		expect(canvas.lastPosted('selectNode')).toMatchObject({ id: null });
	});

	it('drills in on a double-click', () => {
		nodeFor('storage').dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }));
		expect(canvas.lastPosted('drillInto')).toMatchObject({ id: 'storage' });
	});

	it('returns to the whole tree from the toolbar', () => {
		(document.getElementById('v6r-back') as HTMLElement).click();
		expect(canvas.lastPosted('drillInto')).toMatchObject({ id: null });
	});

	it('asks to tidy from the toolbar — the explicit auto-layout command', () => {
		(document.getElementById('v6r-tidy') as HTMLElement).click();
		expect(canvas.lastPosted('tidy')).toBeDefined();
	});

	it('asks to create a module, scoped to the selected one', () => {
		nodeFor('api').dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
		(document.getElementById('v6r-add') as HTMLElement).click();
		expect(canvas.lastPosted('createNode')).toMatchObject({ parent: 'api' });
	});

	it('refuses rename and delete until something is selected', () => {
		(document.getElementById('v6r-rename') as HTMLElement).click();
		expect(canvas.lastPosted('renameNode')).toBeUndefined();
		expect(document.getElementById('v6r-notice')?.textContent).toContain('Select a module');
	});

	it('selects for the toolbar and the spec panel with the same click', () => {
		// Regression: clicking told the panel and right-clicking told the toolbar, so whichever
		// gesture you used, the other surface disagreed.
		mouse(nodeFor('api'), 'mousedown', 10, 10);
		(document.getElementById('v6r-rename') as HTMLElement).click();
		expect(canvas.lastPosted('renameNode')).toMatchObject({ id: 'api' });
	});

	it('marks the selected module, and keeps the mark across a re-render', () => {
		mouse(nodeFor('api'), 'mousedown', 10, 10);
		expect(nodeFor('api').classList.contains('v6r-selected')).toBe(true);
		canvas.send(renderMessage());
		expect(nodeFor('api').classList.contains('v6r-selected')).toBe(true);
		expect(nodeFor('storage').classList.contains('v6r-selected')).toBe(false);
	});

	it('drops the mark when the selection is cleared on empty canvas', () => {
		mouse(nodeFor('api'), 'mousedown', 10, 10);
		mouse(document.getElementById('v6r-viewport') as Element, 'mousedown', 5, 5);
		expect(nodeFor('api').classList.contains('v6r-selected')).toBe(false);
	});

});
