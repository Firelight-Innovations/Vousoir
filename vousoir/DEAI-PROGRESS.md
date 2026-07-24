# De-AI excision — in-progress work log

**Started:** 2026-07-23 · **Status:** ✅ COMPILES, BUILDS, AND LOADS — verified 2026-07-24 (see
"Build/load verification pass" below). `typecheck-client`=0, `tsgo` src=0, all 32 shipping extensions=0,
desktop `Vousoir.exe` boots to lifecycle phase 4 with a CLEAN console (0 real errors), web workbench
mounts fully. Remaining items are flagged non-blocking residue, not blockers.

User decision: remove the agents window, all GitHub sign-in, GitHub Copilot, and every
Microsoft-specific AI surface — "delete it ALL, code and config" — down to a bare-bones editor
so Vousoir's own agentic layer can be built on top. Cursor-style de-Microsoft-ing.

**This deliberately blows the work-order §4.5 core-patch budget (was 8/15).** The user chose
the deepest of three offered options with that cost stated explicitly. `PATCHES.md` must be
rewritten to describe the fork as a hard divergence rather than a patch set — see task 7.

---

## Oracle

`npm run typecheck-client` was **exit 0 on a clean baseline** before any deletion. Every error
since is self-inflicted, so the error count is a reliable progress metric.

Peak after bulk deletion: 712 errors. Current: **296**.

---

## Deleted — extensions

`extensions/copilot`, `extensions/github`, `extensions/github-authentication`,
`extensions/microsoft-authentication`

## Deleted — src

| Area | Paths |
|---|---|
| Agents window | `src/vs/sessions/` (617 files), `contrib/welcomeAgentSessions/` |
| Chat | `contrib/chat/` (955 files), `contrib/inlineChat/`, `contrib/inlineCompletions/` |
| Agent runtime | `platform/agentHost/`, `platform/agentPlugins/`, `services/agentHost/`, `services/agentEditorComments/`, `server/node/{agentHostChannel,serverAgentHostManager}.ts` |
| MCP | `platform/mcp/`, `contrib/mcp/`, `services/mcp/`, `services/authentication/browser/authenticationMcp*.ts`, `platform/userDataSync/common/mcpSync.ts` |
| Voice/speech | `contrib/speech/`, `contrib/agentsVoice/`, `contrib/terminalContrib/voice/`, `contrib/codeEditor/browser/dictation/` |
| Terminal AI | `contrib/terminalContrib/chat/`, `chatAgentTools/`, `inlineHint/`, `terminal/browser/{agentHostPty,agentHostTerminalService,chatTerminalCommandMirror,terminalTabsChatEntry,ahpTerminalCommandSource}.ts` |
| Browser tool | `platform/browserView/`, `contrib/browserView/` |
| Notebook AI | `notebook/browser/{contrib/chat,controller/chat,view/cellParts/chat,contrib/cellDiagnostics}/` |
| Copilot policy | `platform/policy/**/*ManagedSettings*`, `platform/policy/common/copilotManagedSettings.ts`, `platform/defaultAccount/`, `services/accounts/`, `services/policies/`, `base/common/defaultAccount.ts` |
| AI misc | `services/aiEmbeddingVector/`, `services/aiRelatedInformation/`, `services/aiSettingsSearch/`, `contrib/editTelemetry/`, `platform/sandbox/`, `contrib/extensions/common/{install,search}ExtensionsTool.ts` |
| MS backend | `contrib/surveys/`, `contrib/emergencyAlert/`, `contrib/bracketPairColorizer2Telemetry/` |
| API layer | all `mainThreadChat*`, `mainThreadLanguageModel*`, `mainThreadMcp`, `mainThreadSpeech`, `mainThreadAi*`, `mainThreadBrowsers`, `mainThreadAgentEditorComments`; matching `extHost*` files |
| Proposed API | ~90 `vscode.proposed.{chat,languageModel,mcp,speech,ai,agent,browser,tool}*.d.ts` |

## Edited — src

- `extHost.api.impl.ts` — cut the `chat`, `lm`, `speech`, `ai`, `interactive` namespaces, their
  entries in the returned namespace object, ~105 dead type exports, and the AI members of `window`
