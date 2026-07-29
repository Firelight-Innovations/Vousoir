# Licensing obligations to settle before publishing Vousoir

Open items that do **not** matter while Vousoir is built and run privately, but
**do** matter the moment it is distributed to anyone else — a release binary, an
installer handed to a colleague, or a public download.

Written 2026-07-28, when the five third-party extensions were bundled as
built-ins. Nothing here is a defect in the build; these are decisions that were
consciously deferred.

---

## 1. Vendored VSIX binary — the one that needs a decision

`vousoir/vendor/zoellner.openapi-preview-2.3.2.vsix` (929 KB) is checked into
the repository.

**Why it is vendored:** `zoellner.openapi-preview` is not published on Open VSX
(`GET https://open-vsx.org/api/zoellner/openapi-preview` → `404`). The build's
gallery is pinned to Open VSX by `build/hygiene.ts`, so the only way to ship it
built-in was the `"vsix"` field in `product.json`, which loads a local file.

**The problem:** the extension's license was never verified. It was obtained
from the VS Marketplace, whose Terms of Use restrict redistribution of content
obtained through it, independent of whatever license the extension itself
carries. Committing the binary to a repository that anyone else can read is
redistribution.

**Note on repo visibility:** `Firelight-Innovations/Vousoir` was **public** at
the time this was written (`gh repo view` reported `private: false`). If the
intent is for this to stay private, that is worth checking — the vendored binary
is already reachable, and git history keeps it reachable even after a later
deletion.

**Options, roughly in order of preference:**

1. Confirm the upstream source repo's license permits redistribution, record it
   in `ThirdPartyNotices.txt`, and keep the vendored file.
2. Drop the binary and fetch it at build time instead, so it is never
   redistributed by us — the user's own machine pulls it.
3. Substitute an Open VSX equivalent (`buchenberg.scalar-openapi-preview` or
   `Redocly.openapi-vs-code`), which removes the problem entirely.
4. Ship without an OpenAPI previewer.

---

## 2. GPL-3.0 in the bundle

`hediet.vscode-drawio` is **GPL-3.0**.

It is referenced by name in `product.json` and downloaded from Open VSX at build
time, so the repository redistributes nothing. A **packaged build**, however,
contains the extension, and distributing that build triggers GPL-3.0's source
obligations for that component.

Aggregating a GPL program alongside MIT code on the same medium is permitted —
the extension is a separate program communicating over a defined API, not a
derived work of the editor. What is required is the offer of source. Before
distributing a build: add `hediet.vscode-drawio` to `ThirdPartyNotices.txt` with
its license text and a source offer pointing at its upstream repository.

It is also **48.9 MB** — roughly 5× the other four combined, and the dominant
size cost in the installer. Worth a second look purely on that basis.

---

## 3. Third-party notices are not written

`ThirdPartyNotices.txt` has not been updated for any of the five bundled
extensions. Licenses as recorded on Open VSX:

| Extension | Version | License |
|---|---|---|
| `PKief.material-icon-theme` | 5.37.0 | MIT |
| `tomoki1207.pdf` | 1.2.2 | MIT |
| `hediet.vscode-drawio` | 1.6.6 | **GPL-3.0** |
| `illixion.vscode-vibrancy-continued` | 1.1.86 | MIT |
| `zoellner.openapi-preview` | 2.3.2 | **unverified** |

The four MIT ones need attribution and license text. See §2 for draw.io and §1
for OpenAPI Preview.

---

## 4. Unrelated to licensing, but also gates a real release

- **The build is unsigned.** `build.ps1 -Installer` currently fails on
  `spawn signtool.exe ENOENT` after packaging succeeds, so no installer has ever
  been produced. Distributing an unsigned installer means a SmartScreen warning
  on every user's first run.
- **The Windows 11 modern context menu is out of scope** for the same reason: it
  needs an MSIX sparse package signed with a real certificate. The legacy
  registry menu (under "Show more options") is what ships today.
- **`illixion.vscode-vibrancy-continued` is bundled but must not be enabled.**
  It patches the app's own checksum-verified files on disk, which would make
  Vousoir report itself as corrupt. It is inert unless its command is invoked.
  Shipping it to users who might run that command is a support problem; consider
  dropping it now that vibrancy is being implemented natively (see
  `vousoir/PATCHES.md` row 13).
