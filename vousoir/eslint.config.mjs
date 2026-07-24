// @ts-check
/**
 * ESLint flat config for the VOUSOIR LAYER only (typings/, vousoir/, extensions/vousoir-*).
 * Work order §7.2 / §7.4: inherited code-oss core keeps its own upstream lint config
 * (repo-root eslint.config.js) untouched — reformatting upstream would make every merge a war.
 *
 * Enforced here:
 *   - max file length 300 (warn) / 500 (error)      [§7.2]
 *   - one primary export per file → max-classes-per-file: 1 (error)  [§7.2]
 *   - no `any` (error), except files under a `boundaries/` subfolder  [§7.2]
 *   - max-lines-per-function 80 (warn)               [§7.2]
 *   - kebab-case filenames (warn)                    [§7.2]
 * Naming (camelCase code / SCREAMING_SNAKE constants / PascalCase types) is enforced
 * loosely so generated code is guided, not blocked.
 */
import tseslint from 'typescript-eslint';

/**
 * Tiny local plugin: the two rules core ESLint can't express as configured.
 * `soft-max-lines` gives the 300-line warning that must coexist with core `max-lines`
 * at 500/error (core ESLint cannot run one rule at two thresholds). `kebab-filename`
 * enforces the kebab-case filename convention.
 */
const vousoir = {
	rules: {
		'soft-max-lines': {
			meta: {
				type: 'suggestion',
				docs: { description: 'Warn when a file grows past the soft cap; a signal to decompose.' },
				schema: [{ type: 'integer', minimum: 1 }],
				messages: { tooLong: 'File has {{count}} lines (soft cap {{limit}}). A file approaching this is a signal to decompose.' },
			},
			create(context) {
				return {
					'Program:exit'(node) {
						const limit = context.options[0] ?? 300;
						const lines = context.sourceCode.lines;
						// A file ending in a newline yields a trailing empty element; core `max-lines`
						// discounts it, so match that or the two tiers disagree by one.
						const count = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
						if (count > limit) {
							context.report({ node, messageId: 'tooLong', data: { count: String(count), limit: String(limit) } });
						}
					},
				};
			},
		},
		'kebab-filename': {
			meta: {
				type: 'suggestion',
				docs: { description: 'Filenames should be kebab-case (work order §7.2).' },
				schema: [],
				messages: { notKebab: 'Filename "{{name}}" is not kebab-case. Use lower-kebab-case for source files.' },
			},
			create(context) {
				return {
					'Program'(node) {
						const full = context.filename.replace(/\\/g, '/');
						const name = full.slice(full.lastIndexOf('/') + 1);
						// Every DOT-SEPARATED SEGMENT must be kebab-case, not just the stem. Conventional
						// secondary extensions are part of the ecosystem's vocabulary (`v6r-init.test.ts`,
						// `vitest.config.mjs`), and an earlier version of this rule rejected them — which
						// would have forced a non-standard `-test.ts` convention on the whole project.
						// Still rejects camelCase/snake_case stems, which is the actual §7.2 requirement.
						const body = name.startsWith('.') ? name.slice(1) : name;
						const segments = body.split('.');
						segments.pop(); // drop the file extension itself
						const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
						if (segments.length === 0 || segments.some((segment) => !kebab.test(segment))) {
							context.report({ node, messageId: 'notKebab', data: { name } });
						}
					},
				};
			},
		},
	},
};

export default tseslint.config(
	{
		// `__ci-fixtures__` holds the work order §9.9 quarantined cross-service-import fixture:
		// deliberately-broken code that a dedicated test in vousoir/boundary-tests points real
		// tooling at on purpose. It must never be swept up by a normal `pnpm run lint`.
		ignores: ['**/dist/**', '**/out/**', '**/node_modules/**', '**/*.d.ts', '**/__ci-fixtures__/**'],
	},
	{
		files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
		languageOptions: {
			parser: tseslint.parser,
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			vousoir,
		},
		rules: {
			'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }],
			'vousoir/soft-max-lines': ['warn', 300],
			'vousoir/kebab-filename': 'warn',
			'max-classes-per-file': ['error', 1],
			'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true }],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/naming-convention': [
				'warn',
				{ selector: 'variableLike', format: ['camelCase', 'PascalCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
				{ selector: 'typeLike', format: ['PascalCase'] },
				{ selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
			],
		},
	},
	{
		// Third-party interop shims may use `any` (work order §7.2). Anything under a
		// `boundaries/` subfolder is the explicitly-marked escape hatch.
		files: ['**/boundaries/**/*.ts', '**/boundaries/**/*.tsx'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
);
