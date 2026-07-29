/**
 * Smoke test for the canvas's pointer gestures: pan, zoom, drag-to-place, drag-to-re-parent.
 *
 * Split out of `canvas-webview.smoke.test.ts` so neither file passes the line cap. Same
 * harness, same shipped `media/canvas.js`, same caveats — happy-dom has no box model, so the
 * geometry here rides on the harness's stubbed `getBoundingClientRect`.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CanvasBox } from '@vousoir/typings';
import { mountCanvas, nodeFor, renderMessage } from './canvas-webview-fixture.ts';
import type { MountedWebview } from '../webview-harness.ts';
import { mouse } from '../webview-harness.ts';

let canvas: MountedWebview;

beforeEach(() => {
	canvas = mountCanvas();
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
