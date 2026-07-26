/**
 * Dispatching a compiled work order to a coding agent (source-of-truth Feature 5).
 *
 * Run status is **transient**. It describes one execution of one agent, lives in memory,
 * and is emitted as events — it is never written into a spec file. The frontmatter
 * `status` enum happens to contain `building`/`built`, which makes conflating the two
 * tempting, but a crashed or cancelled run would then leave `building` stuck in a
 * COMMITTED file with no way to tell it is stale. What survives a run is the JSONL trace
 * under `.vousoir/traces/`, which is a record of what happened rather than a claim about
 * what is true now.
 */

/** Lifecycle of one dispatch. `idle` is the state before the child is spawned. */
export type DispatchRunStatus = 'idle' | 'running' | 'done' | 'failed';

/** What the caller learns while a run is in flight. */
export type DispatchEvent =
	| {
			readonly kind: 'status';
			readonly status: DispatchRunStatus;
			/** Human-readable reason, present on `failed` and on terminal transitions. */
			readonly detail: string | undefined;
	  }
	| {
			readonly kind: 'output';
			readonly stream: 'stdout' | 'stderr';
			/** One line, newline stripped. Suitable for an output channel verbatim. */
			readonly text: string;
	  };

/** The outcome of a finished run. A run always reaches exactly one of these. */
export interface DispatchRunResult {
	readonly runId: string;
	readonly nodeId: string;
	/** `done` only on a clean zero exit that was not cancelled. */
	readonly status: 'done' | 'failed';
	/** `null` when the child was killed by a signal or never started. */
	readonly exitCode: number | null;
	readonly cancelled: boolean;
	/** Absolute path of the JSONL trace, written whether the run succeeded or not. */
	readonly tracePath: string;
	/** Actionable failure text; `undefined` when `status` is `done`. */
	readonly failure: string | undefined;
}
