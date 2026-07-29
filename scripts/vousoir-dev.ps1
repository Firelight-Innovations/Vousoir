<#
.SYNOPSIS
	Launches the Vousoir desktop app from sources into a throwaway profile, with a CDP port
	so it can be driven by @playwright/cli.

.DESCRIPTION
	The Windows counterpart to `.agents/skills/launch/scripts/launch.sh`, which is bash-only.
	Differences from `scripts/code.bat`: an isolated `--user-data-dir` / `--extensions-dir`
	(so it never collides with a real Vousoir instance), workspace trust off, and a
	`--remote-debugging-port` for UI automation.

	Vousoir.exe is a GUI-subsystem binary, so this returns as soon as it is spawned rather than
	blocking; poll `http://127.0.0.1:<port>/json/version` before attaching. Stop it with
	`Get-CimInstance Win32_Process -Filter "Name='Vousoir.exe'" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`.

	Prints the CDP endpoint. Attach with:

	    npx @playwright/cli -s=<session> attach --cdp=http://127.0.0.1:<port>
	    npx @playwright/cli -s=<session> snapshot

	Webview content sits in a nested frame, and the snapshot does not always descend into it.
	When it does not, drive the canvas with coordinates (`mousemove`/`mousedown`/`mouseup`) read
	off a screenshot. `@playwright/cli` has no coordinate double-click; for that, connect
	playwright-core over CDP directly and use `page.mouse.click(x, y, { clickCount: 2 })`.

.PARAMETER Folder
	Workspace folder to open. Defaults to a scratch copy of the demo fixture under the run
	directory - never the fixture itself, because the canvas writes `.vousoir/layout.json` into
	whatever workspace it has open and that would dirty a committed test fixture. Delete the run
	directory to get a fresh copy.

.PARAMETER Port
	Renderer remote-debugging port. Default 9333.

.PARAMETER SkipPreLaunch
	Skip `build/lib/preLaunch.ts`. Use when `out/` and `extensions/*/dist` are already current;
	it is the slow part.
#>
[CmdletBinding()]
param(
	[string] $Folder,
	[int] $Port = 9333,
	[switch] $SkipPreLaunch
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')

if (-not $SkipPreLaunch) {
	& node (Join-Path $root 'build\lib\preLaunch.ts')
	if (-not $?) { throw 'preLaunch failed.' }
}

$product = Get-Content (Join-Path $root 'product.json') -Raw | ConvertFrom-Json
$exe = Join-Path $root ".build\electron\$($product.nameShort).exe"
if (-not (Test-Path $exe)) {
	throw "$exe is missing - run without -SkipPreLaunch, or 'npm run compile'."
}

$runDir = Join-Path $root '.vousoir-dev-run'
$userDataDir = Join-Path $runDir 'user-data'
$extensionsDir = Join-Path $runDir 'extensions'
foreach ($dir in @($userDataDir, $extensionsDir)) {
	if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
}

if (-not $Folder) {
	# A scratch copy, never the committed fixture — the canvas persists node placements into
	# `.vousoir/layout.json` in the open workspace, so dragging a module would dirty the fixture.
	$Folder = Join-Path $runDir 'demo-project'
	if (-not (Test-Path $Folder)) {
		Copy-Item -Recurse -Path (Join-Path $root 'vousoir\shared\src\fixtures\demo-project') -Destination $Folder
		Write-Host "Copied the demo fixture to $Folder"
	}
}

$env:NODE_ENV = 'development'
$env:VSCODE_DEV = '1'
$env:VSCODE_CLI = '1'
# The renderer loads Electron modules; inheriting this from a Node-ish parent shell breaks it.
$env:ELECTRON_RUN_AS_NODE = $null

Write-Host ''
Write-Host "CDP endpoint: http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "  npx @playwright/cli -s=v6r attach --cdp=http://127.0.0.1:$Port"
Write-Host ''

# `.` is the app directory (Electron's app path), not a folder to open.
& $exe . `
	--remote-debugging-port=$Port `
	--user-data-dir $userDataDir `
	--extensions-dir $extensionsDir `
	--disable-workspace-trust `
	--disable-extension=vscode.vscode-api-tests `
	(Resolve-Path $Folder).Path
