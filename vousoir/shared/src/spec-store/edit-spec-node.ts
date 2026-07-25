/**
 * Applies a panel edit to a node without moving anything between its two homes.
 *
 * **The rule this exists to enforce:** behaviour has a canonical home (the markdown body)
 * and a deprecated one (the `behaviour` frontmatter field), and editing must write back to
 * whichever home the node ALREADY uses. A node authored with the frontmatter field must
 * not silently become a body-node because someone opened the panel and typed — that would
 * rewrite a file the user never asked to restructure, and it would do it invisibly.
 *
 * New behaviour on a node that has neither goes to the body, because the body is canonical
 * for anything written from now on. That is the only case where this picks a home.
 *
 * Pure: node and edit in, node out. Nothing here touches disk.
 */

import type { SpecNode, SpecNodeContract, SpecNodeTestCase } from '@vousoir/typings';

/** A panel edit. Every field is optional; absent means "leave it alone". */
export interface SpecNodeEdit {
	readonly title?: string;
	/** Written to whichever home the node already uses. */
	readonly behaviour?: string;
	readonly contracts?: readonly SpecNodeContract[];
	readonly testCases?: readonly SpecNodeTestCase[];
}

/** Returns `node` with `edit` applied, preserving where its behaviour lives. */
export function editSpecNode(node: SpecNode, edit: SpecNodeEdit): SpecNode {
	const frontmatter = { ...node.frontmatter };
	let body = node.body;

	if (edit.title !== undefined) {
		frontmatter.title = edit.title;
	}
	if (edit.behaviour !== undefined) {
		if (usesFrontmatterBehaviour(node)) {
			// Stay in the deprecated home. Moving the text would be a restructure the user
			// did not ask for, and `resolveSpecNodeBehaviour` prefers the body — so a
			// migration here would also silently change which value wins.
			frontmatter.behaviour = edit.behaviour;
		} else {
			body = normaliseBody(edit.behaviour);
		}
	}
	if (edit.contracts !== undefined) {
		frontmatter.contracts = [...edit.contracts];
	}
	if (edit.testCases !== undefined) {
		frontmatter.testCases = [...edit.testCases];
	}

	return { ...node, frontmatter, body };
}

/**
 * True when the node's behaviour lives in frontmatter — that is, the field has text and
 * the body does not. A node with both is a body-node, because the body already wins.
 */
export function usesFrontmatterBehaviour(node: SpecNode): boolean {
	return node.body.trim().length === 0 && (node.frontmatter.behaviour ?? '').trim().length > 0;
}

/** Bodies end in exactly one newline, so a save never churns the trailing whitespace. */
function normaliseBody(text: string): string {
	const trimmed = text.replace(/\s+$/, '');
	return trimmed.length === 0 ? '' : `${trimmed}\n`;
}
