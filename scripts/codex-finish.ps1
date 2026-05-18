param(
    [string]$TaskName = "",
    [string]$Message = "",
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

function Stop-WithMessage {
    param([string]$Text)
    Write-Error $Text
    exit 1
}

function Convert-ToSlug {
    param([string]$Text)

    $slug = $Text.Trim().ToLowerInvariant()
    $slug = $slug -replace "[^a-z0-9._-]+", "-"
    $slug = $slug -replace "^-+", ""
    $slug = $slug -replace "-+$", ""

    if ([string]::IsNullOrWhiteSpace($slug)) {
        Stop-WithMessage "TaskName must contain at least one letter or number."
    }

    return $slug
}

function Get-GitOutput {
    param([string[]]$Arguments)

    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        Stop-WithMessage "git $($Arguments -join ' ') failed."
    }

    return $output
}

$repoRoot = (Get-GitOutput @("rev-parse", "--show-toplevel")).Trim()
Set-Location $repoRoot

$currentBranch = (Get-GitOutput @("branch", "--show-current")).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    Stop-WithMessage "Detached HEAD is not supported. Switch to a codex/<task-name> branch first."
}

if ($currentBranch -eq "main" -or $currentBranch -eq "master") {
    if ([string]::IsNullOrWhiteSpace($TaskName)) {
        Stop-WithMessage "Refusing to commit or push from $currentBranch. Re-run with -TaskName <task-name> to create a codex/<task-name> branch."
    }

    $currentBranch = "codex/$(Convert-ToSlug $TaskName)"
    Get-GitOutput @("switch", "-c", $currentBranch) | Out-Null
}

if (-not $currentBranch.StartsWith("codex/")) {
    Stop-WithMessage "Current branch is '$currentBranch'. Expected a branch named codex/<task-name>."
}

$status = @(Get-GitOutput @("status", "--porcelain"))
if ($status.Count -eq 0) {
    Write-Host "No changes to commit."
    if (-not $SkipPush) {
        Get-GitOutput @("push", "-u", "origin", $currentBranch) | Out-Host
    }
    exit 0
}

$blockedPatterns = @(
    "(^|/)\.env($|[./])",
    "\.pem$",
    "\.key$",
    "id_rsa$",
    "id_ed25519$",
    "credentials",
    "secret"
)

$changedFiles = @(
    Get-GitOutput @("status", "--porcelain", "-z") -split "`0" |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object {
            $entry = $_
            if ($entry.Length -gt 3) {
                $entry.Substring(3).Replace("\", "/")
            }
        }
)

foreach ($file in $changedFiles) {
    foreach ($pattern in $blockedPatterns) {
        if ($file -match $pattern) {
            Stop-WithMessage "Refusing to commit possible secret file: $file"
        }
    }
}

Get-GitOutput @("add", "--all") | Out-Null

$staged = @(Get-GitOutput @("diff", "--cached", "--name-only"))
if ($staged.Count -eq 0) {
    Write-Host "No staged changes to commit."
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    $branchTask = $currentBranch.Substring("codex/".Length)
    $Message = "Codex task update: $branchTask"
}

Get-GitOutput @("commit", "-m", $Message) | Out-Host

if ($SkipPush) {
    Write-Host "SkipPush set; branch was not pushed."
    exit 0
}

Get-GitOutput @("push", "-u", "origin", $currentBranch) | Out-Host
