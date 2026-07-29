<#
.SYNOPSIS
	Runs Vousoir from sources in a browser, with working webviews.

.DESCRIPTION
	Starts the Vousoir server (out/server-main.js) and prints the URL to open in Chrome.
	Unlike scripts/code-server.bat this configures the three things the browser workbench
	needs that the desktop app gets for free:

	  1. product.overrides.json  - a `webviewContentExternalBaseUrlTemplate`. Desktop webviews
	     use the local `vscode-webview://` scheme; the browser has no such scheme and Vousoir
	     ships no CDN fallback (by design, see environmentService.ts), so without this every
	     webview fails with "'webviewExternalEndpoint' has not been configured".
	  2. --host 127.0.0.1        - the server otherwise binds IPv6-only, but Chrome resolves
	     the per-webview `<hash>.localhost` subdomain to IPv4. Webview iframes would not connect.
	  3. a `quality` in product.overrides.json - running from sources the browser has no
	     product.json (product.ts falls back to a literal that omits `quality`), so it asks the
	     server for `/oss-dev/vscode-remote-resource` while the server, which reads the real
	     product.json, serves `/stable-dev`. Every extension resource - webview scripts, the
	     activity-bar icon, icon themes - 404s. Only dev-from-sources is affected: a built
	     product has product.json inlined into the web bundle.
	  4. a `/`-prefixed folder query - the browser workbench only maps a folder onto the remote
	     filesystem when the path starts with `/` (workbench.ts:412); `c:/...` is parsed as a
	     URI with scheme `c` and every file read fails with ENOPRO.

	Webviews are served from `http://<hash>.localhost:<port>`, one origin per webview, the same
	isolation the desktop app gets - not the workbench's own origin.

.PARAMETER Folder
	Workspace folder to open. Defaults to the demo project fixture.

.PARAMETER Port
	Port to serve on. Default 9888.

.PARAMETER NoOverrides
	Skip writing product.overrides.json (leave whatever is already there alone).
#>
[CmdletBinding()]
param(
	[string] $Folder = (Join-Path $PSScriptRoot '..\vousoir\shared\src\fixtures\demo-project'),
	[int] $Port = 9888,
	[switch] $NoOverrides
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

if (-not (Test-Path (Join-Path $root 'out\server-main.js'))) {
	throw "out/server-main.js is missing - run 'npm run compile' (or the watch task) first."
}

# product.overrides.json is read per request by webClientServer.ts, dev builds only, and is
# gitignored. `{{uuid}}` is replaced with a hash of the parent origin, which pre/index.html
# then verifies against its own hostname - so the subdomain is load-bearing, not decorative.
if (-not $NoOverrides) {
	$productJson = Get-Content (Join-Path $root 'product.json') -Raw | ConvertFrom-Json
	$segment = "$($productJson.quality)-dev"   # getServerProductSegment: `${quality ?? 'oss'}-${commit ?? 'dev'}`
	$overrides = [ordered]@{
		quality = $productJson.quality
		webviewContentExternalBaseUrlTemplate = "http://{{uuid}}.localhost:$Port/$segment/static/out/vs/workbench/contrib/webview/browser/pre/"
	}
	# No BOM: webClientServer.ts does JSON.parse() on the raw bytes and swallows the throw, so a
	# BOM would silently drop every override.
	$overridesPath = Join-Path $root 'product.overrides.json'
	[System.IO.File]::WriteAllText($overridesPath, ($overrides | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
	Write-Host "Wrote $overridesPath"
}

$dataDir = Join-Path $root '.vousoir-web-data'
$folderPath = (Resolve-Path $Folder).Path -replace '\\', '/'
$url = "http://localhost:$Port/?folder=" + [uri]::EscapeDataString("/$folderPath")

$env:VSCODE_DEV = '1'
$env:NODE_ENV = 'development'

Write-Host ''
Write-Host "Open this in Chrome:" -ForegroundColor Green
Write-Host "  $url"
Write-Host ''

& node (Join-Path $root 'out\server-main.js') `
	--port $Port `
	--host 127.0.0.1 `
	--without-connection-token `
	--accept-server-license-terms `
	--disable-workspace-trust `
	--server-data-dir $dataDir
