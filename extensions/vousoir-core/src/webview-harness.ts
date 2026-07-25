/**
 * Test-only: runs a REAL webview script against a real DOM.
 *
 * **What this proves.** It loads the actual `media/*.js` files the webview loads — read
 * off disk, never re-implemented — into a DOM built by the actual `*-html.ts` builders the
 * extension serves. So the render path from "extension posts a message" to "elements exist
 * in the document" is genuinely exercised, and so is every interaction handler, against the
 * shipped source.
 *
 * **What this does NOT prove, and nobody should read green tests as covering:**
 *
 * - **The CSP.** happy-dom does not enforce Content-Security-Policy. A script blocked by a
 *   bad nonce or a missing `localResourceRoots` entry passes here and fails in Electron.
 *   That is the single most likely real-world failure and this harness is blind to it.
 * - **`asWebviewUri` resolution.** The fake below returns the path it was given. Whether
 *   the real scheme rewrite finds the file on disk is untested.
 * - **Layout and painting.** Nothing here has a box model. `getBoundingClientRect` is
 *   stubbed, so anything depending on real geometry — pointer hit-testing at a zoom level,
 *   overflow, scroll — is approximated, not verified.
 * - **Real pointer semantics.** Events are dispatched synthetically. Button state, capture,
 *   and event ordering under a real compositor are not reproduced.
 *
 * A human still has to open the app. This exists so that when they do, they are checking
 * appearance and feel rather than discovering that the boxes never rendered at all.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Absolute path of the extension's `media/` folder. */
export const MEDIA_DIR = join(import.meta.dirname, '..', 'media');

/** A recorded `postMessage` from the webview to the extension host. */
export type PostedMessage = Record<string, unknown>;

/** What a mounted webview exposes to a test. */
export interface MountedWebview {
	/** Every message the script posted, in order. */
	readonly posted: PostedMessage[];
	/** Delivers a message from the extension host, as `window.postMessage` would. */
	send(message: unknown): void;
	/** The last posted message of a given type, or `undefined`. */
	lastPosted(type: string): PostedMessage | undefined;
}

/** Minimal stand-in for `vscode.Uri` — enough for the HTML builders' `with`/`toString`. */
export function fakeUri(path: string): { path: string; with(change: { path: string }): unknown; toString(): string } {
	return {
		path,
		with(change: { path: string }) {
			return fakeUri(change.path);
		},
		toString() {
			return `vscode-webview://test${path}`;
		},
	};
}

/** Minimal stand-in for `vscode.Webview`. `asWebviewUri` is identity — see the caveats above. */
export function fakeWebview(): { cspSource: string; asWebviewUri(uri: unknown): unknown } {
	return recordingWebview().webview;
}

/**
 * A fake webview that also records every path handed to `asWebviewUri`.
 *
 * That list is what the conformance test checks against the provider's real
 * `localResourceRoots`: an asset outside those roots is silently unloadable in Electron,
 * and so is one that simply is not on disk.
 */
export function recordingWebview(): {
	webview: { cspSource: string; asWebviewUri(uri: unknown): unknown };
	requested: string[];
} {
	const requested: string[] = [];
	return {
		requested,
		webview: {
			cspSource: 'vscode-webview://test',
			asWebviewUri(uri: unknown) {
				const path = (uri as { path?: unknown }).path;
				if (typeof path === 'string') {
					requested.push(path);
				}
				return uri;
			},
		},
	};
}

/**
 * Installs `html` into the document, stubs the webview API, and executes `scriptFile` from
 * `media/`.
 *
 * The `<script>` tag is stripped before mounting and the file is executed explicitly — the
 * DOM implementation will not fetch `vscode-webview://` URLs, and running it by hand is
 * also what lets a test observe the exact moment the script initialises.
 */
export function mountWebview(html: string, scriptFile: string): MountedWebview {
	const posted: PostedMessage[] = [];

	// The stylesheet <link> goes too: happy-dom would try to fetch a `vscode-webview://`
	// URL it cannot resolve, and the resulting stack traces would bury real failures. CSS
	// is not under test here — there is no box model to apply it to.
	document.documentElement.innerHTML = html
		.replace(/<!DOCTYPE html>/i, '')
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<link\b[^>]*>/gi, '');

	const api = {
		postMessage(message: PostedMessage) {
			posted.push(message);
		},
		getState: () => undefined,
		setState: () => undefined,
	};
	(globalThis as unknown as Record<string, unknown>)['acquireVsCodeApi'] = () => api;

	stubGeometry();

	const source = readFileSync(join(MEDIA_DIR, scriptFile), 'utf8');
	// Executed as a plain function body so it runs against these globals, exactly as the
	// webview would run it — not imported, not transformed, not re-implemented.
	new Function(source)();

	return {
		posted,
		send(message: unknown) {
			window.dispatchEvent(new window.MessageEvent('message', { data: message }));
		},
		lastPosted(type: string) {
			return [...posted].reverse().find((message) => message['type'] === type);
		},
	};
}

/**
 * Gives every element a deterministic zero-origin rect.
 *
 * happy-dom has no box model, so `getBoundingClientRect` returns all zeros and hit-testing
 * against it would be meaningless. Pinning it to a known origin at least makes the
 * coordinate maths exercisable — but it is a stub, and real geometry stays unverified.
 */
function stubGeometry(): void {
	Object.defineProperty(window.Element.prototype, 'getBoundingClientRect', {
		configurable: true,
		value: () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 800, height: 600, toJSON: () => ({}) }),
	});
}

/** Dispatches a mouse event with coordinates, which happy-dom's constructor honours. */
export function mouse(target: EventTarget, type: string, clientX: number, clientY: number, button = 0): void {
	const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button });
	target.dispatchEvent(event);
}
