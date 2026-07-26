<#
.SYNOPSIS
    One-command development setup for Vousoir.

.DESCRIPTION
    Takes a freshly cloned repo to a runnable Vousoir dev build:
      1. Verifies prerequisites (Node, pnpm, Python, MSVC + Spectre libs)
      2. Works around the node-gyp-build spaces-in-path bug
      3. Installs the code-oss layer (npm) and the Vousoir layer (pnpm)
      4. Compiles everything, including the vousoir-core extension

    Safe to re-run. Each step is skipped or is a no-op when already satisfied.

.PARAMETER SkipChecks
    Skip prerequisite verification. Only use if you know the toolchain is good.

.PARAMETER Clean
    Remove node_modules before installing. Does NOT touch tracked or untracked
    source files (never runs `git clean`).

.EXAMPLE
    .\setup.ps1
.EXAMPLE
    .\setup.ps1 -Clean
#>
[CmdletBinding()]
param(
    [switch]$SkipChecks,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

$script:StepNumber = 0
function Write-Step {
    param([string]$Text)
    $script:StepNumber++
    Write-Host ""
    Write-Host "==> [$script:StepNumber] $Text" -ForegroundColor Cyan
}
function Write-Ok   { param([string]$T) Write-Host "    OK   $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "    WARN $T" -ForegroundColor Yellow }
function Fail {
    param([string]$Problem, [string]$Fix)
    Write-Host ""
    Write-Host "  FAILED: $Problem" -ForegroundColor Red
    if ($Fix) {
        Write-Host ""
        Write-Host "  Fix:" -ForegroundColor Yellow
        foreach ($line in $Fix -split "`n") { Write-Host "    $line" }
    }
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  Vousoir dev setup" -ForegroundColor White
Write-Host "  $repoRoot" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
if (-not $SkipChecks) {
    Write-Step "Checking prerequisites"

    # --- Node: must match .nvmrc major, and be >= its minor -----------------
    $nvmrcPath = Join-Path $repoRoot '.nvmrc'
    if (-not (Test-Path $nvmrcPath)) { Fail ".nvmrc not found - are you in the repo root?" "" }
    $required = (Get-Content $nvmrcPath -Raw).Trim()
    $rq = [version]$required

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Fail "Node.js is not installed or not on PATH." @"
winget install --id OpenJS.NodeJS.LTS -v $required
Node $($rq.Major) is the LTS line - the non-LTS 'OpenJS.NodeJS' package does NOT carry $required.
"@
    }
    $nodeVer = [version]((node --version) -replace '^v', '')
    if ($nodeVer.Major -ne $rq.Major -or $nodeVer -lt $rq) {
        Fail "Node $nodeVer found, but $required or newer $($rq.Major).x is required (.nvmrc)." @"
winget uninstall --id OpenJS.NodeJS
winget install --id OpenJS.NodeJS.LTS -v $required

Note: build/npm/preinstall.ts enforces this, but NOT early - npm builds native
modules before running root lifecycle scripts, so a wrong Node fails deep inside
a native module instead of printing a clear message.
"@
    }
    Write-Ok "Node $nodeVer (requires $required+, same major)"

    # --- pnpm ---------------------------------------------------------------
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Fail "pnpm is not installed." "npm install -g pnpm"
    }
    Write-Ok "pnpm $(pnpm --version)"

    # --- git core.longpaths -------------------------------------------------
    # code-oss has paths deeper than Windows' 260-character MAX_PATH. Without
    # this, `git clone` succeeds but CHECKOUT FAILS partway with "Filename too
    # long", leaving a half-populated working tree that looks like a corrupt repo.
    $longPaths = git config --get core.longpaths 2>$null
    if ($longPaths -ne 'true') {
        Write-Warn "git core.longpaths is not enabled."
        Write-Warn "  Deep code-oss paths can exceed Windows' 260-char limit and break checkout."
        Write-Warn "  Enable it with:  git config --global core.longpaths true"
        Write-Warn "  (Not set automatically - it changes your global git config.)"
    } else {
        Write-Ok "git core.longpaths enabled"
    }

    # Depth of the repo path itself matters just as much as the setting.
    if ($repoRoot.Length -gt 60) {
        Write-Warn "Repo path is $($repoRoot.Length) chars deep: $repoRoot"
        Write-Warn "  Prefer something short like C:\dev\Vousoir to stay clear of MAX_PATH."
    }

    # --- Python (node-gyp) --------------------------------------------------
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Fail "Python is not installed or not on PATH (node-gyp needs it)." "winget install --id Python.Python.3.13"
    }
    Write-Ok "$(python --version)"
    $hasSetuptools = $false
    try { python -c "import setuptools" 2>$null; $hasSetuptools = $? } catch { $hasSetuptools = $false }
    if (-not $hasSetuptools) {
        Write-Warn "setuptools missing - Python 3.12+ removed distutils, node-gyp needs it."
        Write-Warn "  python -m pip install --upgrade setuptools"
    }

    # --- MSVC ---------------------------------------------------------------
    # NOTE: vswhere can return nothing even when the toolchain works fine (an
    # interrupted install leaves the VS instance without completion markers).
    # node-gyp locates MSBuild by path and never consults vswhere, so treat
    # cl.exe on disk as authoritative and vswhere as advisory only.
    $vsRoot  = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools"
    $clPaths = @(Get-ChildItem "$vsRoot\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe" -ErrorAction SilentlyContinue)
    if ($clPaths.Count -eq 0) {
        # Fall back to any VS 2022 edition, not just BuildTools.
        $clPaths = @(Get-ChildItem "${env:ProgramFiles}\Microsoft Visual Studio\2022\*\VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe" -ErrorAction SilentlyContinue)
    }
    if ($clPaths.Count -eq 0) {
        Fail "MSVC (cl.exe) not found. Native modules cannot compile." @"
winget install --id Microsoft.VisualStudio.2022.BuildTools ``
  --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

Then open a NEW terminal so node-gyp can discover cl.exe.
"@
    }
    Write-Ok "MSVC $($clPaths[0].Directory.Parent.Parent.Parent.Name)"

    # --- Spectre-mitigated libs (separate VS component) ---------------------
    $msvcDir     = $clPaths[0].Directory.Parent.Parent.Parent.FullName
    $spectrePath = Join-Path $msvcDir 'lib\spectre'
    if (-not (Test-Path $spectrePath)) {
        Fail "Spectre-mitigated libraries are missing (@vscode/deviceid will fail with MSB8040)." @"
Run from an ELEVATED PowerShell:

  `$a = @('modify',
        '--installPath', '"$vsRoot"',
        '--add', 'Microsoft.VisualStudio.Component.VC.Runtimes.x86.x64.Spectre',
        '--quiet', '--norestart')
  Start-Process "`${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\setup.exe" ``
    -ArgumentList `$a -Verb RunAs -Wait

Two traps: use 'modify' (not 'install') once Build Tools exists, and keep the
quotes inside the --installPath array element - PowerShell does not quote
array elements, so an unquoted path truncates at 'C:\Program'.
"@
    }
    Write-Ok "Spectre-mitigated libraries"
}

# ---------------------------------------------------------------------------
# 2. Space-free Node path (node-gyp-build@4.8.1 workaround)
# ---------------------------------------------------------------------------
# node-gyp-build 4.8.1 (lockfile-pinned) spawns builds with `shell: true` AND
# `process.execPath`. Under shell:true that unquoted "C:\Program Files\..."
# path breaks at the space -> "'C:\Program' is not recognized". Fixed upstream
# in 4.8.4. Giving Node a space-free path sidesteps it for every native module.
Write-Step "Ensuring a space-free Node path"

$nodeExe = (Get-Command node).Source
$nodeDir = Split-Path $nodeExe -Parent

if ($nodeDir -match ' ') {
    $junction = Join-Path $env:USERPROFILE 'nodejs'
    if (-not (Test-Path (Join-Path $junction 'node.exe'))) {
        if (Test-Path $junction) { Remove-Item $junction -Force -Recurse -ErrorAction SilentlyContinue }
        cmd /c mklink /J "$junction" "$nodeDir" | Out-Null
        if (-not (Test-Path (Join-Path $junction 'node.exe'))) {
            Fail "Could not create the junction $junction -> $nodeDir" "Create it manually, or install Node to a path without spaces."
        }
    }
    $script:NodeExe = Join-Path $junction 'node.exe'
    $script:NpmCli  = Join-Path $junction 'node_modules\npm\bin\npm-cli.js'
    $env:PATH       = "$junction;$env:PATH"
    Write-Ok "Using $junction (real install untouched; remove with: rmdir `"$junction`")"
} else {
    $script:NodeExe = $nodeExe
    $script:NpmCli  = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
    Write-Ok "Node path has no spaces - no workaround needed"
}

function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    & $script:NodeExe $script:NpmCli @Args
    if ($LASTEXITCODE -ne 0) { throw "npm $($Args -join ' ') failed with exit code $LASTEXITCODE" }
}

