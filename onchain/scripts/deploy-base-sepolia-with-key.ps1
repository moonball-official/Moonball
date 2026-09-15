param(
  [switch]$Approved,
  [string]$NodeRuntimeDirectory = $env:MOONBALL_NODE22_HOME
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $Approved) {
  throw "Deployment approval flag missing. Run only after explicit Base Sepolia deployment approval."
}

if ([string]::IsNullOrWhiteSpace($NodeRuntimeDirectory)) {
  $NodeRuntimeDirectory = Join-Path $env:LOCALAPPDATA "Moonball\runtimes\node-v22.23.2-win-x64"
}

$nodeExecutable = Join-Path $NodeRuntimeDirectory "node.exe"
$npmExecutable = Join-Path $NodeRuntimeDirectory "npm.cmd"
if (-not (Test-Path -LiteralPath $nodeExecutable -PathType Leaf) -or
    -not (Test-Path -LiteralPath $npmExecutable -PathType Leaf)) {
  throw "The approved Node 22 runtime was not found at $NodeRuntimeDirectory. Run scripts\install-node22-runtime.ps1 from your local terminal; deployment was not started."
}

$runtimeVersion = (& $nodeExecutable -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Could not validate the Node runtime. Deployment was not started."
}
$runtimeMajor = [int]($runtimeVersion.Split(".")[0])
if ($runtimeMajor -ne 22) {
  throw "Node 22 is required for this Windows deployment workflow; found v$runtimeVersion. Deployment was not started."
}

$onchainDirectory = Split-Path -Parent $PSScriptRoot
$previousDirectory = Get-Location
$previousKey = [Environment]::GetEnvironmentVariable("DEPLOYER_PRIVATE_KEY", "Process")
$previousPath = [Environment]::GetEnvironmentVariable("Path", "Process")
$secureKey = $null
$keyPointer = [IntPtr]::Zero

try {
  Set-Location -LiteralPath $onchainDirectory
  $env:Path = "$NodeRuntimeDirectory;$previousPath"
  Write-Host "Approved scope: Base Sepolia oracle + fixed-supply test MOON candidate deployment."
  Write-Host "Excluded: mainnet, oracle seed, pool creation, liquidity, and vesting."
  Write-Host "Runtime: Node v$runtimeVersion (portable; process-local PATH only)."
  $secureKey = Read-Host "Enter the Base Sepolia deployer private key (input hidden)" -AsSecureString
  $keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
  $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  if ([string]::IsNullOrWhiteSpace($plainKey)) {
    throw "No private key was entered."
  }

  # The key exists only in this process and its short-lived child processes.
  # The signer preflight must derive the configured DEPLOYER_ADDRESS before the
  # first transaction-bearing command runs.
  $env:DEPLOYER_PRIVATE_KEY = $plainKey
  $plainKey = $null

  Write-Host "`n1/3 Signer-confirming preflight (read-only)"
  $preflightPassed = $false
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    & $npmExecutable run preflight -- --network baseSepolia
    if ($LASTEXITCODE -eq 0) {
      $preflightPassed = $true
      break
    }
    if ($attempt -lt 3) {
      Write-Host "Read-only preflight attempt $attempt failed; retrying after a short RPC backoff."
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
  if (-not $preflightPassed) {
    throw "Signer-confirming preflight failed after 3 attempts; deployment was not started."
  }

  Write-Host "`n2/3 Deploying approved Base Sepolia candidate"
  & $npmExecutable run deploy -- --network baseSepolia
  if ($LASTEXITCODE -ne 0) {
    throw "Candidate deployment failed. Review chain state before retrying."
  }

  Write-Host "`n3/3 Verifying recorded deployment (read-only)"
  $verificationPassed = $false
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    & $npmExecutable run verify:deployment -- --network baseSepolia
    if ($LASTEXITCODE -eq 0) {
      $verificationPassed = $true
      break
    }
    if ($attempt -lt 3) {
      Write-Host "Read-only verification attempt $attempt failed; retrying after a short RPC backoff."
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
  if (-not $verificationPassed) {
    throw "Post-deployment verification failed after 3 attempts. Do not use the candidate addresses."
  }

  Write-Host "`nBase Sepolia candidate deployment and verification PASSED."
} finally {
  if ($null -eq $previousKey) {
    Remove-Item Env:\DEPLOYER_PRIVATE_KEY -ErrorAction SilentlyContinue
  } else {
    $env:DEPLOYER_PRIVATE_KEY = $previousKey
  }
  $previousKey = $null

  $env:Path = $previousPath
  $previousPath = $null

  if ($keyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  }
  if ($null -ne $secureKey) {
    $secureKey.Dispose()
  }
  Set-Location -LiteralPath $previousDirectory
}
