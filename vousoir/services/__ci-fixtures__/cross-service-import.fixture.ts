// DELIBERATELY BROKEN — quarantined CI fixture. Do NOT "fix" this import.
//
// Proves work order §7.1 / §9.9: a service package may not import another service package —
// services talk over MCP/IPC only, never directly. This file plays the role of a rogue service
// reaching straight into `service-host`'s source, exactly what `no-cross-service-imports` exists
// to reject (mirrors the "dummy-service → service-host" case negative-tested by hand in Phase 1;
// see vousoir/PATCHES.md, "Enforcement proven in Phase 1"). It imports `service-host`, not
// `service-host` itself doing the importing, because the rule's `from` side exempts service-host
// (it alone may import service manifests) — so the violating direction has to originate from a
// non-service-host service. See ../../boundary-tests/src/cross-service-import.test.ts, which
// cruises this file directly and asserts the specific rule name.
//
// Quarantine (three independent layers, so this can never leak into a normal run):
//   1. `!services/__ci-fixtures__` in vousoir/pnpm-workspace.yaml — not a workspace package.
//   2. `**/__ci-fixtures__/**` in vousoir/eslint.config.mjs `ignores` — `pnpm run lint` skips it.
//   3. `-x "(^|/)__ci-fixtures__(/|$)"` on the `dep-check` script in vousoir/package.json — the
//      normal `pnpm run dep-check` excludes it; the dedicated test below does not pass that flag.
//
// `service-host`'s index has no top-level side effects (pure export statements — see its own
// file header), so even an accidental execution of this fixture is inert; only its import graph
// matters, which is all dependency-cruiser ever looks at.
import { SERVICE_HOST_PACKAGE } from '../service-host/src/index.ts';

export { SERVICE_HOST_PACKAGE };
