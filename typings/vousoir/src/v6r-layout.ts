/**
 * The `.v6r/` folder layout (work order §8): the per-repo project-data folder every
 * repository used with Vousoir gets at its root. Everything repo-specific lives here so
 * a collaborator cloning the repo sees the full project state with no external database.
 *
 * This is the single source of truth for the layout. `v6rInit()` in @vousoir/shared
 * iterates `V6R_SUBDIRS` rather than hardcoding directory names, so the scaffolded
 * folder can never drift from this spec.
 */

/** The literal directory name every Vousoir-managed repository gets at its root. */
export const V6R_ROOT_DIRNAME = '.v6r' as const;

/** The five subdirectories under `.v6r/`, keyed by their role. */
export const V6R_SUBDIRS = {
	/** Module tree: one .md (YAML frontmatter) node per file, nested folders mirror the hierarchy. */
	spec: 'spec',
	/** Frontend/UX canvases. */
	whiteboards: 'whiteboards',
	/** One JSONL file per agent run: the full event stream (messages, thinking, tool calls, results, diffs). */
	traces: 'traces',
	/** Vousoir-maintained module documentation. */
	docs: 'docs',
	/** SQLite index over specs+traces, layout cache — derived data, regenerable. */
	cache: 'cache',
} as const;

export type V6rSubdirKey = keyof typeof V6R_SUBDIRS;
export type V6rSubdirName = (typeof V6R_SUBDIRS)[V6rSubdirKey];

/** Subdirectories committed to the host repo's git history. */
export const V6R_COMMITTED_SUBDIRS: readonly V6rSubdirKey[] = ['spec', 'whiteboards', 'traces', 'docs'];

/** Subdirectories that hold only derived data and are therefore gitignored. */
export const V6R_GITIGNORED_SUBDIRS: readonly V6rSubdirKey[] = ['cache'];

/** Filename of the `.gitignore` that ships inside every scaffolded `.v6r/`. */
export const V6R_GITIGNORE_FILENAME = '.gitignore' as const;

/** Contents of `.v6r/.gitignore`: ignore only the derived cache. */
export const V6R_GITIGNORE_CONTENTS = `${V6R_SUBDIRS.cache}/\n`;