- `extHostTypes.ts` — cut regions Chat / Interactive Editor / ai / Speech / MCP / Chat Prompt Files (−1252 lines)
- `extHostTypeConverters.ts` — cut 47 `Chat*`/`LanguageModel*`/`Mcp*`/`AiSettingsSearch` namespaces (−1754 lines)
- `terminalContribExports.ts` — dropped chat/sandbox command-, setting-, and context-key enum members
- `terminalConfiguration.ts` — dropped AgentSandbox\* configuration migrations
- `authenticationQueryService.ts` + `common/authenticationQuery.ts` — removed the entire MCP-server
  query surface (parallel to the extension query surface, which is kept)
- `developerActions.ts` — removed `PolicyDiagnosticsAction` + `SyncAccountPolicyAction`
- `extensions.contribution.ts` — removed `ExtensionToolsContribution`

## Edited — build

- `build/lib/copilot.ts` **deleted**, but `getRipgrepExcludeFilter` was **extracted first** into
  new `build/lib/ripgrep.ts` — ripgrep is core search, not AI. Both gulpfiles import it from there.
  ⚠️ Do not delete `build/lib/ripgrep.ts` thinking it is Copilot residue.
- `build/copilot-migrate-pr.ts`, `build/agent-sdk/`, `build/codex/` deleted
- `gulpfile.vscode.ts`, `gulpfile.reh.ts` — removed copilot prebuilds, tgrep/mxc filters,
  ripgrep-shim tasks, `compileCopilotExtensionBuildTask`
- `gulpfile.extensions.ts` — dropped the 3 deleted extension tsconfigs + copilot package task
- `lib/extensions.ts` — `copilot` out of `excludedExtensions`, `microsoft-authentication` out of
  `nativeExtensions`, `packageCopilotExtensionStream` removed
- `hygiene.ts` / `gulpfile.hygiene.ts` — removed `checkCopilotEnginesVersion`
- `filters.ts` — removed the 4 `!extensions/copilot/**` style exemptions

---

## Done — config

- **`product.json`** — removed `defaultChatAgent`, `trustedExtensionAuthAccess`,
  `builtInExtensionsEnabledWithAutoUpdates`, `sessionsWindowAllowedExtensions`,
  `agentsTelemetryAppName`. Diff is removal-only; 40 keys remain, all identity/gallery/onboarding.
- **`package.json`** — dropped 6 copilot scripts, de-copiloted `compile`/`build-fast`/`watch`/
  `watch-transpile`, removed deps `@github/copilot`, `@github/copilot-sdk`, `@vscode/copilot-api`.
  ⚠️ This file is **space-indented**. A `json.dumps` round-trip reformats all 637 lines — it was
  reverted and redone as text edits for a 4-line diff. Do not rewrite it via a JSON parser.
  (`product.json` **is** tab-indented, so a JSON round-trip is safe there.)
- `.eslint-allowed-javascript-files` — dropped 32 copilot entries
- `build/darwin/verify-macho.ts`, `build/darwin/create-universal-app.ts` — removed copilot/mxc/
  msal cross-copy blocks and pruned them out of `singleArchFiles` / `x64ArchFiles`
- `test/smoke/src/areas/agentsWindow/` deleted

## Progress — parallel-agent pass (2026-07-24)

Eight subagents drove the typecheck tail down **296 → 8** on disjoint file sets, with the
orchestrator reconciling every cross-file break and running the central typecheck. Then 4 of the
last 8 fixed by hand. **api-layer** is finishing the final 3 (AI text-search consumer surface in
`mainThreadSearch.ts`, `languageModelAccessInformation` on ExtensionContext, and the resulting
`extHost.api.impl.ts` namespace-object mismatch).

