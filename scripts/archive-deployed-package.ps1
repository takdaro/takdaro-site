param([Parameter(Mandatory=$true)][string]$Source,
      [Parameter(Mandatory=$true)][string]$Inventory,
      [Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$sourceRoot = [IO.Path]::GetFullPath($Source).TrimEnd('\') + '\'
$files = Get-Content -LiteralPath $Inventory -Raw | ConvertFrom-Json
$zip = [IO.Compression.ZipFile]::Open($Archive, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($item in $files) {
    $name = [string]$item[0]
    if (!$name -or $name.Contains('\') -or $name.Split('/') -contains '..' -or $name.Split('/') -contains '.wrangler') { throw 'Unsafe archive path.' }
    $file = [IO.Path]::GetFullPath((Join-Path $Source $name.Replace('/','\')))
    if (!$file.StartsWith($sourceRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes source.' }
    if ((Get-Item -LiteralPath $file).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point not allowed.' }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne [string]$item[1]) { throw 'Source changed while archiving.' }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $zip.Dispose() }
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
  if ($zip.Entries.Count -ne $files.Count) { throw 'Archive entry count differs.' }
  foreach ($item in $files) {
    $entry = $zip.GetEntry([string]$item[0])
    if (!$entry) { throw 'Archive file missing.' }
    $stream = $entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($digest -ne [string]$item[1]) { throw 'Archived bytes differ from source inventory.' }
  }
} finally { $zip.Dispose() }
