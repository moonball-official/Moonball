param(
  [switch]$Approved,
  [Parameter(Mandatory = $true)]
  [string]$DashboardUrl,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedSnapshotId,
  [Parameter(Mandatory = $true)]
  [UInt64]$ExpectedSequence,
  [string]$NodeRuntimeDirectory = $env:MOONBALL_NODE22_HOME
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Approved) {
  throw "Snapshot approval flag missing. Run only after reviewing and approving the exact preflight payload."
}
if ($ExpectedSnapshotId -notmatch '^0x[0-9a-fA-F]{64}$') {
  throw "ExpectedSnapshotId must be a bytes32 hex value from the approved preflight."
}
if ($ExpectedSequence -lt 1) {
  throw "ExpectedSequence must be at least 1."
}
if ([string]::IsNullOrWhiteSpace($NodeRuntimeDirectory)) {
  $NodeRuntimeDirectory = Join-Path $env:LOCALAPPDATA "Moonball\runtimes\node-v22.23.2-win-x64"
}
$nodeExecutable = Join-Path $NodeRuntimeDirectory "node.exe"
$npmExecutable = Join-Path $NodeRuntimeDirectory "npm.cmd"
if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf) -or
    -not (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
  throw "The approved Node 22 runtime was not found at $NodeRuntimeDirectory. Snapshot publication was not started."
}
$runtimeVersion = (& $nodeExecutable -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0 -or [int]($runtimeVersion.Split(".")[0]) -ne 22) {
  throw "Node 22 is required for snapshot publication; found v$runtimeVersion."
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
$secureKey = $null
$keyPointer = [IntPtr]::Zero

try {
  Set-Location -LiteralPath $onchainDirectory
  $env:Path = "$NodeRuntimeDirectory;$previousPath"
  Remove-Item Env:\DEPLOYER_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\PRIVATE_KEY -ErrorAction SilentlyContinue
  $env:NETWORK = "baseSepolia"
  $env:DASHBOARD_URL = $DashboardUrl
  $env:ONCE = "1"
  $env:DRY_RUN = "1"
  $env:EXPECTED_SNAPSHOT_ID = $ExpectedSnapshotId
  $env:EXPECTED_SEQUENCE = $ExpectedSequence.ToString()

  Write-Host "Approved scope: one exact Base Sepolia oracle snapshot."
  Write-Host "Expected sequence: $ExpectedSequence"
  Write-Host "Expected snapshot: $ExpectedSnapshotId"
  Write-Host "Excluded: mainnet, additional snapshots, pool creation, liquidity, and vesting."
  Write-Host "`n1/3 Revalidating approved payload (read-only)"
  & $npmExecutable run bridge
  if ($LASTEXITCODE -ne 0) {
    throw "Approved snapshot revalidation failed; no key was requested and no transaction was sent."
  }

  $secureKey = Read-Host "Enter the Base Sepolia updater private key (input hidden)" -AsSecureString
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) {
    throw "No private key was entered."
  }
  $env:PRIVATE_KEY = $plainKey
  $plainKey = $null
  $env:DRY_RUN = "0"

  Write-Host "`n2/3 Publishing the approved snapshot"
  & $npmExecutable run bridge
  if ($LASTEXITCODE -ne 0) {
    throw "Snapshot publication failed. Review chain state before retrying."
  }

  Write-Host "`n3/3 Verifying the candidate deployment (read-only)"
  & $npmExecutable run verify:deployment -- --network baseSepolia
  if ($LASTEXITCODE -ne 0) {
    throw "Post-publication verification failed. Do not publish another snapshot."
  }
  Write-Host "`nOne approved Base Sepolia oracle snapshot was published and verified."
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
  if ($keyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  }
  if ($null -ne $secureKey) {
    $secureKey.Dispose()
  }
  Set-Location -LiteralPath $previousDirectory
}
