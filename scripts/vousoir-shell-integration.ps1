<#
.SYNOPSIS
	Add (or remove) the "Open with Vousoir" entries in the Windows Explorer context menu,
	pointing at an already-built, unpackaged Vousoir.exe. No installer required.

.DESCRIPTION
	`build.ps1` produces a runnable folder, not an installer, so none of the shell integration
	that `build/win32/code.iss` would normally write ever lands. This script writes the same
	registry shape by hand.

	Everything goes under `HKCU\Software\Classes`, so it needs no elevation and touches nothing
	machine-wide. HKCU\Software\Classes is merged into HKCR by the shell, so per-user entries
	behave exactly like the installer's.

	Five keys are written, all named after `win32RegValueName` from product.json ("Vousoir"):

	    *\shell\Vousoir                        right-click a file            -> "%1"
	    Directory\shell\Vousoir                right-click a folder          -> "%V"
	    Directory\Background\shell\Vousoir     right-click inside a folder   -> "%V"
	    Drive\shell\Vousoir                    right-click a drive           -> "%V"
	    DesktopBackground\Shell\Vousoir        right-click the desktop       -> resolved desktop path

	`Directory\Background` is the one people forget and the one that gets used most — it is the
	empty space inside an open folder window.

	On Windows 11 these appear under "Show more options" (Shift+F10 / Shift+right-click), not on
	the short modern menu. The modern menu needs an MSIX sparse package containing Microsoft's
	signed `code_explorer_command_x64.dll`, which requires a code-signing certificate; that is
	out of scope. See scripts/../build/win32/explorer-dll-fetcher.ts.

	Re-running is safe: every value is overwritten in place. `-Uninstall` deletes exactly the
	five keys above and nothing else.

.PARAMETER Path
	Full path to Vousoir.exe. When omitted, the usual build and install locations are probed:
	<repo-parent>\VSCode-win32-x64\Vousoir.exe, the arm64 sibling, then the per-user and
	machine-wide install directories.

	Do not point this at .build\electron\Vousoir.exe — the from-sources Electron shell needs the
	app directory as its first argument and will not open a file passed on its own.

.PARAMETER Label
	Menu text. Defaults to the installer's own string, "Open w&ith &Vousoir" (the ampersands are
	keyboard accelerators and are not displayed).

.PARAMETER Uninstall
	Remove the entries instead of writing them. -Path is not needed.

.EXAMPLE
	.\scripts\vousoir-shell-integration.ps1
.EXAMPLE
	.\scripts\vousoir-shell-integration.ps1 -Path 'D:\Vousoir\Vousoir.exe'
.EXAMPLE
	.\scripts\vousoir-shell-integration.ps1 -Uninstall