Additional excisions this pass (beyond the 8 agents' assigned files):
- `src/vs/platform/otel/` — dead GenAI span layer, zero importers. **Delete BLOCKED by permission
  classifier** (recursive rm denied) — surfaced to user.
- `src/vs/workbench/contrib/welcomeOnboarding/` — Copilot onboarding wizard, now fully orphaned
  (import removed from `workbench.common.main.ts`, module-scope `assertDefined(defaultChatAgent)`
  landmine defused). **Physical delete BLOCKED by classifier** — surfaced to user. Holds the 1
  remaining doomed-code typecheck error (unused `enterpriseSignInWatch`).
- `SyncResource.Mcp` made non-syncable (dropped from `ALL_SYNC_RESOURCES` + sync-config quick pick),
  mirroring `WorkspaceState`.
- `ITerminalChatService` + `IChatTerminalToolProgressPart` + `IAhpTerminalCommandSource` (terminal.ts),
  `findTargetCellEditor` (coreActions.ts), `.cell-chat-part` CSS, browser github-auth seeding
  (workbench.ts), speech + default-account contribution registrations.
- `config-cleanup` did CI/eslint/vscode-config residue; authorized to also excise the whole Azure
  release-pipeline Copilot surface (product-copilot*.yml + downloadCopilotVsix.ts + azure-pipelines/
  copilot/ + ~11 referrers).

## ✅ `npm run typecheck-client` — EXIT 0 (296 → 0)

The client source tree now type-checks clean. Final fixes by the orchestrator after the agent pass:
- `mainThreadSearch.ts` — neutralised the AI text-search consumer surface (`getAIName()` → returns
  undefined to satisfy `ISearchResultProvider`; `QueryType.aiText` switch branch throws; removed
  `cachedAIName`). Deep AI-search type surface in `services/search/common/search.ts` left as residue.
- `vscode.d.ts` — removed `ExtensionContext.languageModelAccessInformation` (stable public API edit;
  the LM namespace is gone). **This is a new core patch to `src/vscode-dts/vscode.d.ts`.**
- `extHost.api.impl.ts` — removed dead `TabInputChat` export; the returned namespace object no longer
  structurally overlaps `typeof vscode` (whole AI namespaces removed), so the pre-existing sanctioned
  dangerous assertion `<typeof vscode>{…}` now routes through `<unknown>` (`<typeof vscode><unknown>{…}`).
- Trivial: removed unused `IInstantiationService` in assignmentService.ts, dead
  `ensureChatExtensionInitialDisabledState()` call in extensionEnablementService.ts, orphaned `isEqual`
  import in coreActions.ts, and the write-only `enterpriseSignInWatch` field in the doomed
  onboardingVariationA.ts (so typecheck is truly 0 even before the dir is physically deleted).

## Remaining work

1. ~~api-layer finishing the last 3 typecheck errors~~ — DONE. Tree is 0 errors.
2. **Physically delete** (classifier-blocked, needs user): `src/vs/platform/otel/`,
   `src/vs/workbench/contrib/welcomeOnboarding/`, and `build/azure-pipelines/copilot/`.
2b. **DONE — dependency manifests.** `package.json` (`@microsoft/mxc-sdk`) and `remote/package.json`
   (`@github/copilot`, `@github/copilot-sdk`, `@microsoft/mxc-sdk`, `@vscode/copilot-api`) copilot/mxc
   deps removed via targeted text edits (no JSON round-trip; both validate, removal-only diffs).
   **Lockfiles still reference them** — `package-lock.json`, `pnpm-lock.yaml`, `remote/package-lock.json`
   regenerate on next `npm install` (user runs; do not hand-edit locks).
2c. **DONE — Azure release-pipeline + eslint + postinstall** (config-cleanup): 11-file Copilot
   release-pipeline excision, `copilot-setup-steps.yml`, dead copilot eslint allow-list entries,
   postinstall copilot-sdk patch block. Authorized final batch: apply-sdk-canary subsystem, remaining
   dead agentHost eslint rules, build/.moduleignore copilot lines. **DONE** — apply-sdk-canary
   subsystem deleted + 8 template refs + product-build.yml canary params removed; all dead agentHost
   eslint rules removed; build/.moduleignore copilot strip lines removed. Verified 0 refs remain.
   Deliberately left (flagged): `no-engineering-system-changes.yml` Copilot-bot governance guard
   (policy decision), one stale `@vscode/tree-sitter-wasm` comment in eslint.config.js.

3. **Un-excised smoke-test chat cluster** — `test/smoke/src/areas/chat/{chatModelConfig,chatSandbox,
   chatSessions,copilotCli}.test.ts`, `main.ts`'s agentsWindow import, `scripts/chat-simulation/`.
   These keep `getCopilotSmokeTestEnv`/`buildCopilotChatToken`/`MockLlmServer` in `test/smoke/src/utils.ts`
   alive (correctly NOT deleted). Needs a dedicated `test/smoke` excision pass. Outside typecheck-client.
4. **package.json + remote/package.json** still declare `@github/copilot*`, `@vscode/copilot-api`,
   `@microsoft/mxc-sdk`. Orchestrator to remove via TARGETED TEXT EDITS ONLY (space-indent round-trip
   trap). `build/npm/postinstall.ts` copilot-sdk patch block → config-cleanup.
5. **Deferred typechecking-but-dead residue** (compiles, AI leftovers): policy/account surface in
   `base/common/policy.ts` + `platform/policy/common/policy.ts`; `environmentService.agentSessionsWorkspace`
   ref in workspaceTrust.ts; `_chatExtensionId` in extensionEnablementService.ts; `terminalDictationInProgress`
   in terminalContextKey.ts; `chatHeight` in markupCellViewModel.ts; otel `CopilotChatAttr` naming.
6. **Generated file**: `build/lib/policies/policyData.jsonc` full of `CopilotOtel*`/`chat.agentHost.*` —
   regenerate via `npm run export-policy-data` once compiling; do NOT hand-edit.
7. **Policy decision (user)**: `no-engineering-system-changes.yml` Copilot-*bot* governance guard.
8. `npm run gulp compile-extensions` not yet run. Full build not attempted.
9. `PATCHES.md` / `HANDOFF.md` still stale — rewrite `PATCHES.md` as a hard-fork ledger (patch budget
   deliberately blown), refresh `HANDOFF.md`'s stale state table.

## Build/load verification pass (2026-07-24)

Goal: confirm Vousoir actually builds + loads (workbench comes up, no crash) after the excision,
reading both the backend terminal and the frontend devtools console. `typecheck-client` = 0 only
proves `src/` static imports resolve — it does NOT compile `build/` or `extensions/`, nor catch
runtime DI/asset breaks. Three new break-classes surfaced, none caught by typecheck-client:

**CLASS 1 — build tooling (THE load blocker, FIXED).** `build/gulpfile.reh.ts` and
`build/gulpfile.vscode.ts` still `import { readAgentSdkResults } from './agent-sdk/common.ts'` —
but `build/agent-sdk/` was deleted. Gulp loads these gulpfiles on startup, so `npm run watch`
(and any `gulp` task) crashed with `ERR_MODULE_NOT_FOUND` before compiling anything → no build →
nothing to launch. This is the most likely thing the user hit. **Fixed**: removed the import and
the `json.agentSdks = readAgentSdkResults()` stamping block from both gulpfiles. `gulp
--tasks-simple` now exits 0; `npm run watch` proceeds. Remaining `agent-sdk`/`codex` refs are
CI-only (azure-pipelines *.yml), data (policyData.jsonc), or build tests — not loaded by watch.

**CLASS 2 — built-in extension AI-API residue (pending excision).** `watch-extensions` compiles
`extensions/` (not covered by typecheck-client). Five still reference deleted proposed APIs:
- `mermaid-markdown-features/src/chatOutputRenderer.ts` — ChatOutputRenderer/DataItem/Webview,
  `chat.registerChatOutputRenderer`, ExtendedLanguageModelToolResult2 (6 err; **throws at
  activation** — `chat` namespace gone).
- `markdown-language-features/src/preview/markdownEditorProvider.ts` — `window.createAgentEditorComments` (2 err; throws when invoked).
- `git/src/{fileSystemProvider,model,repository}.ts` — `workspace.isAgentSessionsWorkspace` (3 err; property read → undefined, likely harmless but must be cleaned).
- `typescript-language-features/src/languageFeatures/quickFix.ts` — `VsCodeCodeAction.isAI` (3 err; property read, harmless).
- `vscode-api-tests` — browser*/chat*.test.ts (46 err; TEST extension, `--disable-extension`d at launch, lowest priority).

**CLASS 3 — `src/` extension-point AI-proposal residue (pending excision, 17 tsgo errors).** After
the build regenerates `extensionsApiProposals.ts` (dropping deleted proposals), these source files
still register contributions gated on removed proposal names:
- `src/vs/workbench/api/browser/viewsExtensionPoint.ts:459` — `chatSessionsProvider`
- `src/vs/workbench/api/common/configurationExtensionPoint.ts:326` — `agentsWindowConfiguration`
- `src/vs/workbench/services/actions/common/menusExtensionPoint.ts:485-577` — a block of
  chat/agents menu contributions (chatParticipantPrivate, chatSessionsProvider ×many,
  chatSessionCustomizationProvider, contribChatEditorInlineGutterMenu, chatParticipantAdditions).
  NOTE: these explain why a fresh `typecheck-client` may now show 17 errors — the earlier "0" relied
  on a stale generated proposals allow-list. Harmless at runtime (dead metadata) but must be removed.

**Core status:** `watch-client-transpile` finished `src → out` with **0 errors**, copied 1036
resources — `out/` is fresh and runnable. tsgo/extension errors do NOT block `out/` emission (esbuild
transpile is separate), so the app launches; Classes 2-3 are cleanliness/"no ai tools" residue.

### Fixes applied + verification results (2026-07-24)

**Fixed (verified):**
1. **Build blocker** — `agent-sdk` import removed from `gulpfile.reh.ts`/`gulpfile.vscode.ts` → `npm run watch` builds.
2. **Blank-page crash** — 3 dangling notebook-chat CSS imports in `notebookEditorWidget.ts` removed
   (a rejected ESM css import cascaded up and aborted the whole workbench mount). Comprehensive scan of
   all 4638 src files → 0 dangling css imports remain.
3. **Runtime error `productService.builtInExtensionsEnabledWithAutoUpdates is not iterable`** — the
   excision removed this (non-optional, non-AI) product.json key that extension-scanning iterates.
   Restored as `"builtInExtensionsEnabledWithAutoUpdates": []` in product.json (semantically correct:
   no auto-updating built-ins). Consumers: extensionsScannerService.ts:112 (for-of), extensionManagementService.ts:947, extensionManagementCLI.ts:389.
4. **"Chat" settings category** — removed the 107-line `{ id: 'chat', ... }` tocData block from
   `settingsLayout.ts`.
5. **Class-3 src extension-point residue (was 17 tsgo errors → 0)** — removed the `agentSessions`
   view-container gate (`viewsExtensionPoint.ts`), the `agentsWindow` config gate + now-unused
   `isProposedApiEnabled` import (`configurationExtensionPoint.ts`), and the 104-line AI/chat/agents
   menu-location block + AI-search menu entry (`menusExtensionPoint.ts`). `watch-client-noEmit` (tsgo,
   which checks against the regenerated api-proposals allow-list) now reports **0 errors** for src.

**Verified healthy — WEB frontend (localhost:8080 via Chrome devtools):** workbench mounts fully
(`.monaco-workbench` + titlebar/activitybar/sidebar/editor/panel/auxiliarybar/statusbar all present);
command palette opens & filters; settings editor + settings SEARCH work ("8 Settings Found"); 0 error
notifications; Problems badge 0/0; 0 captured runtime errors across interaction. Activity bar shows NO
chat/copilot/agents icon. NOTE: VS Code overrides `console.error` (routes to its log service), so the
MCP console-error reader can't see internal errors — verified via error-notification DOM + an injected
window.error/console.error capture instead.

**Verified healthy — DESKTOP `Vousoir.exe` (backend + renderer console via --verbose):** main process
boots (PolicyConfiguration, machine-id), `window#load`, renderer runs `workbench#open()`, extension
host started (pid), lifecycle reached **phase 4 (Eventually / full startup)**, welcome editor opened,
render baseline 12ms, productName **Vousoir**. Only benign warnings: "mutex already exists"
(single-instance), webview CSP inline-style, iframe sandbox, "Unrecognized feature 'local-network-access'".

**Fixed — Class-2 built-in extension AI-API residue (all shipping extensions now compile 0 errors):**
- **git** — removed `workspace.isAgentSessionsWorkspace` from fileSystemProvider.ts/model.ts/repository.ts
  (normal non-agent-sessions path); removed `agentSessionsWorkspace` + `agentsWindowConfiguration` from
  package.json `enabledApiProposals`; removed deleted `.d.ts` from tsconfig include.
- **typescript-language-features** — removed dead AI code-action paths in quickFix.ts (`isAI`, the
  `_aiActions` set, the `copilot?.isActive` block, CompositeCommand/EditorChatFollowUp registrations);
  removed `codeActionAI` from package.json `enabledApiProposals`.
- **markdown-language-features** — removed `#wireComments` / `window.createAgentEditorComments`; removed
  `agentEditorComments` from package.json + tsconfig.
- **mermaid-markdown-features** — DELETED `src/chatOutputRenderer.ts` (dead ChatOutputRenderer + the
  `vscode.lm` tool that would THROW at activation and take down markdown preview); rewired the non-AI
  `openInEditor` command; cleaned package.json contributions + tsconfig proposal includes. The shared
  preview-src/chat/ webview assets (misnamed "chat") were correctly KEPT — the non-AI editor preview uses them.
- Central check: `watch-extensions` reports **0 errors for all 32 shipping extensions**; only the
  DISABLED `vscode-api-tests` (46 err) remains (deferred).

**Fixed — runtime errors found via desktop relaunch (were console ERRs, non-fatal, now gone):**
- **`Missing proxy instance ExtHost{Interactive,Embeddings}`** (dead-AI RPC identifiers) — the exthost
  runs `assertRegistered(Object.values(ExtHostContext))` at API init (extHost.api.impl.ts:222), requiring
  EVERY `ExtHostContext` proxy identifier to be `.set()`. Two AI features had their exthost impls deleted
  but left their protocol identifiers: `ExtHostInteractive` (interactive-editor bridge) and
  `ExtHostEmbeddings` (aiEmbeddingVector). assertRegistered throws on the FIRST unset one and stops, so
  they surfaced one at a time across relaunches. Rather than whack-a-mole, wrote a static analyzer
  (`find-dead-exthost.mjs`) that diffs declared vs `.set()` identifiers → found exactly these two.
  Full clean removal of BOTH: deleted `mainThreadInteractive.ts` + `mainThreadEmbeddings.ts`, removed
  their `extensionHost.contribution.ts` registrations, and removed all four protocol entries each
  (MainThread/ExtHost Shape interfaces + MainContext/ExtHostContext createProxyIdentifier lines).
  Re-ran the analyzer: **0 dead identifiers (62/62 registered)**. The non-AI Interactive Window
  (`contrib/interactive`, still loaded) is preserved — only the dead exthost bridge is gone.
- **Extension-manifest proposal residue** — `git`/`ts` package.json declared removed proposals
  (`agentsWindowConfiguration`, `codeActionAI`) → "wants API proposal X but DOES NOT EXIST" console ERRs.
  Removed. Remaining such errors are only from the DOWNLOADED `ms-vscode.js-debug` (`browser` proposal)
  and the disabled `vscode-api-tests` — both out of scope for a source excision.

**Remaining minor residue (flagged, non-blocking, optional follow-up — NONE block load/build):**
- ts `util/copilot.ts` + `refactor.ts` still use `EditorChatFollowUp`/`CompositeCommand` (compiles; a
  chat-follow-up refactor path that no-ops at runtime) — genuine copilot code still in tree.
- `terminal.integrated.agentHostProfile.*` config-schema residue (policy list).
- `vscode-api-tests` (DISABLED test extension) — 46 compile errors + declares removed proposals
  (browser/chat*/mcp/etc.). Fix in a `test/` excision pass; never ships/activates.
- Downloaded `ms-vscode.js-debug` declares the removed `browser` proposal → one console warning. It's a
  prebuilt MS extension in product.json builtInExtensions; drop it or patch the download to silence.
- **Web serverless only:** `git-base` + `merge-conflict` (and any extension with a `browser` entry)
  fail activation "Not Found" under `scripts/code-web.js` because their `dist/browser/*.js` web bundles
  were never built (this session ran `npm run watch` = node/desktop `out/`, not `gulp compile-web`).
  NOT an excision regression and NOT present on desktop (which loads their `main`/`out` entry fine).
  Run `npm run gulp compile-web` (or watch-web) if serverless-web extension testing is needed.

**Deferred / benign:**
- `vscode-api-tests` (browser*/chat*.test.ts, 46 err) — DISABLED test extension (`--disable-extension`
  at launch), does not ship/run; fix by deleting the dead test files in a later test pass.
- `terminal.integrated.agentHostProfile.*` — agentHost config-schema residue in terminal config (policy list).
- `out/vs/workbench/workbench.web.main.internal.css` 404 in web dev — the esbuild PRODUCTION bundle
  artifact; not generated in dev transpile, harmless (UI fully styled). Will exist in a production build.

### Tooling used (scratchpad, regenerate if lost)

`strip.py` (dead import lines from TS2307/TS2882/TS6192), `strip2.py` (dead self-contained
single-line statements from TS2304/TS2552), `strip3.py` (dead import-member lines),
`blockcut.py` (brace-balanced block removal by header regex).

⚠️ `strip2.py` **damaged** `developerActions.ts** by deleting lines inside a function body,
orphaning locals. It was reverted with `git checkout` and redone by hand. Prefer `blockcut.py`
or hand edits from here on; the blunt statement stripper has hit the end of its safe range and
now oscillates (356→383→357→364).
