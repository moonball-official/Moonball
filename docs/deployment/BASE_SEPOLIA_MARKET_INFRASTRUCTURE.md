# Base Sepolia Market-Infrastructure Preparation

- **Status (2026-09-21):** Source and guarded scripts prepared; live read-only
  preflight passed; **no market contract has been deployed**.
- **Scope:** The POL fee splitter and official-market registry only.
- **Excluded:** Base mainnet, oracle publication, oracle ownership transfer,
  market registration, pool creation, liquidity, vesting, and token transfers.

The approved Base Sepolia rehearsal values are pinned in
`onchain/scripts/market-config.ts`:

| Role | Address |
| --- | --- |
| MOON candidate | `0x70171D11Dfe7791431F06c8E1e7837517394D58D` |
| Circle USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Safe owner / POL recipient (88%) | `0xB2cb3851d8055bA6aA8Cf7E548c1211D475e0d29` |
| Treasury recipient (12%) | `0xd46AC2c972c7f49eaD826a40f0F0EEBa0e12847c` |
| Uniswap v3 factory | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |

The factory value comes from [Uniswap's published SDK addresses](https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts)
for Base Sepolia. The live read-only check confirmed contract code and the
enabled 1% fee tier. `getPool(MOON, USDC, 10000)` returned the zero address: no
canonical 1% pool currently exists. The scripts do not create or register one.

The Safe reported three distinct owners and threshold one. That means any
single owner can act alone. This is accepted for Base Sepolia rehearsal only;
Moonball's Base mainnet guard still requires a 2-of-3 Safe.

The treasury destination is a valid public address but had no contract code
at the 2026-09-21 read-only preflight; it could be an externally owned account
or an undeployed contract. The founder stated on 2026-09-21 that they control
the wallet ending in `e12847c`. This is a self-attestation, not cryptographic
proof or an independent custody check. Reconfirm the full address on the
signing device before any approved deployment. Do not send private keys, seed
phrases, or signed messages to Codex.

## Read-only operator command

From `onchain/` in PowerShell, with the approved portable Node 22 runtime:

```powershell
$runtime = "$env:LOCALAPPDATA\Moonball\runtimes\node-v22.23.2-win-x64"
$env:Path = "$runtime;$env:Path"
npm.cmd run market:base-sepolia:preflight
```

The preflight checks chain 84532, the pinned core candidate, MOON supply, USDC
decimals, Safe shape, factory code and fee tier, and any existing 1% pool. It
does not require a private key or send a transaction.

A 2026-09-21 rerun from the restricted Codex environment stopped with
`AggregateError [EACCES]` before it could read current chain state. The earlier
successful read-only preflight is not a substitute for a fresh local preflight
before any separately approved transaction.

`market:base-sepolia:verify` is also read-only, but will correctly refuse to
run until a separate market candidate record exists. Neither command approves
deployment.

## Guarded future deployment (not approved in this run)

The transaction-bearing script is limited to Base Sepolia and requires an exact
approval token, a configured `DEPLOYER_ADDRESS` matching the locally prompted
private key, a fresh read-only preflight, and absence of any market deployment
record or partial marker. The Windows wrapper checks portable Node 22 and asks
for the key with hidden input only after preflight succeeds. It does not write
the key to `.env` or to the synchronized checkout.

Before the first broadcast, the script creates
`onchain/deployments/baseSepolia.market.partial.json`. If interrupted, this
marker blocks blind retries; its transaction hashes must be reconciled against
chain state. On success, the script verifies both creation transactions against
the compiled artifacts and exact constructor arguments, checks on-chain owner
and recipient state, then writes
`onchain/deployments/baseSepolia.market.json` with `candidate` status.

Both contracts are deployed with the Safe as initial owner. The registry's
official pool remains unset; it never creates a pool or moves liquidity.

Do not run the transaction-bearing workflow until treasury custody,
independent audit requirements, deployment gas, and the exact scope have been
reviewed and separately approved. A successful testnet candidate would not
authorize Base mainnet or real liquidity.
