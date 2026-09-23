param(
  [switch]$Approved,
  [string]$NodeRuntimeDirectory = $env:MOONBALL_NODE22_HOME
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Approved) {
  throw "Market deployment approval flag missing. No transaction was started."
}

if ([string]::IsNullOrWhiteSpace($NodeRuntimeDirectory)) {
  $NodeRuntimeDirectory = Join-Path $env:LOCALAPPDATA "Moonball\runtimes\node-v22.23.2-win-x64"
}
$nodeExecutable = Join-Path $NodeRuntimeDirectory "node.exe"
$npmExecutable = Join-Path $NodeRuntimeDirectory "npm.cmd"
if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf) -or
    -not (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
  throw "The approved portable Node 22 runtime was not found. No transaction was started."
}
$runtimeVersion = (& $nodeExecutable -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0 -or [int]($runtimeVersion.Split(".")[0]) -ne 22) {
  throw "Node 22 is required for this Windows workflow. No transaction was started."
}

$onchainDirectory = Split-Path -Parent $PSScriptRoot
$previousDirectory = Get-Location
$previousPath = [Environment]::GetEnvironmentVariable("Path", "Process")
$previousKey = [Environment]::GetEnvironmentVariable("DEPLOYER_PRIVATE_KEY", "Process")
$previousApproval = [Environment]::GetEnvironmentVariable("MARKET_INFRASTRUCTURE_APPROVED", "Process")
$secureKey = $null
$keyPointer = [IntPtr]::Zero

try {
  Set-Location -LiteralPath $onchainDirectory
  $env:Path = "$NodeRuntimeDirectory;$previousPath"
  Write-Host "Approved scope: Base Sepolia fee splitter + official-market registry only."
  Write-Host "Excluded: mainnet, oracle updates, pool creation/registration, liquidity, vesting."
  Write-Host "Runtime: Node v$runtimeVersion (portable; process-local PATH only)."

  Write-Host "`n1/3 Read-only market preflight"
  & $npmExecutable run market:base-sepolia:preflight
  if ($LASTEXITCODE -ne 0) {
    throw "Market preflight failed. No transaction was started."
  }

  $secureKey = Read-Host "Enter the Base Sepolia deployer private key (input hidden)" -AsSecureString
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) {
    throw "No private key was entered. No transaction was started."
  }
  $env:DEPLOYER_PRIVATE_KEY = $plainKey
  $plainKey = $null
  $env:MARKET_INFRASTRUCTURE_APPROVED = "BASE_SEPOLIA_SPLITTER_AND_REGISTRY_ONLY"

  Write-Host "`n2/3 Deploying only the approved market infrastructure"
  & $npmExecutable run market:base-sepolia:deploy
  if ($LASTEXITCODE -ne 0) {
    throw "Market deployment stopped. Inspect the partial marker and chain state before retrying."
  }

  Write-Host "`n3/3 Independently verifying recorded contracts (read-only)"
  & $npmExecutable run market:base-sepolia:verify
  if ($LASTEXITCODE -ne 0) {
    throw "Market verification failed. Do not use the candidate contract addresses."
  }
  Write-Host "Base Sepolia market-infrastructure candidate deployment and verification PASSED."
} finally {
  if ($null -eq $previousKey) {
    Remove-Item Env:\DEPLOYER_PRIVATE_KEY -ErrorAction SilentlyContinue
  } else {
    $env:DEPLOYER_PRIVATE_KEY = $previousKey
  }
  if ($null -eq $previousApproval) {
    Remove-Item Env:\MARKET_INFRASTRUCTURE_APPROVED -ErrorAction SilentlyContinue
  } else {
    $env:MARKET_INFRASTRUCTURE_APPROVED = $previousApproval
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
