/*
 * Canvas webview script (ADR-004): a real extension file loaded under a nonce CSP, never
 * inlined and never fetched.
 *
 * Plain browser JavaScript with no imports, so it needs no bundler. ARCHITECTURE.md's M2
 * section anticipated a second browser-target esbuild entry; that is only needed if the
 * webview imports modules, and this deliberately does not. The extension host does every
 * piece of work that benefits from types and tests — layout, validation, persistence — and
 * this file only draws what it is handed.
 *
 * It performs NO layout maths. Boxes arrive already positioned, so the one testable part
 * of the canvas stays in `@vousoir/shared` where vitest can reach it.
 */

// @ts-check
(function () {
	'use strict';

	const vscode = acquireVsCodeApi();
	const viewport = document.getElementById('v6r-viewport');
	const surface = document.getElementById('v6r-surface');
	const empty = document.getElementById('v6r-empty');

	const MIN_SCALE = 0.15;
	const MAX_SCALE = 3;

	/** Pan/zoom lives only in the webview: it is a view concern, not model state. */
	const view = { x: 0, y: 0, scale: 1 };

	function applyTransform() {
		surface.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
	}

	function render(message) {
		surface.replaceChildren();
		surface.style.width = `${message.width}px`;
		surface.style.height = `${message.height}px`;

		if (message.boxes.length === 0) {
			empty.hidden = false;
			empty.textContent =
				'No modules yet.\n\nAdd a markdown file under .vousoir/spec/ and reopen, or create a module from the command palette.';
			return;
		}
		empty.hidden = true;

		// Shallow boxes first, so a child always paints over its parent.
		for (const box of [...message.boxes].sort((a, b) => a.depth - b.depth)) {
			surface.append(renderBox(box));
		}
	}

	function renderBox(box) {
		const element = document.createElement('div');
		element.className = box.manual ? 'v6r-node v6r-manual' : 'v6r-node';
		element.dataset.id = box.id;
		element.dataset.depth = String(Math.min(box.depth, 2));
		element.style.left = `${box.x}px`;
		element.style.top = `${box.y}px`;
		element.style.width = `${box.width}px`;
		element.style.height = `${box.height}px`;

		const title = document.createElement('span');
		title.className = 'v6r-node-title';
		title.textContent = box.title;
		element.append(title);

		const status = document.createElement('span');
		status.className = 'v6r-node-status';
		status.textContent = box.status;
		element.append(status);

		element.addEventListener('mousedown', (event) => {
			// Stop the pan handler claiming a click that was aimed at a node.
			event.stopPropagation();
			vscode.postMessage({ type: 'selectNode', id: box.id });
		});
		return element;
	}

	function showError(text) {
		surface.replaceChildren();
		empty.hidden = false;
		empty.textContent = text;
	}

	// --- Pan ---
	let panning = null;

	viewport.addEventListener('mousedown', (event) => {
		if (event.button !== 0) {
			return;
		}
		panning = { x: event.clientX - view.x, y: event.clientY - view.y };
		viewport.classList.add('v6r-panning');
		vscode.postMessage({ type: 'selectNode', id: null });
	});

	window.addEventListener('mousemove', (event) => {
		if (panning === null) {
			return;
		}
		view.x = event.clientX - panning.x;
		view.y = event.clientY - panning.y;
		applyTransform();
	});

	window.addEventListener('mouseup', () => {
		panning = null;
		viewport.classList.remove('v6r-panning');
	});

	// --- Zoom ---
	viewport.addEventListener(
		'wheel',
		(event) => {
			event.preventDefault();
			const factor = Math.exp(-event.deltaY * 0.0015);
			const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
			// Zoom toward the pointer rather than the origin, so the thing under the cursor
			// stays under the cursor.
			const rect = viewport.getBoundingClientRect();
			const pointerX = event.clientX - rect.left;
			const pointerY = event.clientY - rect.top;
			view.x = pointerX - ((pointerX - view.x) * next) / view.scale;
			view.y = pointerY - ((pointerY - view.y) * next) / view.scale;
			view.scale = next;
			applyTransform();
		},
		{ passive: false },
	);

	window.addEventListener('message', (event) => {
		const message = event.data;
		if (message === null || typeof message !== 'object') {
			return;
		}
		if (message.type === 'render') {
			render(message);
		} else if (message.type === 'showError') {
			showError(message.message);
		}
	});

	window.addEventListener('error', (event) => {
		vscode.postMessage({ type: 'error', message: String(event.message) });
	});

	applyTransform();
	vscode.postMessage({ type: 'ready' });
})();