#>
[CmdletBinding()]
param(
    [string]$Path,
    [string]$Label,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent

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

# --- Identity --------------------------------------------------------------
# Read from product.json so this stays in lockstep with what code.iss would write.
$productPath = Join-Path $repoRoot 'product.json'
if (-not (Test-Path $productPath)) { Fail "product.json not found at $productPath." "Run this script from inside the Vousoir repo." }
$product = Get-Content $productPath -Raw | ConvertFrom-Json

$regValueName   = $product.win32RegValueName    # "Vousoir" - the key name, per code.iss {#RegValueName}
$shellNameShort = $product.win32ShellNameShort  # "&Vousoir" - per code.iss {#ShellNameShort}
$exeBasename    = $product.nameShort            # "Vousoir" -> Vousoir.exe

if (-not $regValueName) { Fail "product.json has no win32RegValueName." "" }
if (-not $Label) {
    # Mirrors {cm:OpenWithCodeContextMenu,{#ShellNameShort}}; messages.en.isl defines
    # OpenWithCodeContextMenu=Open w&ith %1
    $Label = "Open w&ith $shellNameShort"
}

# The five keys, all under HKCU\Software\Classes. Written with the .NET registry API rather than
# the PowerShell registry provider because `*\shell\...` would otherwise be parsed as a wildcard.
$desktopDir = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
$entries = @(
    @{ Key = "Software\Classes\*\shell\$regValueName";                    Arg = '%1';         What = 'a file' }
    @{ Key = "Software\Classes\Directory\shell\$regValueName";            Arg = '%V';         What = 'a folder' }
    @{ Key = "Software\Classes\Directory\Background\shell\$regValueName"; Arg = '%V';         What = 'empty space inside a folder' }
    @{ Key = "Software\Classes\Drive\shell\$regValueName";                Arg = '%V';         What = 'a drive' }
    # DesktopBackground does not substitute %V, so the desktop path is resolved now and baked in.
    @{ Key = "Software\Classes\DesktopBackground\Shell\$regValueName";    Arg = $desktopDir;  What = 'the desktop' }
)

Write-Host ""
Write-Host "  Vousoir Explorer shell integration" -ForegroundColor White

# Deletes the parent chain above a removed key, but only while each parent holds nothing at all -
# no subkeys, no values. `DesktopBackground\Shell` in particular does not exist until this script
# creates it, so leaving it behind would not be a clean reversal. Stops at Software\Classes.
function Remove-EmptyAncestors {
    param([string]$Key)

    $parent = Split-Path $Key -Parent
    while ($parent -and $parent -ne 'Software\Classes' -and $parent.StartsWith('Software\Classes\')) {
        $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($parent)
        if ($null -eq $k) { return }
        $empty = ($k.SubKeyCount -eq 0 -and $k.ValueCount -eq 0)
        $k.Close()
        if (-not $empty) { return }

        [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($parent, $false)
        Write-Ok "pruned empty HKCU\$parent"
        $parent = Split-Path $parent -Parent
    }
}

# --- Uninstall -------------------------------------------------------------
if ($Uninstall) {
    Write-Host ""
    Write-Host "==> Removing context-menu entries" -ForegroundColor Cyan

    $removed = 0
    foreach ($e in $entries) {
        $existing = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($e.Key)
        if ($null -eq $existing) {
            Write-Warn "not present: HKCU\$($e.Key)"
            continue
        }
        $existing.Close()
        [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($e.Key, $false)
        Write-Ok "removed HKCU\$($e.Key)"
        Remove-EmptyAncestors $e.Key
        $removed++
    }

    # Verify nothing survived.
    $leftover = @($entries | Where-Object {
        $k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($_.Key)
        if ($k) { $k.Close(); $true } else { $false }
    })
    if ($leftover.Count -gt 0) {
        Fail "$($leftover.Count) key(s) still present after removal." (($leftover | ForEach-Object { "HKCU\$($_.Key)" }) -join "`n")
    }

    Write-Host ""
    Write-Host "  Removed $removed of $($entries.Count) entries. Nothing else was touched." -ForegroundColor Green
    Write-Host ""
    exit 0
}

# --- Locate the executable -------------------------------------------------
if (-not $Path) {
    $repoParent = Split-Path $repoRoot -Parent
    $candidates = @(
        (Join-Path $repoParent "VSCode-win32-x64\$exeBasename.exe")
        (Join-Path $repoParent "VSCode-win32-arm64\$exeBasename.exe")
        (Join-Path $env:LOCALAPPDATA "Programs\$($product.win32DirName)\$exeBasename.exe")
        (Join-Path ${env:ProgramFiles} "$($product.win32DirName)\$exeBasename.exe")
    )
    $Path = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $Path) {
        Fail "Could not find $exeBasename.exe." @"
Looked in:
$($candidates | ForEach-Object { "  $_" } | Out-String)
Build it first:
  .\build.ps1

Or point at it explicitly:
  .\scripts\vousoir-shell-integration.ps1 -Path 'C:\path\to\$exeBasename.exe'
"@
    }
}

$Path = (Resolve-Path -LiteralPath $Path).Path
if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Fail "$Path is not a file." "" }
if ([IO.Path]::GetExtension($Path) -ne '.exe') { Fail "$Path is not an .exe." "" }

if ($Path -like "*\.build\electron\*") {
    Write-Warn "That is the from-sources Electron shell. It needs the app directory as its"
    Write-Warn "first argument, so Explorer will launch it with an empty window instead of"
    Write-Warn "the file you clicked. Use the build.ps1 output instead."
}

Write-Ok "target: $Path"

# --- Write -----------------------------------------------------------------
Write-Host ""
Write-Host "==> Writing context-menu entries (HKCU, no elevation needed)" -ForegroundColor Cyan

$expand = [Microsoft.Win32.RegistryValueKind]::ExpandString

foreach ($e in $entries) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($e.Key)
    try {
        $key.SetValue('', $Label, $expand)
        $key.SetValue('Icon', $Path, $expand)
    } finally {
        $key.Close()
    }

    $cmd = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("$($e.Key)\command")
    try {
        $cmd.SetValue('', "`"$Path`" `"$($e.Arg)`"", $expand)
    } finally {
        $cmd.Close()
    }

    Write-Ok "right-click $($e.What)"
}

# --- Verify by reading back ------------------------------------------------
Write-Host ""
Write-Host "==> Verifying" -ForegroundColor Cyan

$problems = @()
foreach ($e in $entries) {
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($e.Key)
    if ($null -eq $key) { $problems += "HKCU\$($e.Key) is missing"; continue }
    try {
        if ($key.GetValue('') -ne $Label) { $problems += "HKCU\$($e.Key) label is '$($key.GetValue(''))'" }
        if ($key.GetValue('Icon') -ne $Path) { $problems += "HKCU\$($e.Key) icon is '$($key.GetValue('Icon'))'" }
    } finally {
        $key.Close()
    }

    $cmd = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("$($e.Key)\command")
    if ($null -eq $cmd) { $problems += "HKCU\$($e.Key)\command is missing"; continue }
    try {
        $expected = "`"$Path`" `"$($e.Arg)`""
        $actual = $cmd.GetValue('', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        if ($actual -ne $expected) { $problems += "HKCU\$($e.Key)\command is '$actual', expected '$expected'" }
    } finally {
        $cmd.Close()
    }
}

if ($problems.Count -gt 0) {
    Fail "Read-back did not match what was written." ($problems -join "`n")
}
Write-Ok "all $($entries.Count) entries read back correctly"

# Tell the shell associations changed. Legacy verbs are read on demand so this is belt-and-braces,
# but it makes the entries show up without waiting for an Explorer restart.
try {
    if (-not ('Vousoir.Shell32' -as [type])) {
        Add-Type -Namespace Vousoir -Name Shell32 -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("shell32.dll")]
public static extern void SHChangeNotify(int eventId, uint flags, System.IntPtr item1, System.IntPtr item2);
'@
    }
    # SHCNE_ASSOCCHANGED (0x08000000), SHCNF_IDLIST (0x0000)
    [Vousoir.Shell32]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    Write-Ok "shell notified"
} catch {
    Write-Warn "could not notify the shell ($($_.Exception.Message)); restart Explorer if the entry does not appear"
}

# --- Summary ---------------------------------------------------------------
Write-Host ""
Write-Host "  Done. Right-click a file or folder in Explorer." -ForegroundColor Green
Write-Host ""
Write-Host "  On Windows 11 the entry lives under 'Show more options' (Shift+right-click)." -ForegroundColor DarkGray
Write-Host "  The short modern menu needs a signed MSIX sparse package - out of scope." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Remove with:  .\scripts\vousoir-shell-integration.ps1 -Uninstall" -ForegroundColor White
Write-Host ""
