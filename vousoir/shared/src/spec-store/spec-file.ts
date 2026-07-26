/**
 * The `.md` envelope of one spec node: `---` YAML header `---` then a free-form markdown
 * body. `parseSpecFile` and `renderSpecFile` are exact inverses — that round-trip is what
 * makes Portable Spec Files (source-of-truth Feature 10) real rather than aspirational,
 * and it is what keeps git diffs to the lines the user actually changed.
 *
 * Three things preserve fidelity:
 *   1. The delimiter lines are captured verbatim, so a CRLF file stays CRLF.
 *   2. The YAML header is kept as its original TEXT and reused byte-for-byte when the
 *      frontmatter has not changed.
 *   3. When it HAS changed, the parsed `yaml` Document is edited key-by-key rather than
 *      re-serialised from scratch, so comments, quoting style and key order survive.
 */

import { parseDocument, Document, type DocumentOptions, type ParseOptions, type ToStringOptions } from 'yaml';
import { specNodeFrontmatterSchema, type SpecNode, type SpecNodeFrontmatter } from '@vousoir/typings';
import type { ZodError } from 'zod';
import { SpecStoreError } from './spec-store-error.ts';

/**
 * `lineWidth: 0` disables line folding. Without it `yaml` re-wraps any string past ~80
 * columns, which silently rewrites a long behaviour or contract body on every save.
 */
const YAML_TO_STRING_OPTIONS: ToStringOptions = { lineWidth: 0 };
const YAML_PARSE_OPTIONS: DocumentOptions & ParseOptions = { keepSourceTokens: false };

/** Schema declaration order, so a newly written file always lays its keys out the same way. */
const FRONTMATTER_KEY_ORDER: readonly string[] = Object.keys(specNodeFrontmatterSchema.shape);

/** A parsed spec file, plus the raw text needed to write it back unchanged. */
export interface SpecFile {
	readonly node: SpecNode;
	/** The YAML header exactly as it appeared, between the delimiters. */
	readonly yamlText: string;
	/** The opening `---` line, including its newline. */
	readonly openDelimiter: string;
	/** The closing `---` line, including its newline (absent at end-of-file). */
	readonly closeDelimiter: string;
}

/** Parses one spec file's raw text. Throws `SpecStoreError` naming `filePath` on any fault. */
export function parseSpecFile(filePath: string, raw: string): SpecFile {
	const envelope = splitEnvelope(filePath, raw);
	const document = parseDocument(envelope.yamlText, YAML_PARSE_OPTIONS);
	const [firstError] = document.errors;
	if (firstError !== undefined) {
		throw new SpecStoreError(`the YAML frontmatter could not be parsed: ${firstError.message}`, { filePath });
	}

	const parsed = specNodeFrontmatterSchema.safeParse(document.toJS() as unknown);
	if (!parsed.success) {
		throw new SpecStoreError(`the YAML frontmatter is not a valid spec node:\n${describeIssues(parsed.error)}`, { filePath });
	}

	return {
		node: { id: parsed.data.id, filePath, frontmatter: parsed.data, body: envelope.body },
		yamlText: envelope.yamlText,
		openDelimiter: envelope.openDelimiter,
		closeDelimiter: envelope.closeDelimiter,
	};
}

/**
 * Renders the exact bytes a node should occupy on disk.
 *
 * Pass `previous` when the node came from disk: an unchanged frontmatter is then written
 * back as its original text, so `parseSpecFile` → `renderSpecFile` is byte-identical.
 * Omit it for a node being created, which gets canonical key order and no comments.
 */
export function renderSpecFile(node: Pick<SpecNode, 'frontmatter' | 'body'>, previous?: SpecFile): string {
	if (previous === undefined) {
		const document = new Document(orderedFrontmatter(node.frontmatter));
		return `---\n${document.toString(YAML_TO_STRING_OPTIONS)}---\n${node.body}`;
	}
	const yamlText = renderYamlHeader(previous, node.frontmatter);
	return `${previous.openDelimiter}${yamlText}${previous.closeDelimiter}${node.body}`;
}

/** Re-serialises the header only if `next` differs from what `previous` holds. */
function renderYamlHeader(previous: SpecFile, next: SpecNodeFrontmatter): string {
	const current = previous.node.frontmatter as unknown as Record<string, unknown>;
	const wanted = next as unknown as Record<string, unknown>;
	const changedKeys = FRONTMATTER_KEY_ORDER.filter((key) => canonicalise(current[key]) !== canonicalise(wanted[key]));
	if (changedKeys.length === 0) {
		return previous.yamlText;
	}

	const document = parseDocument(previous.yamlText, YAML_PARSE_OPTIONS);
	for (const key of changedKeys) {
		const value = wanted[key];
		if (value === undefined) {
			document.delete(key);
		} else {
			document.set(key, value);
		}
	}
	return document.toString(YAML_TO_STRING_OPTIONS);
}

/** Frontmatter as a plain object in schema order, with absent optional fields dropped. */
function orderedFrontmatter(frontmatter: SpecNodeFrontmatter): Record<string, unknown> {
	const source = frontmatter as unknown as Record<string, unknown>;
	const ordered: Record<string, unknown> = {};
	for (const key of FRONTMATTER_KEY_ORDER) {
		const value = source[key];
		// `parent: null` is meaningful (the tree root) and must survive; `undefined` is not.
		if (value !== undefined) {
			ordered[key] = value;
		}
	}
	return ordered;
}

/** Key-order-insensitive structural comparison, so a reordered object is not a change. */
function canonicalise(value: unknown): string {
	return JSON.stringify(value, (_key, nested: unknown) => {
		if (nested === null || typeof nested !== 'object' || Array.isArray(nested)) {
			return nested;
		}
		const record = nested as Record<string, unknown>;
		return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
	}) ?? 'undefined';
}

/** Turns zod issues into a readable list instead of a raw error dump. */
function describeIssues(error: ZodError): string {
	return error.issues
		.map((issue) => `  - ${issue.path.length > 0 ? issue.path.join('.') : '(document root)'}: ${issue.message}`)
		.join('\n');
}

interface SpecFileEnvelope {
	readonly openDelimiter: string;
	readonly yamlText: string;
	readonly closeDelimiter: string;
	readonly body: string;
}

/**
 * Splits `---`-delimited frontmatter from the markdown body. Concatenating the four
 * pieces reproduces `raw` exactly — that is the property the round trip rests on.
 */
function splitEnvelope(filePath: string, raw: string): SpecFileEnvelope {
	const open = /^---[ \t]*\r?\n/.exec(raw);
	if (open === null) {
		throw new SpecStoreError('the file does not start with a `---` frontmatter delimiter.', { filePath });
	}
	const openDelimiter = open[0];

	// `\r?\n` is tried before `$` so a delimiter line consumes its own newline; `$` only
	// wins for a closing `---` at end-of-file with no trailing newline.
	const closeMatcher = /^---[ \t]*(?:\r?\n|$)/gm;
	closeMatcher.lastIndex = openDelimiter.length;
	const close = closeMatcher.exec(raw);
	if (close === null) {
		throw new SpecStoreError('the frontmatter is never closed by a second `---` line.', { filePath });
	}

	return {
		openDelimiter,
		yamlText: raw.slice(openDelimiter.length, close.index),
		closeDelimiter: close[0],
		body: raw.slice(close.index + close[0].length),
	};
}
