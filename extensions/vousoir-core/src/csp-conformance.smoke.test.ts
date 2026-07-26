/**
 * CSP and resource-root conformance for both webview HTML builders.
 *
 * The smoke harness proved the scripts work once loaded. It could not prove they would
 * *be* loaded: happy-dom does not enforce Content-Security-Policy, so a nonce mismatch
 * between the policy and the `<script>` tag — or an asset outside `localResourceRoots` —
 * passes there and blanks the webview in Electron. That is the failure this file narrows.
 *
 * Three properties, per builder:
 *   1. The page satisfies its own policy: the script nonce is the one the policy names,
 *      and every referenced source falls inside a directive that permits it.
 *   2. The policy is as strict as ADR-004 claims: `default-src 'none'`, no `unsafe-inline`,
 *      no `unsafe-eval`, no remote origin, and `data:` confined to `img-src`.
 *   3. Every asset handed to `asWebviewUri` sits under the provider's real
 *      `localResourceRoots` (`media/`) and actually exists on disk.
 *
 * **What this still cannot prove, and only a running Electron can:** that Electron's CSP
 * implementation agrees with this reading of the policy; that the real `asWebviewUri`
 * scheme rewrite resolves to a fetchable URL; and that anything paints. This narrows the
 * residual risk to those three — it does not eliminate it.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canvasHtml } from './canvas/canvas-html.ts';
import { specPanelHtml } from './panel/spec-panel-html.ts';
import { MEDIA_DIR, fakeUri, recordingWebview } from './webview-harness.ts';

/** The roots both providers actually pass to `webview.options.localResourceRoots`. */
const RESOURCE_ROOTS = ['/media'];

interface Page {
	readonly html: string;
	readonly requested: readonly string[];
}

/** Builds each page exactly as its provider does, recording asset requests. */
const PAGES: Record<string, () => Page> = {
	canvas: () => {
		const { webview, requested } = recordingWebview();
		const html = canvasHtml(webview as never, fakeUri('/media') as never, 'Vousoir Demo');
		return { html, requested };
	},
	'spec panel': () => {
		const { webview, requested } = recordingWebview();
		const html = specPanelHtml(webview as never, fakeUri('/media') as never);
		return { html, requested };
	},
};

function policyOf(html: string): Record<string, string[]> {
	const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html);
	if (meta === null) {
		throw new Error('no Content-Security-Policy meta tag');
	}
	const directives: Record<string, string[]> = {};
	for (const part of (meta[1] ?? '').split(';')) {
		const [name, ...sources] = part.trim().split(/\s+/);
		if (name !== undefined && name.length > 0) {
			directives[name] = sources;
		}
	}
	return directives;
}

function scriptTags(html: string): { nonce: string | undefined; src: string | undefined }[] {
	return [...html.matchAll(/<script\b([^>]*)>/g)].map((match) => ({
		nonce: /nonce="([^"]*)"/.exec(match[1] ?? '')?.[1],
		src: /src="([^"]*)"/.exec(match[1] ?? '')?.[1],
	}));
}

function styleHrefs(html: string): string[] {
	return [...html.matchAll(/<link\b[^>]*href="([^"]*)"[^>]*>/g)].map((match) => match[1] ?? '');
}

describe.each(Object.keys(PAGES))('%s CSP conformance', (name) => {
	const build = PAGES[name];
	if (build === undefined) {
		throw new Error(`no page builder for ${name}`);
	}

	it('names every script nonce in script-src', () => {
		const { html } = build();
		const policy = policyOf(html);
		const scripts = scriptTags(html);

		expect(scripts.length).toBeGreaterThan(0);
		for (const script of scripts) {
			expect(script.nonce, 'every script must carry a nonce').toBeDefined();
			// The exact bug that passes happy-dom and blanks Electron.
			expect(policy['script-src']).toContain(`'nonce-${script.nonce}'`);
		}
	});

	it('uses a fresh nonce per render, never a module-scoped one', () => {
		const first = scriptTags(build().html)[0]?.nonce;
		const second = scriptTags(build().html)[0]?.nonce;
		expect(first).toBeDefined();
		expect(first).not.toBe(second);
	});

	it('permits the stylesheet it links', () => {
		const { html } = build();
		const policy = policyOf(html);
		const hrefs = styleHrefs(html);

		expect(hrefs.length).toBeGreaterThan(0);
		for (const href of hrefs) {
			// `style-src vscode-webview://test` must cover `vscode-webview://test/media/...`.
			expect(policy['style-src']?.some((source) => href.startsWith(source))).toBe(true);
		}
	});

	it('denies everything by default', () => {
		expect(policyOf(build().html)['default-src']).toEqual([`'none'`]);
	});

	it('allows no unsafe-inline and no unsafe-eval anywhere', () => {
		const policy = policyOf(build().html);
		for (const [directive, sources] of Object.entries(policy)) {
			expect(sources, `${directive} must not relax script or style execution`).not.toContain(`'unsafe-inline'`);
			expect(sources, directive).not.toContain(`'unsafe-eval'`);
		}
	});

	it('names no remote origin and no wildcard — ADR-004 promises self-contained', () => {
		const policy = policyOf(build().html);
		for (const [directive, sources] of Object.entries(policy)) {
			for (const source of sources) {
				expect(source, `${directive} must not reach the network`).not.toMatch(/^https?:/);
				expect(source, directive).not.toBe('*');
			}
		}
	});

	it('confines data: to img-src — script-src data: is a known CSP bypass', () => {
		for (const [directive, sources] of Object.entries(policyOf(build().html))) {
			if (directive !== 'img-src') {
				expect(sources, directive).not.toContain('data:');
			}
		}
	});
});

describe.each(Object.keys(PAGES))('%s resource roots', (name) => {
	const build = PAGES[name];
	if (build === undefined) {
		throw new Error(`no page builder for ${name}`);
	}

	it('requests at least one asset, so the checks below are not vacuous', () => {
		expect(build().requested.length).toBeGreaterThan(0);
	});

	it('requests only assets inside localResourceRoots', () => {
		for (const path of build().requested) {
			// Outside the roots the webview simply will not load it, with no error anywhere.
			expect(RESOURCE_ROOTS.some((root) => path.startsWith(`${root}/`)), `${path} escapes media/`).toBe(true);
			expect(path).not.toContain('..');
		}
	});

	it('requests only assets that exist on disk', () => {
		for (const path of build().requested) {
			// A renamed or deleted asset is a silent blank page; this check is nearly free.
			const onDisk = join(MEDIA_DIR, path.replace(/^\/media\//, ''));
			expect(existsSync(onDisk), `${onDisk} does not exist`).toBe(true);
		}
	});
});
