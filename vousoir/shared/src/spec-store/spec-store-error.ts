/**
 * The one error the spec store throws.
 *
 * Its whole job is to be actionable: it names the `.md` file at fault in the message
 * itself, so a failure surfaced in the canvas or an output channel tells the user which
 * file to open. Raw zod issue dumps and bare `ENOENT`s are wrapped, never propagated.
 */

/** Extra context attached to a `SpecStoreError`. */
export interface SpecStoreErrorOptions {
	/** Absolute path of the spec file the failure is about, when the failure has one. */
	readonly filePath?: string;
	/** The lower-level error being wrapped, if any. */
	readonly cause?: unknown;
}

/** A spec-store failure, always phrased so the user knows what to do about it. */
export class SpecStoreError extends Error {
	/** The spec file at fault, or `undefined` for whole-directory failures. */
	readonly filePath: string | undefined;

	constructor(message: string, options: SpecStoreErrorOptions = {}) {
		super(options.filePath === undefined ? message : `${options.filePath}\n  ${message}`, { cause: options.cause });
		this.name = 'SpecStoreError';
		this.filePath = options.filePath;
	}
}
