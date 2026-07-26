/**
 * vousoir-core gets a test runner for exactly one purpose: exercising the real webview
 * scripts against a real DOM (see `src/webview-harness.ts`).
 *
 * `happy-dom` over `jsdom`: 8 packages added to the workspace against jsdom's larger
 * transitive set, and it is a devDependency — nothing shipped depends on it.
 *
 * Only `*.smoke.test.ts` files are collected. Everything else in this extension imports
 * `vscode`, which does not exist outside the extension host and would fail to resolve.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.smoke.test.ts'],
	},
});
