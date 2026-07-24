/**
 * Renders a work order to markdown.
 *
 * Two rules shape every decision in here.
 *
 * **Self-contained.** The output references no other file and contains no links. An agent
 * receives this text and nothing else, so anything it needs is inline or it does not exist.
 *
 * **No implementation detail, ever.** Behaviour, contracts and test cases describe what
 * crosses a boundary. If a section here starts describing HOW a module works inside, that
 * is the one thing the product refuses to do — stop and take it out.
 *
 * Empty sections are handled asymmetrically, on purpose. The node's OWN contracts and test
 * cases always render, saying so explicitly when there are none, because "this module
 * declares no contracts" is load-bearing for an implementer and silence reads as a bug.
 * Context sections — ancestors, neighbours — are omitted entirely when empty, because an
 * empty heading is noise.
 */

import { stringify } from 'yaml';
import type { SpecNode, SpecNodeTestCase } from '@vousoir/typings';
import { resolveSpecNodeBehaviour, resolveSpecNodeContracts } from '../spec-store/resolve-spec-node.ts';
import type { WorkOrderContext, WorkOrderNeighbourContract, WorkOrderNeighbourRelation } from './work-order-context.ts';

/** `lineWidth: 0` disables folding — a long title must not be re-wrapped into the header. */
const YAML_OPTIONS = { lineWidth: 0 } as const;

const RELATION_LABEL: Record<WorkOrderNeighbourRelation, string> = {
	parent: 'Parent',
	sibling: 'Sibling',
	child: 'Child',
};

/**
 * Renders the complete work order markdown for `node`.
 *
 * The result is normalised to LF. Behaviour and contract bodies are embedded verbatim from
 * the spec files, and on Windows those arrive CRLF while the template's own joins are LF —
 * so without this a work order would carry mixed line endings, and identical trees would
 * compile to different bytes depending on how the repo happened to be checked out. A
 * compiled artefact gets one canonical form; the round-trip fidelity that preserves a
 * user's own line endings belongs to the spec store, not here.
 */
export function renderWorkOrder(node: SpecNode, context: WorkOrderContext): string {
	const sections = [
		renderInstructions(node),
		renderModule(node),
		renderAncestors(context),
		renderNeighbours(context),
	].filter((section): section is string => section !== undefined);
	return `${renderFrontmatter(node)}${sections.join('\n\n')}\n`.replace(/\r\n?/g, '\n');
}

/**
 * The traceability stamp lives here as structured data, not interpolated text, so an id
 * containing a colon, a leading dash or any other YAML metacharacter is quoted correctly
 * rather than producing a header that silently fails to parse.
 */
function renderFrontmatter(node: SpecNode): string {
	const header = stringify(
		{ 'v6r-node': node.id, 'v6r-title': node.frontmatter.title, 'v6r-status': node.frontmatter.status },
		YAML_OPTIONS,
	);
	return `---\n${header}---\n\n`;
}

function renderInstructions(node: SpecNode): string {
	return [
		`# Work order — ${node.frontmatter.title}`,
		'',
		'## How to use this work order',
		'',
		'This is the complete specification for one module. It is self-contained: everything you need',
		'is below, and there is no other file to open.',
		'',
		`**Stamp \`v6r-node: ${node.id}\` into every file you create or modify for this work order.**`,
		'Put it in a comment at the top of the file, in whatever comment syntax that language uses.',
		'This is a hard requirement, not a nicety: Vousoir guarantees that generated code traces back',
		'to the spec node that produced it, and that guarantee is only true if the marker is present.',
		'',
		'- **Implement only this module.** Later sections describe other modules so you can call them',
		'  correctly. Do not modify them.',
		'- **The contracts and test cases are the requirement.** Satisfy every contract and make every',
		'  test case pass. How you do that inside this module is entirely your decision.',
	].join('\n');
}

function renderModule(node: SpecNode): string {
	const behaviour = resolveSpecNodeBehaviour(node);
	return [
		`## Module — ${node.frontmatter.title}`,
		'',
		`**Status:** ${node.frontmatter.status}`,
		'',
		'### Behaviour',
		'',
		behaviour ?? '_No behaviour has been written for this node yet._',
		'',
		renderOwnContracts(node),
		'',
		renderTestCases(node.frontmatter.testCases ?? []),
	].join('\n');
}

