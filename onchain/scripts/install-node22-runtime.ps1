param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$nodeVersion = "22.23.2"
$archiveName = "node-v$nodeVersion-win-x64.zip"
$downloadUri = "https://nodejs.org/dist/v$nodeVersion/$archiveName"
$expectedSha256 = "1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "Moonball\runtimes"
$runtimeDirectory = Join-Path $runtimeRoot "node-v$nodeVersion-win-x64"
$nodeExecutable = Join-Path $runtimeDirectory "node.exe"
$npmExecutable = Join-Path $runtimeDirectory "npm.cmd"

if ((Test-Path -LiteralPath $nodeExecutable -PathType Leaf) -and
    (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
  $installedVersion = (& $nodeExecutable -p "process.versions.node").Trim()
  if ($LASTEXITCODE -ne 0 -or $installedVersion -ne $nodeVersion) {
    throw "An unexpected Node runtime exists at $runtimeDirectory. Remove or inspect it manually before continuing."
  }

  Write-Host "Moonball portable Node v$installedVersion is already ready."
  Write-Host "Runtime: $runtimeDirectory"
  return
}

if (Test-Path -LiteralPath $runtimeDirectory) {
  throw "An incomplete runtime directory exists at $runtimeDirectory. Remove or inspect it manually before retrying."
}

$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("moonball-node22-" + [Guid]::NewGuid().ToString("N"))
$archivePath = Join-Path $temporaryDirectory $archiveName
$extractionDirectory = Join-Path $temporaryDirectory "extracted"

try {
  New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
  Write-Host "Downloading official portable Node v$nodeVersion from nodejs.org..."
  Invoke-WebRequest -UseBasicParsing -Uri $downloadUri -OutFile $archivePath

  $actualSha256 = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualSha256 -ne $expectedSha256) {
    throw "Node archive checksum mismatch. Expected $expectedSha256; got $actualSha256."
  }
  Write-Host "Archive SHA-256 verified."

  New-Item -ItemType Directory -Path $extractionDirectory | Out-Null
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractionDirectory
  $extractedRuntime = Join-Path $extractionDirectory "node-v$nodeVersion-win-x64"
  $extractedNode = Join-Path $extractedRuntime "node.exe"
  $extractedNpm = Join-Path $extractedRuntime "npm.cmd"
  if (-not (Test-Path -LiteralPath $extractedNode -PathType Leaf) -or
      -not (Test-Path -LiteralPath $extractedNpm -PathType Leaf)) {
    throw "The verified archive did not contain the expected Node and npm executables."
  }

  $extractedVersion = (& $extractedNode -p "process.versions.node").Trim()
  if ($LASTEXITCODE -ne 0 -or $extractedVersion -ne $nodeVersion) {
    throw "Extracted runtime version validation failed."
  }

  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  Move-Item -LiteralPath $extractedRuntime -Destination $runtimeDirectory

  Write-Host "Moonball portable Node v$extractedVersion is ready."
  Write-Host "Runtime: $runtimeDirectory"
  Write-Host "No system installation or PATH change was made."
} finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
