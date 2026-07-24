/**
 * Static placeholder page for the Vousoir panel (work order section 6.1 / section 10): app version +
 * "canvas coming soon", nothing more. Follows webview security norms - strict CSP with a
 * per-render nonce, no remote content, no scripts (the page is static, so `enableScripts`
 * stays off in the caller and no nonce-gated `<script>` is needed here).
 */
import * as crypto from 'node:crypto';
import type { Webview } from 'vscode';

export function buildWebviewHtml(webview: Webview, appVersion: string): string {
	const nonce = crypto.randomBytes(16).toString('base64');
	const csp = [
		`default-src 'none'`,
		`style-src 'nonce-${nonce}'`,
		`img-src ${webview.cspSource}`,
	].join('; ');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Vousoir</title>
	<style nonce="${nonce}">
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			padding: 0 1rem;
		}
		h2 {
			font-weight: 600;
		}
		.version {
			opacity: 0.7;
			margin-top: -0.5rem;
		}
		.coming-soon {
			margin-top: 1.5rem;
			font-style: italic;
			opacity: 0.85;
		}
	</style>
</head>
<body>
	<h2>Vousoir</h2>
	<div class="version">v${escapeHtml(appVersion)}</div>
	<div class="coming-soon">canvas coming soon</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