function renderOwnContracts(node: SpecNode): string {
	const { typed, legacy } = resolveSpecNodeContracts(node.frontmatter);
	const lines = ['### Contracts', ''];
	if (typed.length > 0) {
		lines.push(typed.map((contract) => `#### ${contract.name} — \`${contract.kind}\`\n\n${bodyOrPlaceholder(contract.body)}`).join('\n\n'));
	} else if (legacy !== undefined) {
		lines.push('_Declared with the deprecated free-form `contract` field, so it carries no kind._', '', legacy);
	} else {
		lines.push('_This module declares no contracts._');
	}
	return lines.join('\n');
}

function renderTestCases(testCases: readonly SpecNodeTestCase[]): string {
	const lines = ['### Test cases', ''];
	if (testCases.length === 0) {
		lines.push('_This module declares no test cases._');
		return lines.join('\n');
	}
	lines.push(testCases.map(renderTestCase).join('\n\n'));
	return lines.join('\n');
}

function renderTestCase(testCase: SpecNodeTestCase): string {
	const lines = [`#### ${testCase.id} — ${testCase.description}`, ''];
	const clauses: string[] = [];
	if (testCase.given !== undefined) {
		clauses.push(`- **Given:** ${testCase.given}`);
	}
	if (testCase.when !== undefined) {
		clauses.push(`- **When:** ${testCase.when}`);
	}
	if (testCase.then !== undefined) {
		clauses.push(`- **Then:** ${testCase.then}`);
	}
	clauses.push(`- **Expected:** ${testCase.expected}`);
	lines.push(clauses.join('\n'));
	if (testCase.snippet !== undefined) {
		lines.push('', fence(testCase.snippet));
	}
	return lines.join('\n');
}

function renderAncestors(context: WorkOrderContext): string | undefined {
	if (context.ancestors.length === 0) {
		return undefined;
	}
	const entries = context.ancestors.map((ancestor, index) => {
		const summary = ancestor.summary === undefined ? '' : ` — ${ancestor.summary}`;
		return `${index + 1}. **${ancestor.title}** (\`${ancestor.id}\`)${summary}`;
	});
	return [
		'## Where this module sits',
		'',
		'The modules this one nests inside, outermost first. One paragraph of orientation each —',
		'deliberately not their full specifications.',
		'',
		entries.join('\n'),
	].join('\n');
}

function renderNeighbours(context: WorkOrderContext): string | undefined {
	if (context.neighbours.length === 0) {
		return undefined;
	}
	return [
		'## Neighbouring contracts',
		'',
		'The boundaries of the modules around this one — their edges, not their substance. You are',
		'given what crosses their boundary and nothing about how they work inside. Call them through',
		'these contracts; do not implement or modify them.',
		'',
		context.neighbours.map(renderNeighbourContract).join('\n\n'),
	].join('\n');
}

function renderNeighbourContract(contract: WorkOrderNeighbourContract): string {
	const label = `${RELATION_LABEL[contract.relation]} — ${contract.nodeTitle} (\`${contract.nodeId}\`)`;
	const heading = contract.name === undefined
		? `### ${label}`
		: `### ${label} · ${contract.name} — \`${contract.kind ?? 'untyped'}\``;
	const preamble = contract.name === undefined
		? '\n_Declared with the deprecated free-form `contract` field, so it carries no kind._\n'
		: '';
	return `${heading}\n${preamble}\n${bodyOrPlaceholder(contract.body)}`;
}

function bodyOrPlaceholder(body: string): string {
	return body.trim().length > 0 ? body.trimEnd() : '_Named, but not yet written._';
}

/** Fences `content` with a run of backticks longer than any run inside it. */
function fence(content: string): string {
	const longest = [...content.matchAll(/`+/g)].reduce((max, match) => Math.max(max, match[0].length), 0);
	const ticks = '`'.repeat(Math.max(3, longest + 1));
	return `${ticks}\n${content.trimEnd()}\n${ticks}`;
}
