/**
 * The `*.v6r` project manifest — the file the canvas editor binds to (ADR-002).
 *
 * **It is a pointer, not the model.** The model is the markdown tree under
 * `.vousoir/spec/`. Opening a `*.v6r` file opens the canvas; the canvas then reads the
 * tree off disk. Putting the model in here would break Portable Spec Files: one opaque
 * document is not hand-editable, and a one-node change would rewrite the whole file.
 *
 * JSON, per the user's ruling on ADR open question 2. It is machine-written config rather
 * than prose, `JSON.parse` needs no dependency, and zod validates a parsed object directly.
 *
 * The `*.v6r` file / `.vousoir/` directory collision that open question 3 worried about is
 * gone: the directory was renamed in M1, so a plain `*.v6r` glob is unambiguous.
 */

import { z } from 'zod';

/** Bumped only on a breaking manifest change; readers refuse a version they do not know. */
export const V6R_MANIFEST_VERSION = 1 as const;

/** Extension of the file the canvas custom editor binds to. */
export const V6R_MANIFEST_EXTENSION = '.v6r' as const;

/** A Vousoir project manifest. */
export const v6rManifestSchema = z.object({
	/** Must equal `V6R_MANIFEST_VERSION`; a mismatch is a clear error, not a guess. */
	version: z.literal(V6R_MANIFEST_VERSION),
	/** Display name for the project. Shown on the canvas; not an identifier. */
	projectName: z.string().min(1),
	/**
	 * Where the module tree lives, relative to the manifest's own directory. Defaults to
	 * `.vousoir/spec` and exists so an unusual layout stays openable rather than
	 * hard-coding the path into the editor.
	 */
	specDir: z.string().min(1).optional(),
});
export type V6rManifest = z.infer<typeof v6rManifestSchema>;
