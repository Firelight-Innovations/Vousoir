/**
 * The canvas webview's HTML shell (ADR-004).
 *
 * Self-contained: CSS and JS are real files under `media/`, loaded through `asWebviewUri`
 * with `localResourceRoots` scoped to that folder. No CDN, no remote font, no network of
 * any kind — the canvas works in an air-gapped checkout and no third party's uptime can
 * break the editor.
 *
 * The CSP is `default-src 'none'` with a fresh nonce per render, following
 * `media-preview/src/audioPreview.ts` and Vousoir's own `panel/webview-html.ts`. The nonce
 * is generated inside this function, never at module scope: a module-scoped nonce would be
 * reused across renders, which defeats the point of having one.
 */

import * as crypto from 'node:crypto';
import type { Uri, Webview } from 'vscode';

/** Builds the canvas HTML for one render. */
export function canvasHtml(webview: Webview, mediaRoot: Uri, projectName: string): string {
	const nonce = crypto.randomBytes(16).toString('base64');
	const script = webview.asWebviewUri(joinMedia(mediaRoot, 'canvas.js')).toString();
	const style = webview.asWebviewUri(joinMedia(mediaRoot, 'canvas.css')).toString();
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
<title>${escapeText(projectName)}</title>
</head>
<body>
<div id="v6r-toolbar">
	<span id="v6r-project">${escapeText(projectName)}</span>
	<span id="v6r-hint">drag to pan &middot; scroll to zoom</span>
</div>
<div id="v6r-viewport"><div id="v6r-surface"></div></div>
<div id="v6r-empty" hidden></div>
<script nonce="${nonce}" src="${escapeAttribute(script)}"></script>
</body>
</html>`;
}

/**
 * `Uri.joinPath` lives on the `vscode` namespace, which this module deliberately does not
 * import — keeping it to types only makes it trivially unit-testable later. Callers pass
 * the media root already resolved.
 */
function joinMedia(mediaRoot: Uri, file: string): Uri {
	return mediaRoot.with({ path: `${mediaRoot.path}/${file}` });
}

/** Escapes a value for an HTML attribute, as `audioPreview.ts` does before interpolating. */
function escapeAttribute(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
