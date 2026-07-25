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

	const notice = document.getElementById('v6r-notice');
	let noticeTimer = null;

	const MIN_SCALE = 0.15;
	const MAX_SCALE = 3;

	/** Pan/zoom lives only in the webview: it is a view concern, not model state. */
	const view = { x: 0, y: 0, scale: 1 };
	/** The last rendered boxes, kept for drop hit-testing. */
	let lastBoxes = [];

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

		lastBoxes = message.boxes;
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
			// Stop the pan handler claiming a gesture that was aimed at a node.
			event.stopPropagation();
			vscode.postMessage({ type: 'selectNode', id: box.id });
			dragging = {
				id: box.id,
				box: box,
				element: element,
				startX: event.clientX,
				startY: event.clientY,
				moved: false,
			};
		});
		element.addEventListener('dblclick', (event) => {
			event.stopPropagation();
			vscode.postMessage({ type: 'drillInto', id: box.id });
		});
		element.addEventListener('contextmenu', (event) => {
			event.preventDefault();
			event.stopPropagation();
			selectedId = box.id;
			showNotice('Selected "' + box.title + '". Use the toolbar to add, rename or delete.');
		});
		return element;
	}

	function showError(text) {
		surface.replaceChildren();
		empty.hidden = false;
		empty.textContent = text;
	}

	function showNotice(text) {
		notice.textContent = text;
		notice.hidden = false;
		if (noticeTimer !== null) {
			clearTimeout(noticeTimer);
		}
		noticeTimer = setTimeout(function () { notice.hidden = true; }, 4000);
	}

	/**
	 * Which box is under the pointer, ignoring the one being dragged and its own subtree.
	 * Deepest wins, so dropping onto a nested module nests into that module rather than
	 * its parent. The store still refuses a genuine cycle; this only avoids the obvious one.
	 */
	function dropTargetAt(clientX, clientY, draggedId) {
		const rect = viewport.getBoundingClientRect();
		const x = (clientX - rect.left - view.x) / view.scale;
		const y = (clientY - rect.top - view.y) / view.scale;
		let best = null;
		for (const box of lastBoxes) {
			if (box.id === draggedId) {
				continue;
			}
			if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
				if (best === null || box.depth > best.depth) {
					best = box;
				}
			}
		}
		return best;
	}

	// --- Pan ---
	let panning = null;
	let dragging = null;
	let selectedId = null;

	viewport.addEventListener('mousedown', (event) => {
		if (event.button !== 0) {
			return;
		}
		panning = { x: event.clientX - view.x, y: event.clientY - view.y };
		viewport.classList.add('v6r-panning');
		vscode.postMessage({ type: 'selectNode', id: null });
	});

	window.addEventListener('mousemove', (event) => {
		if (dragging !== null) {
			const dx = (event.clientX - dragging.startX) / view.scale;
			const dy = (event.clientY - dragging.startY) / view.scale;
			if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 3) {
				return; // A few pixels of jitter is a click, not a drag.
			}
			dragging.moved = true;
			dragging.element.style.left = (dragging.box.x + dx) + 'px';
			dragging.element.style.top = (dragging.box.y + dy) + 'px';
			return;
		}
		if (panning === null) {
			return;
		}
		view.x = event.clientX - panning.x;
		view.y = event.clientY - panning.y;
		applyTransform();
	});

	window.addEventListener('mouseup', (event) => {
		if (dragging !== null) {
			const drag = dragging;
			dragging = null;
			if (drag.moved) {
				const target = dropTargetAt(event.clientX, event.clientY, drag.id);
				const dx = (event.clientX - drag.startX) / view.scale;
				const dy = (event.clientY - drag.startY) / view.scale;
				if (target !== null && target.id !== drag.box.parentId) {
					// Dropped onto another module: nest into it. Re-parenting moves the
					// files, so the extension redraws and any stale placement is replaced.
					vscode.postMessage({ type: 'reparentNode', id: drag.id, parent: target.id });
				} else {
					vscode.postMessage({
						type: 'moveNode',
						id: drag.id,
						position: { x: drag.box.x + dx, y: drag.box.y + dy },
					});
				}
			}
		}
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
		} else if (message.type === 'notice') {
			showNotice(message.message);
		}
	});

	window.addEventListener('error', (event) => {
		vscode.postMessage({ type: 'error', message: String(event.message) });
	});

	document.getElementById('v6r-add').addEventListener('click', () => {
		vscode.postMessage({ type: 'createNode', parent: selectedId });
	});
	document.getElementById('v6r-rename').addEventListener('click', () => {
		if (selectedId === null) { showNotice('Select a module first (right-click it).'); return; }
		vscode.postMessage({ type: 'renameNode', id: selectedId });
	});
	document.getElementById('v6r-delete').addEventListener('click', () => {
		if (selectedId === null) { showNotice('Select a module first (right-click it).'); return; }
		vscode.postMessage({ type: 'deleteNode', id: selectedId });
	});
	document.getElementById('v6r-tidy').addEventListener('click', () => {
		vscode.postMessage({ type: 'tidy' });
	});
	document.getElementById('v6r-back').addEventListener('click', () => {
		vscode.postMessage({ type: 'drillInto', id: null });
	});

	applyTransform();
	vscode.postMessage({ type: 'ready' });
})();
