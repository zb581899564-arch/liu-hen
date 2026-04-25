param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [string]$Destination = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Destination)) {
  $Destination = Join-Path $PSScriptRoot 'app\src\main\assets\web'
}

if (-not (Test-Path $Source)) {
  throw "Source not found: $Source"
}

if (Test-Path $Destination) {
  Remove-Item -Recurse -Force $Destination
}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
