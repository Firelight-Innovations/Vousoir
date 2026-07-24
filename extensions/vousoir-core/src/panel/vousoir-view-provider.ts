/**
 * Resolves the "Vousoir" activity-bar webview view (work order section 6.1 / section 9.7): a static page
 * showing the running app's version and "canvas coming soon". No scripts, no remote content,
 * no local resources - there is nothing to load, so `localResourceRoots` stays empty.
 */
import type { CancellationToken, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from 'vscode';
import { buildWebviewHtml } from './webview-html.ts';

export const VOUSOIR_VIEW_ID = 'vousoir.panel';

export class VousoirViewProvider implements WebviewViewProvider {
	public constructor(private readonly appVersion: string) { }

	public resolveWebviewView(webviewView: WebviewView, _context: WebviewViewResolveContext, _token: CancellationToken): void {
		webviewView.webview.options = {
			enableScripts: false,
			localResourceRoots: [],
		};
		webviewView.webview.html = buildWebviewHtml(webviewView.webview, this.appVersion);
	}
}
