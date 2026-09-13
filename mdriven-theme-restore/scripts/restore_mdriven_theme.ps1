[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Root = (Join-Path $env:LOCALAPPDATA 'MDrivenTurnkeyCoreLocal'),
    [switch]$Repair,
    [switch]$ForceDefault,
    [string]$SourceCss,
    [ValidateRange(0, 65535)]
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'

function Get-ThemeFileInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{
            path = $Path
            exists = $false
            bytes = 0
            sha256 = $null
            validCompiledTheme = $false
        }
    }

    $item = Get-Item -LiteralPath $Path
    $isPlausibleSize = $item.Length -ge 10000
    $hasThemeSelectors = $false
    $hasSurfaceColors = $false

    if ($item.Length -gt 0) {
        $hasThemeSelectors = Select-String -LiteralPath $Path -Pattern '\.tk-' -Quiet
        $hasSurfaceColors = Select-String -LiteralPath $Path -Pattern 'background(?:-color)?\s*:\s*(?:rgb|#)' -Quiet
    }

    [pscustomobject]@{
        path = $item.FullName
        exists = $true
        bytes = $item.Length
        sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
        validCompiledTheme = ($isPlausibleSize -and $hasThemeSelectors -and $hasSurfaceColors)
    }
}

function Get-EffectiveTheme {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Candidates
    )

    foreach ($candidate in $Candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return Get-ThemeFileInfo -Path $candidate
        }
    }

    return $null
}

if ($ForceDefault -and -not $Repair) {
    throw '-ForceDefault requires -Repair.'
}

$resolvedRoot = [System.IO.Path]::GetFullPath($Root)
if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
    throw "MDriven Turnkey root does not exist: $resolvedRoot"
}

$contentPath = Join-Path $resolvedRoot 'Content'
if (-not (Test-Path -LiteralPath $contentPath -PathType Container)) {
    throw "Content directory does not exist: $contentPath"
}

$userThemeInScss = Join-Path $contentPath 'scss\theme-user.css'
$userThemeInContent = Join-Path $contentPath 'theme-user.css'
$defaultTheme = Join-Path $contentPath 'theme-default.css'
$defaultBackup = Join-Path $contentPath 'theme-default-old.css'
$themeCandidates = @($userThemeInScss, $userThemeInContent, $defaultTheme)
$actions = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()
$sourceInfo = $null

if ($Repair) {
    $selectedSource = if ($SourceCss) {
        [System.IO.Path]::GetFullPath($SourceCss)
    }
    else {
        $defaultBackup
    }

    $sourceInfo = Get-ThemeFileInfo -Path $selectedSource
    if (-not $sourceInfo.validCompiledTheme) {
        throw "Restore source is missing or is not a plausible compiled MDriven theme: $selectedSource"
    }

    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    foreach ($userTheme in @($userThemeInScss, $userThemeInContent)) {
        if (-not (Test-Path -LiteralPath $userTheme -PathType Leaf)) {
            continue
        }

        $userInfo = Get-ThemeFileInfo -Path $userTheme
        $shouldDisable = $ForceDefault -or ($userInfo.bytes -eq 0)
        if (-not $shouldDisable) {
            $warnings.Add("A nonempty user theme remains active and takes precedence: $userTheme")
            continue
        }

        $disabledPath = "$userTheme.disabled-$timestamp"
        if ($PSCmdlet.ShouldProcess($userTheme, "Rename to $disabledPath")) {
            Move-Item -LiteralPath $userTheme -Destination $disabledPath
            $actions.Add("Disabled user theme: $userTheme -> $disabledPath")
        }
    }

    $currentDefault = Get-ThemeFileInfo -Path $defaultTheme
    if (-not $currentDefault.exists -or $currentDefault.sha256 -ne $sourceInfo.sha256) {
        if ($currentDefault.exists) {
            $preservedDefault = "$defaultTheme.backup-$timestamp"
            if ($PSCmdlet.ShouldProcess($defaultTheme, "Back up to $preservedDefault")) {
                Copy-Item -LiteralPath $defaultTheme -Destination $preservedDefault
                $actions.Add("Backed up existing default: $defaultTheme -> $preservedDefault")
            }
        }

        if ($PSCmdlet.ShouldProcess($defaultTheme, "Restore from $selectedSource")) {
            Copy-Item -LiteralPath $selectedSource -Destination $defaultTheme -Force
            $actions.Add("Restored default theme: $selectedSource -> $defaultTheme")
        }
    }
    else {
        $actions.Add('Default theme already matches the verified source; no copy needed.')
    }
}

$effectiveTheme = Get-EffectiveTheme -Candidates $themeCandidates
$defaultInfo = Get-ThemeFileInfo -Path $defaultTheme
$httpCheck = $null

if ($Port -gt 0) {
    $themeUri = "http://localhost:$Port/Content/theme-default.css"
    try {
        $response = Invoke-WebRequest -Uri $themeUri -Method Head -TimeoutSec 8 -UseBasicParsing
        $httpCheck = [pscustomobject]@{
            uri = $themeUri
            status = [int]$response.StatusCode
            contentType = $response.Headers['Content-Type']
            contentLength = $response.Headers['Content-Length']
        }
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        $httpCheck = [pscustomobject]@{
            uri = $themeUri
            status = $statusCode
            error = $_.Exception.Message
        }
    }
}

$healthy = $null -ne $effectiveTheme -and $effectiveTheme.validCompiledTheme
if ($null -ne $effectiveTheme -and -not $effectiveTheme.validCompiledTheme) {
    $warnings.Add("The effective theme exists but appears empty or invalid: $($effectiveTheme.path)")
}
elseif ($null -eq $effectiveTheme) {
    $warnings.Add('No theme file exists at any path used by MDriven Turnkey.')
}

[pscustomobject]@{
    status = if ($healthy) { 'HEALTHY' } else { 'THEME_MISSING_OR_INVALID' }
    root = $resolvedRoot
    repairRequested = [bool]$Repair
    forceDefault = [bool]$ForceDefault
    effectiveTheme = $effectiveTheme
    defaultTheme = $defaultInfo
    restoreSource = $sourceInfo
    actions = @($actions)
    warnings = @($warnings)
    httpCheck = $httpCheck
    restartRequired = $false
    browserRefreshRecommended = [bool]$Repair
} | ConvertTo-Json -Depth 8
