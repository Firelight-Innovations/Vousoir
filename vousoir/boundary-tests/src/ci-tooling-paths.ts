/**
 * Filesystem locations the boundary/lint fixture tests need: the repo root (where
 * `.dependency-cruiser.cjs` lives and where `pnpm run dep-check` / `lint` are invoked from), the
 * Vousoir workspace root (where the real toolchain binaries are installed), and the
 * platform-correct path to each CLI binary. Centralized here so no fixture test re-derives them.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_FILE_DIR = dirname(fileURLToPath(import.meta.url)); // .../vousoir/boundary-tests/src

/** vousoir/boundary-tests */
export const PACKAGE_ROOT = dirname(THIS_FILE_DIR);

/** vousoir/vousoir — the pnpm workspace root, where the toolchain devDependencies are installed. */
export const WORKSPACE_ROOT = dirname(PACKAGE_ROOT);

/** repo root — where .dependency-cruiser.cjs lives and dep-check/lint scripts `cd` to. */
export const REPO_ROOT = dirname(WORKSPACE_ROOT);

function binPath(name: string): string {
	const bin = process.platform === 'win32' ? `${name}.CMD` : name;
	return join(WORKSPACE_ROOT, 'node_modules', '.bin', bin);
}

/** Absolute path to the real eslint binary this workspace already installed — no new deps. */
export const ESLINT_BIN = binPath('eslint');

/** Absolute path to the real dependency-cruiser binary this workspace already installed. */
export const DEPCRUISE_BIN = binPath('depcruise');
