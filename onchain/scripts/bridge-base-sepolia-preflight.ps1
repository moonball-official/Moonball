param(
  [Parameter(Mandatory = $true)]
  [string]$DashboardUrl,
  [string]$NodeRuntimeDirectory = $env:MOONBALL_NODE22_HOME
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($NodeRuntimeDirectory)) {
  $NodeRuntimeDirectory = Join-Path $env:LOCALAPPDATA "Moonball\runtimes\node-v22.23.2-win-x64"
}
$nodeExecutable = Join-Path $NodeRuntimeDirectory "node.exe"
$npmExecutable = Join-Path $NodeRuntimeDirectory "npm.cmd"
if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf) -or
    -not (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
  throw "The approved Node 22 runtime was not found at $NodeRuntimeDirectory. Bridge preflight was not started."
}
$runtimeVersion = (& $nodeExecutable -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0 -or [int]($runtimeVersion.Split(".")[0]) -ne 22) {
  throw "Node 22 is required for bridge preflight; found v$runtimeVersion."
}

$onchainDirectory = Split-Path -Parent $PSScriptRoot
$previousDirectory = Get-Location
$managedVariables = @(
  "DEPLOYER_PRIVATE_KEY",
  "PRIVATE_KEY",
  "NETWORK",
  "DASHBOARD_URL",
  "ONCE",
  "DRY_RUN",
  "EXPECTED_SNAPSHOT_ID",
  "EXPECTED_SEQUENCE"
)
$previousValues = @{}
foreach ($name in $managedVariables) {
  $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
$previousPath = [Environment]::GetEnvironmentVariable("Path", "Process")

try {
  Set-Location -LiteralPath $onchainDirectory
  $env:Path = "$NodeRuntimeDirectory;$previousPath"
  Remove-Item Env:\DEPLOYER_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\EXPECTED_SNAPSHOT_ID -ErrorAction SilentlyContinue
  Remove-Item Env:\EXPECTED_SEQUENCE -ErrorAction SilentlyContinue
  $env:NETWORK = "baseSepolia"
  $env:DASHBOARD_URL = $DashboardUrl
  $env:ONCE = "1"
  $env:DRY_RUN = "1"

  Write-Host "Base Sepolia oracle snapshot preflight (read-only)."
  Write-Host "No private key, signature, or transaction is used."
  & $npmExecutable run bridge
  if ($LASTEXITCODE -ne 0) {
    throw "Bridge preflight failed; no snapshot is approved for publication."
  }
} finally {
  foreach ($name in $managedVariables) {
    $value = $previousValues[$name]
    if ($null -eq $value) {
      [Environment]::SetEnvironmentVariable($name, $null, "Process")
    } else {
      [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
  }
  $env:Path = $previousPath
  Set-Location -LiteralPath $previousDirectory
}
