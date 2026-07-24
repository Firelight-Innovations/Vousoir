/**
 * @vousoir/shared — public surface.
 *
 * Shared runtime utilities for the Vousoir layer. Types belong in @vousoir/typings;
 * only runtime helpers live here. Its first real inhabitant is v6rInit(), which
 * scaffolds a well-formed `.v6r/` folder (work order §8, work-package D).
 */

export { v6rInit } from './v6r-init.ts';
export type { V6rInitOptions, V6rInitResult } from './v6r-init.ts';
