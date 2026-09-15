# Base Sepolia Rehearsal Runbook

- **Status:** Base Sepolia candidate recovery and independent read-only
  verification passed on 2026-09-11 UTC. Oracle:
  `0x67B5b3147072bd13D4bA41eCF7f7b3531CED7EEE`; MOON:
  `0x70171D11Dfe7791431F06c8E1e7837517394D58D`.
- **Source verification:** Completed on 2026-09-15 UTC. Sourcify reports exact
  creation/runtime matches and Base Sepolia Blockscout reports full verification
  for both candidate contracts.
- **Current gate:** Keep the deployment at status `candidate`. Deploy and review
  the dashboard on Railway using `docs/deployment/RAILWAY.md`, then run the
  no-key bridge preflight against its working HTTPS endpoint. Do not seed the
  oracle, create a pool, add liquidity, deploy vesting, or use mainnet without
  the corresponding approval gate.

Keep all private keys local. Do not paste them into chat, documentation, source
control, deployment records, or command output. Git ignore does not prevent
OneDrive/cloud sync: keep keys outside synced folders. Read-only preflight can
use just `DEPLOYER_ADDRESS`, with both private-key variables unset.

## 1. Configure `onchain/.env`

Copy `onchain/.env.example` to `onchain/.env` and configure:

```dotenv
DEPLOYER_ADDRESS=0x...
BASE_SEPOLIA_RPC_URL=https://...
UPDATER_ADDRESS=0x...
SUPPLY_RECIPIENT=0x...
SAFE_ADDRESS=0x...
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
ORACLE_STALENESS=14400
```

Use a dedicated updater account. A 2-of-3 Safe is recommended for rehearsal and
is required for mainnet. Do not set `SEED_JACKPOT_M`; public networks reject it.

## 2. Verify the source tree

From the repository root:

```powershell
npm ci
npm run check
npm run test:verifier
npm --prefix onchain test
npx tsc -p onchain/tsconfig.json --noEmit
npm run build
npm audit --omit=dev
```

The production audit must report zero advisories. Review the separate development
tool findings before using the deployment workstation.

## 3. Run the read-only network preflight

```powershell
cd onchain
npm run preflight -- --network baseSepolia
```

This checks the 84532 chain ID, funded deployer, explicit addresses, official
Base Sepolia USDC, USDC bytecode/decimals, staleness range, and Safe structure.
It sends no transaction and prints no private key. Address-only mode does not
prove key control or signing readiness. If a signer is configured, its address
must match `DEPLOYER_ADDRESS` when supplied. A missing supply recipient remains
an error; it is never inferred from the deployer.

After the address-only check passes, confirm key control through a hidden local
prompt. The key exists only in the prompt process and its preflight child; it is
cleared immediately afterward and never written to `.env`:

```powershell
npm.cmd run preflight:signer
```

This is still read-only and sends no transaction.

## 4. Deploy the candidate contracts

Only after both preflight modes pass and deployment is explicitly approved,
supply `DEPLOYER_PRIVATE_KEY` securely through the local process environment
(outside synced files). Ensure the signing account remains the confirmed
preflight deployer before deploying.

On Windows, after explicit approval, use the guarded interactive runner. The
`-Approved` flag records the approval gate; the hidden prompt supplies the key
only to the signer preflight, deployment, and post-deployment verification child
processes before clearing it. The runner requires the portable Node 22 runtime
at `%LOCALAPPDATA%\Moonball\runtimes\node-v22.23.2-win-x64` and temporarily
prepends it to `PATH` only for the runner process. It rejects other Node major
versions before prompting for the key or sending a transaction:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-node22-runtime.ps1
```

The bootstrap downloads the official Windows x64 archive, verifies its pinned
SHA-256 before extraction, and does not install Node or change system `PATH`.

```powershell
npm.cmd run deploy:base-sepolia:interactive -- -Approved
```

To avoid launching even the outer command through the system Node 24 runtime,
the direct PowerShell equivalent is preferred on this workstation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-base-sepolia-with-key.ps1 -Approved
```

The runner is hard-coded to Base Sepolia. It does not seed the oracle, create a
pool, add liquidity, or deploy vesting contracts.

### Partial-deployment recovery (2026-09-10)

