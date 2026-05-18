param(
    [string]$Message = "",
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

function Stop-WithMessage {
    param([string]$Text)
    Write-Error $Text
    exit 1
}

function Get-GitOutput {
    param([string[]]$Arguments)

    $output = & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        Stop-WithMessage "git $($Arguments -join ' ') failed."
    }

    return $output
}

function Get-ChangedFiles {
    $entries = @(Get-GitOutput @("status", "--porcelain"))
    if ($entries.Count -eq 0) {
        return @()
    }

    $files = New-Object System.Collections.Generic.List[string]

    foreach ($entry in $entries) {
        if ($entry.Length -le 3) {
            continue
        }

        $pathPart = $entry.Substring(3)

        if ($pathPart -like "* -> *") {
            $paths = $pathPart -split " -> "
            foreach ($path in $paths) {
                if (-not [string]::IsNullOrWhiteSpace($path)) {
                    $files.Add($path.Replace("\", "/"))
                }
            }
            continue
        }

        $files.Add($pathPart.Replace("\", "/"))
    }

    return @($files | Sort-Object -Unique)
}

function Assert-NoBlockedFiles {
    param([string[]]$Files)

    $blockedPathPatterns = @(
        "(^|/)\.env($|[./])",
        "(^|/)\.env\.local$",
        "(^|/)\.data($|/)",
        "(^|/)uploads($|/)",
        "\.pem$",
        "\.key$",
        "id_rsa$",
        "id_ed25519$",
        "(^|/)(credentials|secrets?)($|[./_-])",
        "(^|/).*(api[_-]?keys?|secrets?|tokens?|credentials).*$"
    )

    foreach ($file in $Files) {
        foreach ($pattern in $blockedPathPatterns) {
            if ($file -match $pattern) {
                Stop-WithMessage "Refusing to commit possible secret or upload file: $file"
            }
        }
    }
}

function Assert-NoCredentialLiterals {
    param([string[]]$Files)

    $credentialPatterns = @(
        "(?i)(api[_-]?key|secret|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*[:=]\s*['""]?[A-Za-z0-9_./+=-]{16,}",
        "(?i)(password|passwd|pwd)\s*[:=]\s*['""]?[^'""]{12,}"
    )

    foreach ($file in $Files) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            continue
        }

        foreach ($pattern in $credentialPatterns) {
            $matches = Select-String -LiteralPath $file -Pattern $pattern -ErrorAction SilentlyContinue
            if ($matches) {
                Stop-WithMessage "Refusing to commit possible credential literal in: $file"
            }
        }
    }
}

$repoRoot = (Get-GitOutput @("rev-parse", "--show-toplevel")).Trim()
Set-Location $repoRoot

$currentBranch = (Get-GitOutput @("branch", "--show-current")).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    Stop-WithMessage "Detached HEAD is not supported. Switch to a codex/<task-name> branch first."
}

if (-not $currentBranch.StartsWith("codex/")) {
    Stop-WithMessage "Current branch is '$currentBranch'. Refusing to run unless the branch starts with codex/."
}

Write-Host "Current branch: $currentBranch"
Get-GitOutput @("status", "--short", "--branch") | Out-Host

$status = @(Get-GitOutput @("status", "--porcelain"))
if ($status.Count -eq 0) {
    Write-Host "No changes to commit."
    exit 0
}

$changedFiles = @(Get-ChangedFiles)
Assert-NoBlockedFiles -Files $changedFiles
Assert-NoCredentialLiterals -Files $changedFiles

Get-GitOutput @("add", "--all") | Out-Null

$staged = @(Get-GitOutput @("diff", "--cached", "--name-only"))
if ($staged.Count -eq 0) {
    Write-Host "No staged changes to commit."
    exit 0
}

Assert-NoBlockedFiles -Files $staged
Assert-NoCredentialLiterals -Files $staged

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
