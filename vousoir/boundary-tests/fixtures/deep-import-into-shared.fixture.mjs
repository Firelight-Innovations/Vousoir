// DELIBERATELY BROKEN — quarantined CI fixture. Do NOT "fix" this import.
//
// Proves work order §6.3 / §9.9: a deep import into a sealed Vousoir package must fail at real
// module resolution. @vousoir/shared's package.json `exports` field maps only "." (its public
// surface) to ./src/index.ts; reaching past that seal into an internal path must be rejected by
// Node's resolver with ERR_PACKAGE_PATH_NOT_EXPORTED — this is Node-enforced sealing, not a lint
// convention. See ../src/deep-import-seal.test.ts, which runs *this exact file* as a real `node`
// child process (bypassing any bundler/test-runner module loader) and asserts on that error code.
//
// Quarantine: this file is plain JS (not lint/typecheck/dep-check surface at all) and lives in
// vousoir/boundary-tests/fixtures/, a path none of `pnpm run lint` / `dep-check` / `typecheck`
// ever scans (see vousoir/package.json and boundary-tests/tsconfig.json). It is never statically
// imported by real source — only spawned as a subprocess by the test above.
import '@vousoir/shared/src/index.ts';
