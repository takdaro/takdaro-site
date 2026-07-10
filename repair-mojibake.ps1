param(
    [string]$Root = "."
)

$ErrorActionPreference = "Stop"

$TextExtensions = @(
    ".html", ".htm", ".css", ".js", ".json", ".md", ".txt", ".sql", ".xml", ".yml", ".yaml"
)

$BackupRoot = Join-Path $Root ("backup-mojibake-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Latin1 = [System.Text.Encoding]::GetEncoding("ISO-8859-1")
$Win1252 = [System.Text.Encoding]::GetEncoding(1252)

function Test-Mojibake {
    param([string]$Text)
    return ($Text.Contains("Ø") -or $Text.Contains("Ù") -or $Text.Contains("â€") -or $Text.Contains("Ã") -or $Text.Contains([char]65533))
}

function Repair-Once {
    param(
        [string]$Text,
        [System.Text.Encoding]$SourceEncoding
    )
    try {
        $bytes = $SourceEncoding.GetBytes($Text)
        return [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    catch {
        return $null
    }
}

function Score-Text {
    param([string]$Text)

    $score = 0

    if ($Text.Contains("Ø") -or $Text.Contains("Ù") -or $Text.Contains("â€") -or $Text.Contains("Ã") -or $Text.Contains([char]65533)) {
        $score -= 8
    }

    $goodWords = @(
        "ورود","ثبت","حساب","کاربری","رمز","سفارش","تجارت","محصول",
        "ایمیل","شماره","تماس","بازیابی","کیف","پنل"
    )

    foreach ($w in $goodWords) {
        if ($Text.Contains($w)) {
            $score += 10
        }
    }

    return $score
}

$rootPath = (Resolve-Path -LiteralPath $Root).Path

$files = Get-ChildItem -Path $Root -Recurse -File | Where-Object {
    $TextExtensions -contains $_.Extension.ToLower() -and
    $_.FullName -notlike "$BackupRoot*" -and
    $_.FullName -notmatch [regex]::Escape("\.git\") -and
    $_.FullName -notmatch [regex]::Escape("\.wrangler\")
}

$changed = @()
$skipped = @()

foreach ($file in $files) {
    try {
        $originalText = [System.IO.File]::ReadAllText($file.FullName)

        if (-not (Test-Mojibake $originalText)) {
            $skipped += [PSCustomObject]@{
                File = $file.FullName
                Reason = "No mojibake pattern detected"
            }
            continue
        }

        $candidate1 = Repair-Once -Text $originalText -SourceEncoding $Latin1
        $candidate2 = Repair-Once -Text $originalText -SourceEncoding $Win1252

        $candidates = @()

        $candidates += [PSCustomObject]@{
            Name = "original"
            Text = $originalText
            Score = (Score-Text $originalText)
        }

        if ($null -ne $candidate1) {
            $candidates += [PSCustomObject]@{
                Name = "latin1"
                Text = $candidate1
                Score = (Score-Text $candidate1)
            }
        }

        if ($null -ne $candidate2) {
            $candidates += [PSCustomObject]@{
                Name = "win1252"
                Text = $candidate2
                Score = (Score-Text $candidate2)
            }
        }

        $best = $candidates | Sort-Object Score -Descending | Select-Object -First 1

        if ($best.Name -eq "original" -or [string]::IsNullOrWhiteSpace($best.Text)) {
            $skipped += [PSCustomObject]@{
                File = $file.FullName
                Reason = "Could not confidently improve text"
            }
            continue
        }

        $relative = $file.FullName.Substring($rootPath.Length).TrimStart([char]92, [char]47)
        $backupPath = Join-Path $BackupRoot $relative
        $backupDir = Split-Path $backupPath -Parent

        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $backupPath -Force

        [System.IO.File]::WriteAllText($file.FullName, $best.Text, $Utf8NoBom)

        $changed += [PSCustomObject]@{
            File = $file.FullName
            Method = $best.Name
            Score = $best.Score
        }
    }
    catch {
        $skipped += [PSCustomObject]@{
            File = $file.FullName
            Reason = $_.Exception.Message
        }
    }
}

Write-Host ""
Write-Host ("Backup folder: {0}" -f $BackupRoot)
Write-Host ("Changed files: {0}" -f $changed.Count)
Write-Host ("Skipped files: {0}" -f $skipped.Count)
Write-Host ""

if ($changed.Count -gt 0) {
    Write-Host "=== Changed ==="
    foreach ($item in $changed) {
        Write-Host ("[{0}] {1}" -f $item.Method, $item.File)
    }
    Write-Host ""
}

if ($skipped.Count -gt 0) {
    Write-Host "=== Skipped ==="
    $skipped | Select-Object -First 30 | ForEach-Object {
        Write-Host ("[{0}] {1}" -f $_.Reason, $_.File)
    }
}