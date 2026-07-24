import * as path from 'node:path';

/**
 * Resolves service-host's process entry, per the spawn convention its own `main.ts` documents in
 * its file header (work-package C couldn't put this in `@vousoir/typings` - it's a *path*, not a
 * type - so it documented the convention directly instead):
 * `<repoRoot>/vousoir/services/service-host/src/main.ts`.
 *
 * Resolved from `vscode.env.appRoot`, not this extension's own install location - appRoot is the
 * one path that, in dev mode, is guaranteed to be the repo root with both `extensions/` and
 * `vousoir/` as siblings.
 *
 * PACKAGING CAVEAT (reported to the team lead, not solved here): this resolution assumes
 * `vousoir/` sits alongside the running app. That's true in dev mode, where this app IS the
 * Vousoir repo. It is NOT guaranteed for an installed/packaged build unless code-oss's own
 * packaging pipeline (`build/gulpfile.vscode.*`) is taught to ship `vousoir/` into the packaged
 * app tree - today it isn't, since `vousoir/` is a Vousoir-layer addition those manifests don't
 * know about.
 */
export function resolveServiceHostEntryPath(appRoot: string): string {
	return path.join(appRoot, 'vousoir', 'services', 'service-host', 'src', 'main.ts');
}
