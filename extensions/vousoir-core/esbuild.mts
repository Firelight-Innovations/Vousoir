/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Mirrors extensions/git/esbuild.mts. `build/lib/extensions.ts#fromLocal` auto-detects this file
// per extension folder (`fs.existsSync`) - no code-oss core file needs to list vousoir-core for
// the production/packaging build to pick it up.
//
// vousoir-core's cross-package deps (@vousoir/typings, @vousoir/shared) are ESM TypeScript
// source reached via pnpm workspace links; bundling them here inlines that source into a single
// file so the extension host doesn't need to resolve pnpm's node_modules layout at load time.
//
// Output format is ESM, not the CJS every other built-in extension here uses: package.json keeps
// `"type": "module"` (matching every other Vousoir-layer package, and required for `tsc` to
// accept plain `import`/`export` syntax under `verbatimModuleSyntax` - see vousoir/tsconfig.base.json),
// and the extension host picks its loader from that same field
// (`src/vs/workbench/api/common/extHostExtensionService.ts#_isESM`: `type === 'module'` and the
// entry point doesn't end in `.cjs` -> loaded via `import()`, not `require()`). Confirmed this
// path is real and current, not legacy, by reading that method directly.
import * as path from 'node:path';
import { run } from '../esbuild-extension-common.mts';

const srcDir = path.join(import.meta.dirname, 'src');
const outDir = path.join(import.meta.dirname, 'dist');

run({
	platform: 'node',
	format: 'esm',
	entryPoints: {
		'extension': path.join(srcDir, 'extension.ts'),
	},
	srcDir,
	outdir: outDir,
	additionalOptions: {
		external: ['vscode'],
	},
}, process.argv);