The successful oracle transaction was pinned in
`deployments/baseSepolia.partial.json`. While that record had status `partial`,
the normal deploy script refused to run so it could not create a duplicate
oracle. The completed recovery changed the marker to `recovered`; the command
used was:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\recover-base-sepolia-with-key.ps1 -Approved -NodeRuntimeDirectory "$env:LOCALAPPDATA\Moonball\runtimes\node-v22.23.2-win-x64"
```

The recovery re-checks the oracle receipt, deployed bytecode, schema, owner,
updater, and staleness before any transaction. It scans deterministic deployer
addresses for an already-mined current MOON first, making a retry idempotent if
an RPC read fails after token submission. Only when none exists and the deployer
has no pending transaction does it send the MOON deployment. It then writes the
candidate record, marks the partial record recovered, and runs full read-only
verification. The recovery completed successfully with oracle transaction
`0x8573445ef4ba14c061c116f0fe92f57d07b34c8ac14eff11d46b7e04771e6e45`
and MOON transaction
`0xb1168d26a58fecbf06110756b9ed1434377debc489f618347b644be68ca81cca`.

```powershell
npm run deploy -- --network baseSepolia
```

The deployment creates a schema-v2 reference oracle and exactly 100,000,000
fixed-supply MOON. It writes `deployments/baseSepolia.json` with status
`candidate`. Any prior record is copied to `deployments/history/` first.

## 5. Verify the deployment before publishing data

```powershell
npm run verify:deployment -- --network baseSepolia
```

Do not continue unless fixed supply, oracle schema, owner, updater, staleness,
USDC code, and record contents all pass.

## 6. Publish and review contract sources

First run the local checks without publication:

```powershell
npm run verify:sources:base-sepolia
```

After explicit approval, use the guarded publisher. It needs no private key,
signature, or blockchain transaction:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-base-sepolia-sources.ps1 -Publish -NodeRuntimeDirectory "$env:LOCALAPPDATA\Moonball\runtimes\node-v22.23.2-win-x64"
```

The verified candidate sources are public at:

- Oracle: [Sourcify](https://repo.sourcify.dev/84532/0x67B5b3147072bd13D4bA41eCF7f7b3531CED7EEE)
  and [Base Sepolia Blockscout](https://base-sepolia.blockscout.com/address/0x67B5b3147072bd13D4bA41eCF7f7b3531CED7EEE#code)
- MOON: [Sourcify](https://repo.sourcify.dev/84532/0x70171D11Dfe7791431F06c8E1e7837517394D58D)
  and [Base Sepolia Blockscout](https://base-sepolia.blockscout.com/address/0x70171D11Dfe7791431F06c8E1e7837517394D58D#code)

Sourcify reports `exact_match` for both creation and runtime bytecode. Blockscout
reports both contracts fully verified with Solidity 0.8.24, optimizer enabled,
and 200 optimizer runs.

## 7. Publish one verified oracle snapshot

Do not put the updater key in `.env` while the checkout is inside OneDrive.
First run the guarded no-key preflight against the reviewed HTTPS dashboard:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bridge-base-sepolia-preflight.ps1 -DashboardUrl "https://..." -NodeRuntimeDirectory "$env:LOCALAPPDATA\Moonball\runtimes\node-v22.23.2-win-x64"
```

It verifies chain 84532, oracle schema, updater configuration, source consensus,
timestamps, sequence, deterministic identifiers, replay status, and a complete
`eth_call` simulation. It prints the exact sequence and snapshot ID without
loading a key or sending a transaction.

After those exact values are reviewed and explicitly approved, use the guarded
interactive publisher. Replace the placeholders with the approved preflight
values; the updater key is entered through a hidden prompt and exists only in
the wrapper process and its transaction child:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-base-sepolia-snapshot-with-key.ps1 -Approved -DashboardUrl "https://..." -ExpectedSnapshotId "0x..." -ExpectedSequence 1 -NodeRuntimeDirectory "$env:LOCALAPPDATA\Moonball\runtimes\node-v22.23.2-win-x64"
```

The publisher re-runs the no-key simulation before prompting. It refuses a
changed snapshot or sequence, an unauthorized signer, a wrong network, an
unfunded updater, and any unverified or malformed response. A successful run
publishes exactly one snapshot, confirms its receipt and on-chain freshness,
then performs read-only deployment verification.

## 8. Optional vesting rehearsal

Only after the core deployment is accepted, configure founder/investor
beneficiaries and run `deploy-vesting.ts` from the token-holding treasury. Start
with `DRY_RUN=1`, review the complete plan, then remove `DRY_RUN` deliberately.
Re-run `verify:deployment` immediately afterward.

## Acceptance criteria

- preflight, deploy, and post-deployment verification all pass;
- Safe/updater separation and ownership are correct;
- exactly 100,000,000 MOON exists;
- the bridge accepts a verified snapshot and rejects malformed/unverified input;
- `isFresh()` reflects source age;
- explorer addresses and source verification are recorded;
- the deployment remains `candidate`, not `current`, until review approval; and
- no pool, POL, fee splitter, or real liquidity is created in this rehearsal.
