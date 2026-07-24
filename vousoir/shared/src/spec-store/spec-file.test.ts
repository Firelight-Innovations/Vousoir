/**
 * Round-trip fidelity of one `.md` spec file. This is the property Portable Spec Files
 * rests on: Vousoir must be able to open a file the user wrote by hand and put it back
 * exactly as it found it, or the "canvas is a convenience, not a cage" promise is false
 * and every save produces a whole-file git diff.
 */

import { describe, expect, it } from 'vitest';
import { parseSpecFile, renderSpecFile } from './spec-file.ts';
import { SpecStoreError } from './spec-store-error.ts';

const PATH = '/repo/.vousoir/spec/alpha.md';
const HEADER = ['id: alpha', 'title: Alpha', 'parent: null', 'status: specified'].join('\n');
const SOURCE = `---\n${HEADER}\n---\n\nAlpha does one thing, and says so here.\n`;

describe('parseSpecFile / renderSpecFile', () => {
	it('renders an unchanged file back byte-identically', () => {
		const file = parseSpecFile(PATH, SOURCE);
		expect(renderSpecFile(file.node, file)).toBe(SOURCE);
	});

	it('preserves CRLF line endings', () => {
		const crlf = SOURCE.replace(/\n/g, '\r\n');
		const file = parseSpecFile(PATH, crlf);
		expect(file.node.frontmatter.title).toBe('Alpha');
		expect(renderSpecFile(file.node, file)).toBe(crlf);
	});

	it('preserves a closing delimiter with no trailing newline', () => {
		const noTrailer = `---\n${HEADER}\n---`;
		const file = parseSpecFile(PATH, noTrailer);
		expect(file.node.body).toBe('');
		expect(renderSpecFile(file.node, file)).toBe(noTrailer);
	});

	it('keeps the markdown body verbatim, delimiter lookalikes included', () => {
		// The closing `---` line owns its own newline, so the body starts on the line after it.
		const body = 'Some prose.\n\n```\n---\nnot frontmatter\n---\n```\n';
		const source = `---\n${HEADER}\n---\n${body}`;
		const file = parseSpecFile(PATH, source);
		expect(file.node.body).toBe(body);
		expect(renderSpecFile(file.node, file)).toBe(source);
	});

	it('edits one key and leaves the rest of the header, comments included, untouched', () => {
		const commented = `---\n# Hand-written; must survive.\n${HEADER}\n---\n\nBody.\n`;
		const file = parseSpecFile(PATH, commented);
		const rendered = renderSpecFile(
			{ frontmatter: { ...file.node.frontmatter, title: 'Renamed' }, body: file.node.body },
			file,
		);
		expect(rendered).toContain('# Hand-written; must survive.');
		expect(rendered).toContain('title: Renamed');
		expect(rendered).toContain('status: specified');
		expect(rendered).not.toContain('title: Alpha');
	});

	it('does not re-wrap a long value onto continuation lines', () => {
		const behaviour = 'Accepts a spec node and returns the exact bytes it should occupy on disk, '
			+ 'without re-wrapping, re-quoting or re-ordering anything the user wrote.';
		const rendered = renderSpecFile({
			frontmatter: { id: 'alpha', title: 'Alpha', parent: null, status: 'specified', behaviour },
			body: '',
		});
		expect(rendered).toContain(behaviour);
		expect(parseSpecFile(PATH, rendered).node.frontmatter.behaviour).toBe(behaviour);
	});

	it('writes a new file in schema key order and drops absent optional fields', () => {
		const rendered = renderSpecFile({
			frontmatter: { id: 'alpha', title: 'Alpha', parent: null, status: 'unspecified' },
			body: '',
		});
		expect(rendered).toBe('---\nid: alpha\ntitle: Alpha\nparent: null\nstatus: unspecified\n---\n');
	});
});

describe('parseSpecFile error reporting', () => {
	it('names the file when there is no frontmatter at all', () => {
		expect(() => parseSpecFile(PATH, '# Just markdown\n')).toThrow(SpecStoreError);
		expect(() => parseSpecFile(PATH, '# Just markdown\n')).toThrow(/alpha\.md[\s\S]*`---` frontmatter delimiter/);
	});

	it('names the file when the frontmatter is never closed', () => {
		expect(() => parseSpecFile(PATH, `---\n${HEADER}\n`)).toThrow(/alpha\.md[\s\S]*never closed/);
	});

	it('names the file and the broken field, not a raw zod dump', () => {
		const bad = `---\nid: alpha\ntitle: Alpha\nparent: null\nstatus: halfway\n---\n`;
		expect(() => parseSpecFile(PATH, bad)).toThrow(/alpha\.md[\s\S]*- status:/);
	});

	it('reports unparseable YAML as such', () => {
		expect(() => parseSpecFile(PATH, '---\nid: [unclosed\n---\n')).toThrow(/could not be parsed/);
	});
});
