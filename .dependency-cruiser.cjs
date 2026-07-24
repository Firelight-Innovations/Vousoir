/* eslint-disable */
/**
 * dependency-cruiser — the boundary-enforcement wall for the Vousoir layer (work order §7.1).
 *
 * This is one of TWO independent walls: Node's per-package `exports` seal (work order §6.3)
 * refuses deep imports at runtime; dependency-cruiser refuses boundary violations at CI time.
 *
 * Scope: only the Vousoir layer is scanned (typings/, vousoir/, extensions/vousoir-*).
 * Inherited code-oss core (src/, other extensions/) keeps its own upstream tooling (§7.4).
 * Paths below are relative to the REPO ROOT, where `pnpm dep-check` invokes depcruise.
 */
module.exports = {
	forbidden: [
		{
			name: 'no-cross-service-imports',
			comment:
				'§7.1: services communicate via MCP/IPC only — a service package may not import another service package. ' +
				'service-host is the sole exception (it may import service manifests to supervise them).',
			severity: 'error',
			from: { path: '^vousoir/services/(?!service-host/)([^/]+)/' },
			to: { path: '^vousoir/services/([^/]+)/', pathNot: '^vousoir/services/$1/' },
		},
		{
			name: 'ext-imports-only-typings-and-shared',
			comment:
				'§7.1: extensions/vousoir-* may import @vousoir/typings and @vousoir/shared — and nothing else ' +
				'from the vousoir/ or typings/ tree.',
			severity: 'error',
			from: { path: '^extensions/vousoir-' },
			to: { path: '^(vousoir/|typings/)', pathNot: '^(typings/|vousoir/shared/)' },
		},
		{
			name: 'vousoir-layer-not-import-core',
			comment:
				'§7.1: nothing under vousoir/ or typings/ (nor the vousoir-* extensions) may import from ' +
				'code-oss core (src/). The extension bridges to the shell via the public vscode API, not core source.',
			severity: 'error',
			from: { path: '^(vousoir/|typings/|extensions/vousoir-)' },
			to: { path: '^src/' },
		},
		{
			name: 'core-not-import-vousoir',
			comment: '§7.1: code-oss core (src/) may not import from the vousoir/ or typings/ tree — the extension is the only bridge.',
			severity: 'error',
			from: { path: '^src/' },
			to: { path: '^(vousoir/|typings/)' },
		},
		{
			name: 'typings-only-imports-zod',
			comment:
				'§7.3: typings/ contains only type declarations and zod schemas. It may import nothing except zod ' +
				'(and its own sibling files). zod is the one allowed runtime dependency because a schema IS an MCP contract.',
			severity: 'error',
			from: { path: '^typings/' },
			to: { pathNot: ['^typings/', 'node_modules/zod/', '/node_modules/zod/'] },
		},
		{
			name: 'no-unresolvable',
			comment:
				'An import that does not resolve must fail CI. Without this, a typo\'d or broken cross-package ' +
				'path is silently ignored by every other rule here — a boundary violation can hide behind a bad ' +
				'path and never be evaluated. (Caught during Phase 1 negative-testing of the boundary wall.)',
			severity: 'error',
			from: {},
			// `vscode` is the one legitimate exception: the extension host injects it at runtime,
			// so it never exists on disk and can never resolve through node resolution — exactly
			// like a Node builtin. Without this carve-out the rule would reject every VS Code
			// extension that imports the API it is built against.
			to: { couldNotResolve: true, pathNot: '^vscode$' },
		},
		{
			name: 'no-circular',
			comment: '§7.1: no circular dependencies anywhere in the Vousoir layer.',
			severity: 'error',
			from: {},
			to: { circular: true },
		},
		{
			name: 'no-orphans',
			comment:
				'§7.1: no orphan modules (files nothing imports) — dead code fails CI. Package public entry points ' +
				'(index.ts / extension.ts) and type-declaration files are exempt: they are surfaces, not dead code.',
			severity: 'error',
			from: {
				orphan: true,
				pathNot: ['(^|/)index\\.ts$', '(^|/)extension\\.ts$', '\\.d\\.ts$'],
			},
			to: {},
		},
	],
	options: {
		doNotFollow: { path: 'node_modules' },
		// Catch type-only imports too — a boundary breach via `import type` is still a breach.
		tsPreCompilationDeps: true,
		// Deliberately no `tsConfig`: vousoir/tsconfig.base.json is an extends-only base with no
		// `include`, so handing it to depcruise raises TS18003. The Vousoir layer resolves
		// cross-package imports through pnpm workspace links + each package's `exports` field
		// (§6.3) rather than TS path aliases, so enhanced-resolve alone is sufficient.
		enhancedResolveOptions: {
			exportsFields: ['exports'],
			conditionNames: ['import', 'require', 'types', 'default'],
			extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
		},
		combinedDependencies: true,
	},
};
