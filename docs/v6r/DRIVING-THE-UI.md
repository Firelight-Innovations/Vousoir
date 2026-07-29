# Driving the Vousoir UI

How to launch Vousoir and control it as an agent, so a change to the canvas or the spec panel can be
*seen* rather than inferred. Written after the first Electron launch (2026-07-27), which found three
defects that seven milestones of headless tests could not — see
[`PROGRESS.md`](./PROGRESS.md#the-first-electron-launch--2026-07-27) for what those were and why.

**Read this first if you are changing anything visual.** Every claim below was executed on Windows
against this tree; where something is unverified it says so.

---

## 1. The short version

```powershell
# Launch. Returns immediately - Vousoir.exe is a GUI binary, PowerShell does not block on it.
.\scripts\vousoir-dev.ps1 -SkipPreLaunch
```

```bash
# Wait for the renderer's debug port, then attach.
curl -s http://127.0.0.1:9333/json/version        # poll until this answers
npx @playwright/cli -s=ui attach --cdp=http://127.0.0.1:9333

# Open the demo canvas.
npx @playwright/cli -s=ui press Control+p
npx @playwright/cli -s=ui type "demo.v6r"
npx @playwright/cli -s=ui press Enter

# Look at it.
npx @playwright/cli -s=ui screenshot --filename="C:/path/to/shot.png"
```

Then read the PNG. That is the whole loop.

**Always pass `-s=<name>`.** The CLI is backed by a daemon keyed by session name; two callers that both
omit it share one implicit session and the last `attach` wins for both.

---

## 2. Launching

`scripts/vousoir-dev.ps1` is the Windows counterpart to `.agents/skills/launch/scripts/launch.sh`
(bash-only, so it does not run here). It differs from `scripts/code.bat` in three ways that matter:

| | Why |
|---|---|
| Isolated `--user-data-dir` / `--extensions-dir` under `.vousoir-dev-run/` | Never collides with a real Vousoir instance. Delete the directory for a clean profile. |
| `--disable-workspace-trust` | Restricted Mode is one more thing to click past on every launch. |
| `--remote-debugging-port` (default 9333) | The whole point — without it there is nothing to attach to. |

**Flags worth knowing:**

- `-SkipPreLaunch` skips `build/lib/preLaunch.ts`. That step downloads Electron and compiles if `out/`
  is missing, and it is the slow part. Skip it when the tree is already built; drop it after a fresh
  clone or if the launcher complains the binary is missing.
- `-Folder <path>` opens a specific workspace. **The default is a scratch copy of the demo fixture**
  at `.vousoir-dev-run/demo-project`, not `vousoir/shared/src/fixtures/demo-project` itself — the
  canvas writes node placements into `.vousoir/layout.json` in whatever workspace is open, and pointing
  it at the committed fixture would dirty it the first time anyone drags a module. If you pass
  `-Folder`, keep that in mind.
- `-Port <n>` for a second instance.

**Stopping it:**

```powershell
Get-CimInstance Win32_Process -Filter "Name='Vousoir.exe'" |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Electron is 1–4 GB across ~11 processes. Kill it when you are done.

---

## 3. The edit → see loop

**Which files need what.** This is the single most useful thing on this page:

| You changed | To see it |
|---|---|
| `extensions/vousoir-core/media/*.css`, `media/*.js` | **`Developer: Reload Window`.** Nothing else. These ship as real files loaded through `asWebviewUri`; the reload re-reads them from disk. *Verified: a CSS edit showed up after a reload with no restart.* |
| `extensions/vousoir-core/src/**/*.ts` (includes the HTML builders `canvas-html.ts`, `spec-panel-html.ts`) | `node esbuild.mts` in `extensions/vousoir-core`, **then** reload the window. These are bundled into `dist/extension.js`; editing the source alone changes nothing. |
| `vousoir/shared/**`, `typings/vousoir/**` | Rebuild the extension bundle as above — they are bundled into it too. |
| `src/vs/**` (core workbench) | Full rebuild and relaunch. Out of scope for UI/UX work on Vousoir's own surfaces. |

Reload the window from the command palette:

```bash
npx @playwright/cli -s=ui press Control+Shift+p
npx @playwright/cli -s=ui type "Developer: Reload Window"
npx @playwright/cli -s=ui press Enter
```

A reload tears down the page the CLI is attached to. **Re-attach afterwards** (a fresh `-s=` name is
the simplest way) and give it ~15s before the first screenshot; an early one times out.

---

## 4. Interacting with the canvas

The canvas and the spec panel are **webviews**, which means their content lives in a nested iframe.
That has one consequence you will hit immediately.

### Element refs work — when the snapshot reaches into the frame

```bash
npx @playwright/cli -s=ui snapshot
# ... - button "Add" [ref=f3e4]
npx @playwright/cli -s=ui click f3e4
```

`snapshot` writes a YAML file under `.playwright-cli/` and prints its path. When it descends into the
webview you get `f<N>e<M>` refs for toolbar buttons and module boxes, and `click`/`dblclick`/`eval`
take them.

**But it does not always descend.** In practice it sometimes returned only `iframe [ref=f2e2]` with
nothing under it, on the same window that had produced full refs minutes earlier. Do not build a loop
that depends on refs being there.

### Coordinates always work

Screenshots are taken at CSS scale, so **a pixel in the PNG is a pixel you can click**:

```bash
npx @playwright/cli -s=ui mousemove 450 218
npx @playwright/cli -s=ui mousedown
npx @playwright/cli -s=ui mouseup
```

This is the reliable path: screenshot, read the coordinate off the image, click it.

Watch out for **nested modules**. A parent box contains its children, so the geometric centre of
"Task API" may land on "Request Validation" instead. Aim at the title row near the top of a box, not
its middle.

### Double-click needs a real click count

`mousedown` + `mouseup` twice does **not** produce a `dblclick` event — the CLI has no coordinate
double-click, and raw press pairs carry no click count. Drilling into a module needs `playwright-core`
directly:

```js
// dbl.mjs - run from the repo root so `playwright-core` resolves
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('workbench'));
await page.mouse.click(450, 218, { clickCount: 2, delay: 40 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shot.png' });
await browser.close();
```

The same escape hatch covers anything else the CLI cannot express — drags with intermediate moves,
modifier-held clicks, wheel events at a position.

### The gesture vocabulary

What the canvas currently responds to, as of the 2026-07-27 fixes:

| Gesture | Effect |
|---|---|
| Click a module | Selects it: outlines it, populates the spec panel, arms the toolbar's Rename/Delete |
| Click empty canvas | Clears the selection; the panel returns to its empty state |
| Double-click a module | Drills into that subtree; the toolbar title becomes `Project / Module` |
| Right-click a module | Same as click, plus a transient notice |
| Drag a module | Onto another module re-parents it; onto empty space records a manual placement in `.vousoir/layout.json` |
| Drag empty canvas | Pans |
| Wheel | Zooms toward the pointer |
| **Whole tree** button | Leaves a drilled-in view |
| **Tidy** button | Discards manual placements so auto-layout applies again |

The spec panel is a separate webview in the sidebar, opened from the Vousoir activity-bar icon. It is
driven entirely by canvas selection — **if the canvas is broken the panel looks broken too**, which is
exactly how the 2026-07-27 bug presented.

---

## 5. What is where

The surfaces a UI/UX change will touch:

```
extensions/vousoir-core/
  media/canvas.css          canvas styling      → reload window
  media/canvas.js           canvas behaviour    → reload window
  media/spec-panel.css      panel styling       → reload window
  media/spec-panel.js       panel behaviour     → reload window
  src/canvas/canvas-html.ts       canvas DOM skeleton, toolbar markup, CSP   → rebuild + reload
  src/panel/spec-panel-html.ts    panel DOM skeleton                         → rebuild + reload
```

Two rules the code follows and a change should not break:

- **Every colour is a VS Code theme variable.** No literal hex anywhere in `media/*.css` — the canvas
  follows the user's theme. See [`design-tokens.instructions.md`](../../.github/instructions/design-tokens.instructions.md)
  and the [`design-philosophy` skill](../../.github/skills/design-philosophy/SKILL.md) for the
  vocabulary this project reasons in (values → principles → moves, not pixels).
- **No CDN, no remote font, no network.** Assets are extension files served through `asWebviewUri`
  under a nonce CSP (ADR-004). Adding a `<link>` to a font service will be blocked by the CSP, and
  the CSP conformance test will fail before you see it in the app.

---

## 6. Traps

**An overlay that swallows clicks looks exactly like broken JavaScript.** This was the 2026-07-27 bug:
`#v6r-empty` set `display: flex`, which outranks the browser's `[hidden] { display: none }` on
specificity, so hiding it left an invisible full-viewport element on top of the canvas. Nothing was
visibly wrong, and nothing responded. **If a gesture does nothing, check what is actually under the
pointer before you read the handler.** `elementFromPoint` in a live webview answers this in one call;
a code review does not.

**happy-dom has no box model.** The smoke tests
(`extensions/vousoir-core/src/canvas/canvas-webview*.smoke.test.ts`) dispatch events directly on
elements, so they bypass hit-testing entirely and cannot see overlays, stacking, overflow, or
scroll. They are worth keeping green and they are not evidence that the UI works. Only a screenshot is.

**The CSS cascade is only partly under test.** The harness strips the stylesheet `<link>` by default;
`withRealStyles()` in `canvas-webview-fixture.ts` injects the real `canvas.css` when a test needs
`getComputedStyle` to mean something. Use it for any fix that is fundamentally about specificity.

**Screenshots right after a reload time out.** Give it ~15s, then retry once; the second call
usually succeeds.

**Do not trust a green test suite as a visual sign-off.** `cd vousoir; pnpm run verify` is the gate
(279 tests, exit 0) and it must stay green — but the three defects it did not catch were all found by
looking at a screenshot.

---

## 7. The browser path, and why it is not the default

`scripts/vousoir-web.ps1` serves the workbench over HTTP for Chrome. It works up to the point of
webviews: the workbench loads, `vousoir-core` activates, the activity-bar icon renders, files open —
and then **every out-of-process iframe crashes its renderer**, so both webviews show a crashed-frame
icon. That reproduced with `https://example.com` in the same browser, so it is a browser-profile
fault, not a Vousoir one. Restarting Chrome is the first thing to try.

Two real Vousoir gaps had to be fixed to get that far, and they are worth knowing if a web build is
ever a target:

1. **Web webviews have no host.** Vousoir removed the Microsoft CDN fallback deliberately
   (`environmentService.ts`), so `webviewExternalEndpoint` is empty in a browser and every webview
   throws *"'webviewExternalEndpoint' has not been configured"*. The script writes a
   `webviewContentExternalBaseUrlTemplate` into `product.overrides.json`. The `{{uuid}}` in it is
   load-bearing: `pre/index.html` hashes the parent origin and checks it against its own hostname, so
   webviews must be served from a wildcard subdomain, not the workbench's own origin.
2. **`quality` is missing client-side.** Running from sources the browser falls back to a product
   literal with no `quality`, so it asks for `/oss-dev/vscode-remote-resource` while the server — which
   reads the real `product.json` (`"quality": "stable"`) — serves `/stable-dev`. Every extension
   resource 404s, including the activity-bar icon. Dev-only; a packaged build inlines the real
   `product.json` into the web bundle.

Both live in `product.overrides.json`, which is gitignored and read by `webClientServer.ts` only in dev.

---

## 8. Checklist for a visual change

1. Launch, attach, open `demo.v6r`, **screenshot the before state.**
2. Make the change.
3. Rebuild if you touched `src/`; reload the window either way.
4. Re-attach, screenshot, **compare**.
5. Exercise the gestures the change could affect — at minimum click a module, click empty canvas, and
   double-click to drill in. A change to stacking or sizing can break hit-testing without changing how
   anything looks.
6. `cd vousoir; pnpm run verify` — must be exit 0.
7. If you fixed a defect, add a test and **watch it fail first.** The overlay regression test was
   confirmed to report `flex` instead of `none` before the fix landed; without that step it would have
   been a test that proved nothing.
