<#
.SYNOPSIS
    Produce a distributable Vousoir build.

.DESCRIPTION
    Runs the code-oss packaging pipeline and emits a self-contained, runnable
    application folder next to the repo:

        <repo-parent>\VSCode-win32-x64\Vousoir.exe

    (The folder name comes from upstream's packaging task and is not rebranded;
    the executable inside it is Vousoir.exe.)

    Assumes .\setup.ps1 has already run successfully.

.PARAMETER Arch
    x64 (default) or arm64.

.PARAMETER NoMinify
    Skip minification. Much faster, much larger output. Use for smoke-testing
    the packaging pipeline, not for distribution.

.PARAMETER Archive
    Also produce a .zip alongside the output folder.

.EXAMPLE
    .\build.ps1
.EXAMPLE
    .\build.ps1 -NoMinify -Archive
#>
[CmdletBinding()]
param(
    [ValidateSet('x64', 'arm64')][string]$Arch = 'x64',
    [switch]$NoMinify,
    [switch]$Archive
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

function Write-Ok   { param([string]$T) Write-Host "    OK   $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "    WARN $T" -ForegroundColor Yellow }
function Fail {
    param([string]$Problem, [string]$Fix)
    Write-Host ""
    Write-Host "  FAILED: $Problem" -ForegroundColor Red
    if ($Fix) { Write-Host ""; foreach ($l in $Fix -split "`n") { Write-Host "    $l" } }
    Write-Host ""
    exit 1
}

$started = Get-Date
Write-Host ""
Write-Host "  Vousoir distributable build" -ForegroundColor White

# --- Preflight -------------------------------------------------------------
if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    Fail "node_modules is missing - dependencies are not installed." "Run .\setup.ps1 first."
}

# Same space-free Node path the setup script establishes. Packaging shells out
# to native tooling, so the node-gyp-build spaces bug can bite here too.
$nodeExe = (Get-Command node).Source
$nodeDir = Split-Path $nodeExe -Parent
$junction = Join-Path $env:USERPROFILE 'nodejs'
if ($nodeDir -match ' ' -and (Test-Path (Join-Path $junction 'node.exe'))) {
    $nodeExe  = Join-Path $junction 'node.exe'
    $npmCli   = Join-Path $junction 'node_modules\npm\bin\npm-cli.js'
    $env:PATH = "$junction;$env:PATH"
} else {
    $npmCli = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
}

# vousoir-core is not built by the gulp pipeline (plain esbuild.mts does not
# match the esbuild.*.mts extension-media glob), so build it explicitly first
# or the packaged app ships without the Vousoir panel.
Write-Host ""
Write-Host "==> Building vousoir-core extension" -ForegroundColor Cyan
& $nodeExe (Join-Path $repoRoot 'extensions\vousoir-core\esbuild.mts')
if ($LASTEXITCODE -ne 0) { Fail "vousoir-core build failed." "cd extensions/vousoir-core; node esbuild.mts" }
Write-Ok "vousoir-core built"

# --- Package ---------------------------------------------------------------
if ($NoMinify) { $task = "vscode-win32-$Arch" } else { $task = "vscode-win32-$Arch-min" }

Write-Host ""
Write-Host "==> Packaging: gulp $task" -ForegroundColor Cyan
Write-Warn "This takes 20-45 minutes. Minification dominates."

& $nodeExe $npmCli run gulp $task
if ($LASTEXITCODE -ne 0) {
    Fail "Packaging task '$task' failed." @"
If it failed compiling native extensions, confirm the toolchain is intact:
  .\setup.ps1 -SkipChecks:`$false

Full detail: BUILDING.md -> Troubleshooting
"@
}

# --- Locate output ---------------------------------------------------------
# Upstream packages into a sibling of the repo root.
$outDir = Join-Path (Split-Path $repoRoot -Parent) "VSCode-win32-$Arch"
if (-not (Test-Path $outDir)) { Fail "Packaging reported success but $outDir does not exist." "" }

$exe = Join-Path $outDir 'Vousoir.exe'
if (-not (Test-Path $exe)) {
    Write-Warn "Vousoir.exe not found in the output - check product.json nameShort."
    Get-ChildItem $outDir -Filter *.exe | Select-Object -First 5 | ForEach-Object { Write-Warn "  found: $($_.Name)" }
} else {
    Write-Ok "Vousoir.exe present"
}

$sizeGb = [math]::Round((Get-ChildItem $outDir -Recurse -File -ErrorAction SilentlyContinue |
                         Measure-Object -Property Length -Sum).Sum / 1GB, 2)

# --- Optional archive ------------------------------------------------------
$zipPath = $null
if ($Archive) {
    Write-Host ""
    Write-Host "==> Creating archive" -ForegroundColor Cyan
    $zipPath = "$outDir.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $outDir '*') -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Ok "archive created"
}

# --- Summary ---------------------------------------------------------------
$elapsed = (Get-Date) - $started
Write-Host ""
Write-Host "  Build complete in $([int]$elapsed.TotalMinutes)m $($elapsed.Seconds)s" -ForegroundColor Green
Write-Host ""
Write-Host "  Output   $outDir  ($sizeGb GB)" -ForegroundColor White
if ($zipPath) { Write-Host "  Archive  $zipPath" -ForegroundColor White }
Write-Host "  Run      $exe" -ForegroundColor White
Write-Host ""
Write-Host "  Note: this build is UNSIGNED. Signed installers are out of scope" -ForegroundColor DarkGray
Write-Host "  for v1 (work order section 10). Windows SmartScreen will warn on" -ForegroundColor DarkGray
Write-Host "  first run on another machine." -ForegroundColor DarkGray
Write-Host ""
