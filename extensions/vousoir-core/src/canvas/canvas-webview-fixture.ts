/**
 * Test-only fixture shared by the canvas smoke tests.
 *
 * The render/interaction tests and the pointer-gesture tests mount the same webview from the
 * same tree; this is that setup, extracted so neither file has to restate it and neither
 * grows past the line cap. It builds nothing the tests cannot see — every helper is a thin
 * wrapper over the real `canvasHtml` builder, the real layout, and the real `media/canvas.js`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSpecTree, layoutSpecTree } from '@vousoir/shared';
import type { CanvasBox, SpecNode, SpecNodeFrontmatter, SpecTree } from '@vousoir/typings';
import { canvasHtml } from './canvas-html.ts';
import { MEDIA_DIR, fakeUri, fakeWebview, mountWebview, type MountedWebview } from '../webview-harness.ts';

export function node(id: string, parent: string | null, title = id): SpecNode {
	const frontmatter: SpecNodeFrontmatter = { id, title, parent, status: 'specified' };
	return { id, filePath: `/repo/.vousoir/spec/${id}.md`, frontmatter, body: '' };
}

/** The DoD shape: three modules with one nested. */
export function demoTree(): SpecTree {
	return buildSpecTree([
		node('root', null, 'Vousoir Demo'),
		node('api', 'root', 'Task API'),
		node('validation', 'api', 'Request Validation'),
		node('storage', 'root', 'Task Store'),
	]);
}

export function renderMessage(tree: SpecTree = demoTree()): Record<string, unknown> {
	const layout = layoutSpecTree(tree);
	return {
		type: 'render',
		projectName: 'Vousoir Demo',
		width: layout.width,
		height: layout.height,
		boxes: layout.boxes.map((box: CanvasBox) => ({ ...box })),
	};
}

export function nodes(): Element[] {
	return [...document.querySelectorAll('.v6r-node')];
}

export function nodeFor(id: string): HTMLElement {
	const element = document.querySelector(`.v6r-node[data-id="${id}"]`);
	if (element === null) {
		throw new Error(`no rendered node for "${id}"`);
	}
	return element as HTMLElement;
}

/** Mounts the shipped `canvas.js` into HTML from the shipped builder. */
export function mountCanvas(): MountedWebview {
	const html = canvasHtml(fakeWebview() as never, fakeUri('/media') as never, 'Vousoir Demo');
	return mountWebview(html, 'canvas.js');
}

/**
 * The harness strips the stylesheet `<link>` (see its caveats). A test that needs the real
 * cascade injects `canvas.css` as a `<style>` — enough for `getComputedStyle`, still no box
 * model.
 */
export function withRealStyles(): void {
	const style = document.createElement('style');
	style.textContent = readFileSync(join(MEDIA_DIR, 'canvas.css'), 'utf8');
	document.head.append(style);
}