# ---------------------------------------------------------------------------
# 3. Clean (opt-in)
# ---------------------------------------------------------------------------
if ($Clean) {
    Write-Step "Removing node_modules"
    Write-Warn "NEVER use 'git clean -xfd' here - the Vousoir layer may be untracked and would be deleted."
    foreach ($d in @('node_modules', 'vousoir\node_modules')) {
        $p = Join-Path $repoRoot $d
        if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction Continue; Write-Ok "removed $d" }
    }
}

# ---------------------------------------------------------------------------
# 4. Install the code-oss layer (npm)
# ---------------------------------------------------------------------------
Write-Step "Installing code-oss dependencies (npm) - compiles ~18 native modules, 10-25 min"

$running = Get-Process -Name 'Vousoir', 'Code' -ErrorAction SilentlyContinue
if ($running) {
    Write-Warn "Vousoir/VS Code is running - it holds locks in node_modules and causes EBUSY."
    Write-Warn "Close it if the install fails."
}

try {
    Invoke-Npm ci
} catch {
    Fail "npm ci failed." @"
Common causes, in order of likelihood:

  'C:\Program' is not recognized   -> the space-free Node path above did not
                                      take effect. Re-run this script.
  MSB8040 Spectre libraries        -> install the Spectre component (see above).
  ECONNRESET                       -> transient registry failure. postinstall is
                                      resumable; just re-run .\setup.ps1
  EBUSY / resource busy            -> close Vousoir / VS Code, then re-run.

Full detail: BUILDING.md -> Troubleshooting
"@
}
Write-Ok "code-oss dependencies installed"

