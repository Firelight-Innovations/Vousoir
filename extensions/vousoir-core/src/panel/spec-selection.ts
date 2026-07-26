/**
 * Which module the spec panel is showing, and where its files live.
 *
 * The canvas and the panel are two separate webviews, so a selection made in one has to
 * cross the extension host to reach the other. This is that seam — a single event, owned
 * by the extension, rather than the two webviews knowing about each other.
 *
 * It carries the repo root alongside the id because the panel is registered once at
 * activation and has no document of its own to derive a workspace from; the canvas does,
 * and it is the one making the selection.
 */

import * as vscode from 'vscode';

/** What the panel should show. `nodeId: null` means nothing is selected. */
export interface SpecSelectionState {
	readonly repoRoot: string;
	readonly nodeId: string | null;
}

/** A one-slot, extension-owned selection with a change event. */
export class SpecSelection {
	readonly #emitter = new vscode.EventEmitter<SpecSelectionState>();
	#state: SpecSelectionState | undefined;

	/** Fires whenever the selection changes, including when it is cleared. */
	readonly onDidChange = this.#emitter.event;

	get current(): SpecSelectionState | undefined {
		return this.#state;
	}

	set(state: SpecSelectionState): void {
		this.#state = state;
		this.#emitter.fire(state);
	}

	/**
	 * Re-announces the current selection. The panel calls this after a save so it redraws
	 * from disk rather than from what it just sent, which is how a rejected or normalised
	 * edit becomes visible instead of being assumed.
	 */
	refresh(): void {
		if (this.#state !== undefined) {
			this.#emitter.fire(this.#state);
		}
	}

	dispose(): void {
		this.#emitter.dispose();
	}
}
