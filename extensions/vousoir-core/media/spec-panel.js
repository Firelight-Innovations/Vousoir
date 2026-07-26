/*
 * Spec panel webview script (ADR-004): a real extension file under a nonce CSP.
 *
 * Plain browser JavaScript, no imports, no bundler - the same call as canvas.js and for
 * the same reason: everything that benefits from types and tests lives in the extension
 * host and in @vousoir/shared.
 *
 * It renders three sections and posts one whole-spec save. It never saves per keystroke:
 * a save writes a file, and a write per character would fight the watcher and fill git
 * with noise. Typing only sets the dirty flag, which is what stops an external change
 * reloading over words the user has not saved yet.
 *
 * NOTHING here has a field for internal implementation. Behaviour is what a module does,
 * contracts are what crosses its boundary, test cases are how you know. If a field ever
 * starts describing HOW a module works inside, it does not belong in this panel.
 */

// @ts-check
(function () {
	'use strict';

	const vscode = acquireVsCodeApi();
	const KINDS = ['moduleApi', 'serviceApi', 'dbSchema'];

	const empty = document.getElementById('v6r-empty');
	const panel = document.getElementById('v6r-panel');
	const notice = document.getElementById('v6r-notice');
	const titleInput = document.getElementById('v6r-title');
	const badge = document.getElementById('v6r-badge');
	const behaviour = document.getElementById('v6r-behaviour');
	const behaviourHome = document.getElementById('v6r-behaviour-home');
	const contractsHost = document.getElementById('v6r-contracts');
	const testsHost = document.getElementById('v6r-tests');
	const dirtyFlag = document.getElementById('v6r-dirty');

	let current = null;
	let dirty = false;

	function setDirty(value) {
		if (dirty === value) {
			return;
		}
		dirty = value;
		dirtyFlag.hidden = !value;
		vscode.postMessage({ type: 'dirty', dirty: value });
	}

	function field(labelText, value, rows) {
		const wrap = document.createElement('div');
		wrap.className = 'v6r-field';
		const label = document.createElement('label');
		label.textContent = labelText;
		wrap.append(label);
		const input = rows ? document.createElement('textarea') : document.createElement('input');
		if (rows) {
			input.rows = rows;
		} else {
			input.type = 'text';
		}
		input.value = value || '';
		input.addEventListener('input', function () { setDirty(true); });
		wrap.append(input);
		return { wrap: wrap, input: input };
	}

	function removeButton(card) {
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'v6r-secondary';
		remove.textContent = 'Remove';
		remove.addEventListener('click', function () {
			card.remove();
			setDirty(true);
		});
		return remove;
	}

	function renderContract(contract) {
		const card = document.createElement('div');
		card.className = 'v6r-card';

		const row = document.createElement('div');
		row.className = 'v6r-row';
		const kind = document.createElement('select');
		for (const value of KINDS) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = value;
			kind.append(option);
		}
		kind.value = KINDS.indexOf(contract.kind) >= 0 ? contract.kind : 'moduleApi';
		kind.addEventListener('change', function () { setDirty(true); });

		const name = document.createElement('input');
		name.type = 'text';
		name.placeholder = 'name, e.g. GET /modules';
		name.value = contract.name || '';
		name.addEventListener('input', function () { setDirty(true); });

		row.append(kind, name);
		card.append(row);

		const body = field('what crosses the boundary', contract.body, 4);
		card.append(body.wrap);
		card.append(removeButton(card));

		card.v6rRead = function () {
			return { id: contract.id, kind: kind.value, name: name.value.trim(), body: body.input.value };
		};
		return card;
	}

	function renderTestCase(testCase) {
		const card = document.createElement('div');
		card.className = 'v6r-card';
		const description = field('description (required)', testCase.description, 0);
		const expected = field('expected (required)', testCase.expected, 2);
		const given = field('given (optional)', testCase.given, 0);
		const when = field('when (optional)', testCase.when, 0);
		const then = field('then (optional)', testCase.then, 0);
		const snippet = field('snippet (optional)', testCase.snippet, 3);
		card.append(description.wrap, expected.wrap, given.wrap, when.wrap, then.wrap, snippet.wrap);
		card.append(removeButton(card));

		card.v6rRead = function () {
			const out = {
				id: testCase.id,
				description: description.input.value.trim(),
				expected: expected.input.value.trim()
			};
			// Optional fields are omitted when blank rather than written as empty strings,
			// so a field the user never touched leaves no trace in the file.
			if (given.input.value.trim()) { out.given = given.input.value.trim(); }
			if (when.input.value.trim()) { out.when = when.input.value.trim(); }
			if (then.input.value.trim()) { out.then = then.input.value.trim(); }
			if (snippet.input.value.trim()) { out.snippet = snippet.input.value; }
			return out;
		};
		return card;
	}

	function showNode(node) {
		current = node;
		dirty = false;
		dirtyFlag.hidden = true;
		notice.hidden = true;
		empty.hidden = true;
		panel.hidden = false;

		titleInput.value = node.title;
		behaviour.value = node.behaviour;
		badge.textContent = node.isSpecified ? 'specified' : 'missing: ' + node.missing.join(', ');
		badge.className = node.isSpecified ? 'v6r-complete' : '';

		behaviourHome.hidden = !node.behaviourInFrontmatter;
		behaviourHome.textContent = node.behaviourInFrontmatter
			? 'This module keeps its behaviour in the deprecated frontmatter field. Editing here writes back there; the text is not moved.'
			: '';

		contractsHost.replaceChildren();
		for (const contract of node.contracts) {
			contractsHost.append(renderContract(contract));
		}
		testsHost.replaceChildren();
		for (const testCase of node.testCases) {
			testsHost.append(renderTestCase(testCase));
		}
	}

	function showEmpty(message) {
		current = null;
		panel.hidden = true;
		empty.hidden = false;
		empty.textContent = message;
	}

	function showNotice(message) {
		notice.textContent = message;
		notice.hidden = false;
	}

	function nextId(prefix, host) {
		return prefix + '-' + (host.childElementCount + 1) + '-' + Date.now().toString(36);
	}

	document.getElementById('v6r-add-contract').addEventListener('click', function () {
		contractsHost.append(renderContract({ id: nextId('c', contractsHost), kind: 'moduleApi', name: '', body: '' }));
		setDirty(true);
	});

	document.getElementById('v6r-add-test').addEventListener('click', function () {
		testsHost.append(renderTestCase({ id: nextId('tc', testsHost), description: '', expected: '' }));
		setDirty(true);
	});

	document.getElementById('v6r-open').addEventListener('click', function () {
		if (current) {
			vscode.postMessage({ type: 'openFile', id: current.id });
		}
	});

	titleInput.addEventListener('input', function () { setDirty(true); });
	behaviour.addEventListener('input', function () { setDirty(true); });

	document.getElementById('v6r-save').addEventListener('click', function () {
		if (!current) {
			return;
		}
		const contracts = Array.from(contractsHost.children).map(function (card) { return card.v6rRead(); });
		const testCases = Array.from(testsHost.children).map(function (card) { return card.v6rRead(); });
		// The schema requires these. Refusing here gives a pointed message instead of a
		// zod dump bouncing back from the extension.
		if (!titleInput.value.trim()) {
			showNotice('A module needs a title.');
			return;
		}
		for (const contract of contracts) {
			if (!contract.name) {
				showNotice('Every contract needs a name.');
				return;
			}
		}
		for (const testCase of testCases) {
			if (!testCase.description || !testCase.expected) {
				showNotice('Every test case needs a description and an expected result.');
				return;
			}
		}
		vscode.postMessage({
			type: 'save',
			id: current.id,
			title: titleInput.value.trim(),
			behaviour: behaviour.value,
			contracts: contracts,
			testCases: testCases
		});
	});

	window.addEventListener('message', function (event) {
		const message = event.data;
		if (message === null || typeof message !== 'object') {
			return;
		}
		if (message.type === 'showNode') {
			showNode(message.node);
		} else if (message.type === 'showEmpty') {
			showEmpty(message.message);
		} else if (message.type === 'saved') {
			setDirty(false);
			showNotice(message.message);
		} else if (message.type === 'externalChange' || message.type === 'showError') {
			showNotice(message.message);
		}
	});

	window.addEventListener('error', function (event) {
		vscode.postMessage({ type: 'error', message: String(event.message) });
	});

	vscode.postMessage({ type: 'ready' });
})();
