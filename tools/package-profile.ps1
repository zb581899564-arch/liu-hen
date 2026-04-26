param(
  [Parameter(Mandatory = $true)]
  [string]$ProfileDir,
  [Parameter(Mandatory = $true)]
  [string]$EmojiDir,
  [Parameter(Mandatory = $true)]
  [string]$OutputZip
)

$ErrorActionPreference = "Stop"

$requiredFiles = @(
  "meta.json",
  "persona.md",
  "relationship_context.md",
  "response_patterns.md",
  "memories.md",
  "sticker_profile.json",
  "sticker_library.json"
)

$stickers = Get-ChildItem -File $EmojiDir | Sort-Object Name | ForEach-Object {
  [ordered]@{
    md5 = $_.BaseName
    path = "stickers/$($_.Name)"
    format = $_.Extension.TrimStart(".").ToLowerInvariant()
    size = $_.Length
  }
}

$stickerLibraryPath = Join-Path $ProfileDir "sticker_library.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$stickerLibraryJson = @{ stickers = $stickers } | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($stickerLibraryPath, $stickerLibraryJson, $utf8NoBom)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $OutputZip) {
  Remove-Item $OutputZip -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($OutputZip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($fileName in $requiredFiles) {
    $source = Join-Path $ProfileDir $fileName
    if (-not (Test-Path $source)) {
      throw "Missing required profile file: $fileName"
    }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $source,
      "profile/$fileName",
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }

  foreach ($emoji in Get-ChildItem -File $EmojiDir) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip,
      $emoji.FullName,
      "stickers/$($emoji.Name)",
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
}
finally {
  $zip.Dispose()
}

Get-Item $OutputZip