# ---------------------------------------------------------------------------
# 5. Install the Vousoir layer (pnpm)
# ---------------------------------------------------------------------------
# Two toolchains on purpose: npm owns the repo root (enforced by
# build/npm/preinstall.ts), pnpm owns the Vousoir layer from an isolated root at
# vousoir/. They never share a node_modules. See vousoir/PATCHES.md (D1).
Write-Step "Installing Vousoir layer dependencies (pnpm)"
Push-Location (Join-Path $repoRoot 'vousoir')
try {
    pnpm install
    if ($LASTEXITCODE -ne 0) { Fail "pnpm install failed in vousoir/." "See the error above." }
} finally { Pop-Location }
Write-Ok "Vousoir layer installed"

# ---------------------------------------------------------------------------
# 6. Compile
# ---------------------------------------------------------------------------
Write-Step "Compiling code-oss (5-15 min)"
try { Invoke-Npm run compile } catch { Fail "npm run compile failed." "See the error above." }
Write-Ok "code-oss compiled"

# `npm run compile` builds the client and *extension media* (esbuild.*.mts).
# vousoir-core uses a plain esbuild.mts, which that glob does not match.
Write-Step "Building the vousoir-core extension"
& $script:NodeExe (Join-Path $repoRoot 'extensions\vousoir-core\esbuild.mts')
if ($LASTEXITCODE -ne 0) { Fail "vousoir-core build failed." "cd extensions/vousoir-core; node esbuild.mts" }
Write-Ok "vousoir-core built"

# ---------------------------------------------------------------------------
# 7. Verify the Vousoir layer
# ---------------------------------------------------------------------------
Write-Step "Verifying the Vousoir layer (lint, boundaries, types, tests)"
Push-Location (Join-Path $repoRoot 'vousoir')
try {
    pnpm run verify
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "pnpm run verify FAILED - the app will still launch, but the layer is not green."
        Write-Warn "Investigate before committing: cd vousoir; pnpm run verify"
    } else {
        Write-Ok "Vousoir layer verified"
    }
} finally { Pop-Location }

# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "  Launch Vousoir      .\scripts\code.bat" -ForegroundColor White
Write-Host "  Watch (auto-build)  npm run watch" -ForegroundColor White
Write-Host "  Verify the layer    cd vousoir; pnpm run verify" -ForegroundColor White
Write-Host "  Distributable build .\build.ps1" -ForegroundColor White
Write-Host ""
