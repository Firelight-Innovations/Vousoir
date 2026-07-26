/**
 * The module picker both `vousoir.compileWorkOrder` and `vousoir.buildWithClaudeCode` use.
 *
 * Shared rather than copied: two commands offering subtly different pickers for the same
 * tree is the kind of drift nobody notices until one of them sorts differently. It stays
 * in the extension because it is presentation — the canvas replaces it in M2.
 *
 * The list is flattened depth-first and indented by depth, so it reads in the shape of the
 * spec rather than as an alphabetical list. Title is the label, id the description, status
 * the detail; description and detail are both matchable, so typing an id finds a node whose
 * title the user has forgotten.
 */

import * as vscode from 'vscode';
import type { SpecTree, SpecTreeNode } from '@vousoir/typings';

/** A quick-pick entry carrying the spec node it stands for. */
export interface SpecNodePick extends vscode.QuickPickItem {
	readonly nodeId: string;
}

/** Flattens `tree` into quick-pick entries, outermost node first. */
export function toSpecNodePicks(tree: SpecTree): readonly SpecNodePick[] {
	const picks: SpecNodePick[] = [];
	const visit = (node: SpecTreeNode, depth: number): void => {
		const indent = '    '.repeat(depth);
		picks.push({
			label: `${indent}${node.frontmatter.title}`,
			description: node.id,
			detail: `${indent}status: ${node.frontmatter.status}`,
			nodeId: node.id,
		});
		for (const child of node.children) {
			visit(child, depth + 1);
		}
	};
	for (const root of tree.roots) {
		visit(root, 0);
	}
	return picks;
}
