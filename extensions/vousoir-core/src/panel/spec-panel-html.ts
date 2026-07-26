/**
 * The spec panel's HTML shell (ADR-004, same rules as the canvas).
 *
 * Self-contained: CSS and JS are real files under `media/`, loaded through `asWebviewUri`
 * with `localResourceRoots` scoped there. `default-src 'none'`, a fresh nonce per render
 * generated inside this function rather than at module scope. No CDN, no network.
 */

import * as crypto from 'node:crypto';
import type { Uri, Webview } from 'vscode';

/** Builds the spec panel HTML for one render. */
export function specPanelHtml(webview: Webview, mediaRoot: Uri): string {
	const nonce = crypto.randomBytes(16).toString('base64');
	const script = webview.asWebviewUri(join(mediaRoot, 'spec-panel.js')).toString();
	const style = webview.asWebviewUri(join(mediaRoot, 'spec-panel.css')).toString();
	const csp = [
		`default-src 'none'`,
		`img-src ${webview.cspSource} data:`,
		`style-src ${webview.cspSource}`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<link href="${escapeAttribute(style)}" rel="stylesheet">
<title>Module spec</title>
</head>
<body>
<div id="v6r-empty">Select a module on the canvas to see its spec.</div>
<div id="v6r-panel" hidden>
	<header id="v6r-head">
		<input id="v6r-title" type="text" spellcheck="false">
		<div id="v6r-meta"><span id="v6r-badge"></span><button id="v6r-open" type="button">Open file</button></div>
	</header>
	<div id="v6r-notice" hidden></div>

	<section>
		<h2>Behaviour</h2>
		<p class="v6r-help">What this module does, in plain language. Not how it does it.</p>
		<p id="v6r-behaviour-home" class="v6r-help" hidden></p>
		<textarea id="v6r-behaviour" rows="8" spellcheck="true"></textarea>
	</section>

	<section>
		<h2>Contracts</h2>
		<p class="v6r-help">What crosses this module's boundary. Its edges, never its internals.</p>
		<div id="v6r-contracts"></div>
		<button id="v6r-add-contract" type="button">Add contract</button>
	</section>

	<section>
		<h2>Test cases</h2>
		<p class="v6r-help">Description and expected are required. Given / When / Then and a snippet are optional.</p>
		<div id="v6r-tests"></div>
		<button id="v6r-add-test" type="button">Add test case</button>
	</section>

	<footer id="v6r-foot"><button id="v6r-save" type="button">Save</button><span id="v6r-dirty" hidden>unsaved</span></footer>
</div>
<script nonce="${nonce}" src="${escapeAttribute(script)}"></script>
</body>
</html>`;
}

function join(root: Uri, file: string): Uri {
	return root.with({ path: `${root.path}/${file}` });
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
