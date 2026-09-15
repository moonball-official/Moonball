param(
  [switch]$Publish,
  [string]$NodeRuntimeDirectory = $env:MOONBALL_NODE22_HOME
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Publish) {
  throw "Source-publication approval flag missing. Re-run with -Publish after reviewing the local preflight."
}

if ([string]::IsNullOrWhiteSpace($NodeRuntimeDirectory)) {
  $NodeRuntimeDirectory = Join-Path $env:LOCALAPPDATA "Moonball\runtimes\node-v22.23.2-win-x64"
}
$nodeExecutable = Join-Path $NodeRuntimeDirectory "node.exe"
$npmExecutable = Join-Path $NodeRuntimeDirectory "npm.cmd"
if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf) -or
    -not (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
  throw "The approved Node 22 runtime was not found at $NodeRuntimeDirectory. Source publication was not started."
}
$runtimeVersion = (& $nodeExecutable -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0 -or [int]($runtimeVersion.Split(".")[0]) -ne 22) {
  throw "Node 22 is required for source verification; found v$runtimeVersion."
}

$onchainDirectory = Split-Path -Parent $PSScriptRoot
$previousDirectory = Get-Location
$previousPath = [Environment]::GetEnvironmentVariable("Path", "Process")
$previousPublish = [Environment]::GetEnvironmentVariable(
  "PUBLISH_SOURCE_VERIFICATION",
  "Process"
)

try {
  Set-Location -LiteralPath $onchainDirectory
  $env:Path = "$NodeRuntimeDirectory;$previousPath"
  $env:PUBLISH_SOURCE_VERIFICATION = "1"
  Write-Host "Publishing the verified Base Sepolia candidate sources."
  Write-Host "Services: Sourcify + Base Sepolia Blockscout; BaseScan only if ETHERSCAN_API_KEY is locally configured."
  Write-Host "No private key, signature, or blockchain transaction is used."
  & $npmExecutable run verify:sources:base-sepolia
  if ($LASTEXITCODE -ne 0) {
    throw "One or more source-verification services failed. Re-running is safe and sends no transaction."
  }
} finally {
  if ($null -eq $previousPublish) {
    Remove-Item Env:\PUBLISH_SOURCE_VERIFICATION -ErrorAction SilentlyContinue
  } else {
    $env:PUBLISH_SOURCE_VERIFICATION = $previousPublish
  }
  $env:Path = $previousPath
  Set-Location -LiteralPath $previousDirectory
}
