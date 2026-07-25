/**
 * Smoke test for the real canvas webview script.
 *
 * This crosses the gap that three milestones never crossed: "boxes computed" to "boxes in
 * the DOM". It loads `media/canvas.js` off disk — the shipped file — into HTML produced by
 * the real `canvasHtml` builder, and drives it with the real layout output.
 *
 * Smoke, not exhaustive: each path is proven once. See `webview-harness.ts` for the four
 * things this deliberately does not prove, the CSP most importantly.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { layoutSpecTree } from '@vousoir/shared';
import type { CanvasBox, SpecNode, SpecNodeFrontmatter, SpecTree } from '@vousoir/typings';
import { buildSpecTree } from '@vousoir/shared';
import { canvasHtml } from './canvas-html.ts';
import { fakeUri, fakeWebview, mountWebview, mouse, type MountedWebview } from '../webview-harness.ts';

function node(id: string, parent: string | null, title = id): SpecNode {
	const frontmatter: SpecNodeFrontmatter = { id, title, parent, status: 'specified' };
	return { id, filePath: `/repo/.vousoir/spec/${id}.md`, frontmatter, body: '' };
}

/** The DoD shape: three modules with one nested. */
function demoTree(): SpecTree {
	return buildSpecTree([
		node('root', null, 'Vousoir Demo'),
		node('api', 'root', 'Task API'),
		node('validation', 'api', 'Request Validation'),
		node('storage', 'root', 'Task Store'),
	]);
}

function renderMessage(tree: SpecTree = demoTree()): Record<string, unknown> {
	const layout = layoutSpecTree(tree);
	return {
		type: 'render',
		projectName: 'Vousoir Demo',
		width: layout.width,
		height: layout.height,
		boxes: layout.boxes.map((box: CanvasBox) => ({ ...box })),
	};
}

function nodes(): Element[] {
	return [...document.querySelectorAll('.v6r-node')];
}

function nodeFor(id: string): HTMLElement {
	const element = document.querySelector(`.v6r-node[data-id="${id}"]`);
	if (element === null) {
		throw new Error(`no rendered node for "${id}"`);
	}
	return element as HTMLElement;
}

let canvas: MountedWebview;

beforeEach(() => {
	const html = canvasHtml(fakeWebview() as never, fakeUri('/media') as never, 'Vousoir Demo');
	canvas = mountWebview(html, 'canvas.js');
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

});

describe('the canvas handles pointer gestures', () => {
	beforeEach(() => {
		canvas.send(renderMessage());
	});

	it('pans the surface without moving any node', () => {
		const viewport = document.getElementById('v6r-viewport') as Element;
		const before = nodeFor('api').style.left;
		mouse(viewport, 'mousedown', 100, 100);
		mouse(window as unknown as EventTarget, 'mousemove', 160, 140);
		mouse(window as unknown as EventTarget, 'mouseup', 160, 140);

		expect(document.getElementById('v6r-surface')?.style.transform).toContain('translate(60px, 40px)');
		expect(nodeFor('api').style.left).toBe(before);
		expect(canvas.lastPosted('moveNode')).toBeUndefined();
	});

	it('zooms on wheel', () => {
		const viewport = document.getElementById('v6r-viewport') as Element;
		viewport.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -240 }));
		expect(document.getElementById('v6r-surface')?.style.transform).toMatch(/scale\((?!1\))/);
	});

	it('drags a module to empty space and reports a manual placement', () => {
		const message = renderMessage();
		const storage = (message['boxes'] as CanvasBox[]).find((box) => box.id === 'storage');
		expect(storage).toBeDefined();

		// Drop far outside every box, so the drop target is empty canvas.
		mouse(nodeFor('storage'), 'mousedown', 300, 300);
		mouse(window as unknown as EventTarget, 'mousemove', 900, 700);
		mouse(window as unknown as EventTarget, 'mouseup', 900, 700);

		expect(canvas.lastPosted('reparentNode')).toBeUndefined();
		expect(canvas.lastPosted('moveNode')).toMatchObject({
			id: 'storage',
			position: { x: (storage?.x ?? 0) + 600, y: (storage?.y ?? 0) + 400 },
		});
	});

	it('drags a module onto another and reports a re-parent, not a placement', () => {
		const message = renderMessage();
		const target = (message['boxes'] as CanvasBox[]).find((box) => box.id === 'storage');
		expect(target).toBeDefined();
		// Aim at the middle of `storage`, which is not `validation`'s current parent.
		const dropX = (target?.x ?? 0) + (target?.width ?? 0) / 2;
		const dropY = (target?.y ?? 0) + (target?.height ?? 0) / 2;

		mouse(nodeFor('validation'), 'mousedown', 10, 10);
		mouse(window as unknown as EventTarget, 'mousemove', dropX, dropY);
		mouse(window as unknown as EventTarget, 'mouseup', dropX, dropY);

		expect(canvas.lastPosted('moveNode')).toBeUndefined();
		expect(canvas.lastPosted('reparentNode')).toMatchObject({ id: 'validation', parent: 'storage' });
	});

	it('does not offer a module its own descendant as a drop target', () => {
		// Dragging `api` onto `validation`, which is inside `api`. The store would reject the
		// cycle, but bouncing a natural gesture off an error is worse than treating it as a
		// placement — so the webview must not propose the re-parent in the first place.
		const message = renderMessage();
		const child = (message['boxes'] as CanvasBox[]).find((box) => box.id === 'validation');
		expect(child).toBeDefined();
		const dropX = (child?.x ?? 0) + (child?.width ?? 0) / 2;
		const dropY = (child?.y ?? 0) + (child?.height ?? 0) / 2;

		mouse(nodeFor('api'), 'mousedown', 10, 10);
		mouse(window as unknown as EventTarget, 'mousemove', dropX, dropY);
		mouse(window as unknown as EventTarget, 'mouseup', dropX, dropY);

		expect(canvas.lastPosted('reparentNode')).toBeUndefined();
		expect(canvas.lastPosted('moveNode')).toMatchObject({ id: 'api' });
	});

	it('treats a few pixels of movement as a click, not a drag', () => {
		const api = nodeFor('api');
		mouse(api, 'mousedown', 100, 100);
		mouse(window as unknown as EventTarget, 'mousemove', 101, 101);
		mouse(window as unknown as EventTarget, 'mouseup', 101, 101);
		expect(canvas.lastPosted('moveNode')).toBeUndefined();
		expect(canvas.lastPosted('reparentNode')).toBeUndefined();
	});
});
