# Moonball — Base Deployment & Production Readiness

This guide deploys the Moonball protocol (JackpotOracle + a fixed-supply
MoonballToken) to **Base Sepolia first**, wires the live oracle bridge, hands the
dashboard the contract addresses, seeds a DEX pool, and keeps oracle authority
with a Safe.

The accepted architecture is recorded in
[`../docs/architecture/FOUNDER_DECISIONS.md`](../docs/architecture/FOUNDER_DECISIONS.md)
and controls if this operational guide or the current scripts conflict with it.

MOON is a **DEX event-market token**: fixed supply (100M MOON), no protocol
mint/redeem, no collateral treasury, and no peg. Its price is discovered on a
MOON/USDC DEX pool. The oracle publishes a **reference value** only.

> ⚠️ Testnet first. This is an unaudited reference implementation. Do **not**
> deploy to Base mainnet or use real funds before a professional audit.

> ⚠️ The addresses currently stored in `deployments/baseSepolia.json` are
> **DEPRECATED / NOT CURRENT MOONBALL DEPLOYMENT**. Do not publish them as the
> current contracts. The file remains in the repository for traceability.

---

## 0. Prerequisites

- A deployer wallet **private key**, funded with:
  - Base Sepolia **ETH** for gas ([Base faucet](https://docs.base.org/tools/network-faucets)).
  - Base Sepolia **USDC** if you intend to seed a MOON/USDC pool
    (Circle faucet, token `0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
- A Moonball-controlled **2-of-3 Safe** address to own the oracle and production
  protocol assets. A timelock is optional for the MVP.
- Optionally a dedicated RPC URL (the scripts default to the public
  `https://sepolia.base.org`).

Copy `onchain/.env.example` → `onchain/.env` and fill it in. **Never commit `.env`.**

The hardhat toolchain is installed in the repo root `node_modules`; run all
commands **from the `onchain/` directory**.

---

## 1. Deploy to Base Sepolia

First run the read-only preflight. It validates the network, deployer balance,
official USDC, configuration, and any configured 2-of-3 Safe without sending a
transaction:

```bash
cd onchain
npm run preflight -- --network baseSepolia
```

Only after it passes:

```bash
cd onchain
# .env has DEPLOYER_PRIVATE_KEY, UPDATER_ADDRESS, SUPPLY_RECIPIENT, and official USDC_ADDRESS
npx hardhat run scripts/deploy.ts --network baseSepolia
```

This deploys the oracle + token, mints **100M MOON** to the recipient, writes
`deployments/baseSepolia.json`, and prints the dashboard env block:

```
── Dashboard env (Protocol page) ──
VITE_CHAIN_ID=84532
VITE_MOON_ADDRESS=0x...
VITE_ORACLE_ADDRESS=0x...
VITE_USDC_ADDRESS=0x...
```

Recommended env for a real testnet deploy:

```
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # Circle USDC on Base Sepolia
UPDATER_ADDRESS=0xYourBridgeKeeper...                       # required; limited operational role
SUPPLY_RECIPIENT=0xYourTreasuryWallet...                    # required; receives the fixed 100M supply
SAFE_ADDRESS=0xYourTwoOfThreeSafe...                        # optional on testnet; required on Base mainnet
# Publish the initial jackpot through the bridge when the updater is separate.
```

**Important:** `SUPPLY_RECIPIENT` should be the treasury / LP-seeder wallet that
will hold tokens and release them per the allocation schedule. The initial pool
seed is funded from the Treasury bucket (35%); the rest stays in treasury for
phased release. Founder (20%) and Investor (15%) tokens vest per their schedules.

The token contract hardcodes the founder-approved 100M supply. The deployment
must still verify `totalSupply()` before it is accepted. Deployer and MockUSDC
fallbacks are permitted only on hardhat/localhost; public networks require
explicit addresses, and Base mainnet requires a contract-validated 2-of-3 Safe.
`SEED_JACKPOT_M` is rejected on every public network. A new deployment archives
the previous record under `deployments/history/` before replacing the active file.

Immediately verify the recorded deployment against chain state:

```bash
npm run verify:deployment -- --network baseSepolia
```

---

## 2. Wire the dashboard Protocol page

Add the four `VITE_*` values printed above to the **dashboard** environment, then
rebuild/redeploy the dashboard. The `/protocol` page will pick up the addresses
and show the live oracle reference + token supply. Until they're set, the page
shows a "Contracts not deployed" state.

---

## 3. Calculate the pool seed amounts

Before seeding, use the pre-launch calculator as a **nonbinding scenario tool**.
Enter expected daily trading volume and target max price impact; the current
calculator displays a scenario using the oracle's risk-adjusted reference value:

- MOON to seed (funded from the Treasury allocation)
- USDC to seed (from the investor round / treasury)
- Reference-price scenario used by the calculator

The calculator does not authorize or automatically set the initial pool price.
The 2-of-3 Safe must separately approve the initial price and seed ratio. The
oracle reference may inform that review, but it is not a peg, price promise, or
pool-control input.

Manual formula if needed:
```
USDC_needed = daily_volume_usd × 0.05 / (max_impact_pct / 100)
MOON_needed = USDC_needed / approved_initial_price
```

Example scenario (daily volume $50K, 1% max impact, approved initial price = $82.68):
```
USDC_needed = $50,000 × 0.05 / 0.01 = $250,000
MOON_needed = $250,000 / $82.68 ≈ 3,024 MOON
Pool TVL = $500,000
% of 100M supply = 0.003%
```

---

## 4. Seed the MOON/USDC DEX pool

The market only opens once there is liquidity. From the `SUPPLY_RECIPIENT`
account, use the Safe-approved deployment workflow to create and register the
official MOON/USDC pool on canonical Uniswap v3 on Base with:

- **Fee tier: 1%** (pool fee = 10000 bps in Uniswap v3)
  — Compensates LPs for elevated impermanent loss around jackpot reset events.
  — A later change to 0.3% (3000 bps) is a possible governance-approved
    migration or configuration, not an automatic TVL trigger.
- **Initial price:** an explicit Safe-approved deployment parameter.
- **Seed amounts:** approved by the Safe after reviewing liquidity scenarios.
- **POL NFT recipient/owner:** the Moonball-controlled 2-of-3 Safe.

> The oracle must not initialize, reset, or otherwise control the pool price.
> Canonical Uniswap is public, so third parties may create unofficial pools;
> Moonball's registry and application recognize only the Safe-approved market.

---

## 5. Configure Moonball POL fee collection

The trader pays exactly the standard 1% Uniswap v3 pool fee. Moonball adds no
router surcharge, transfer tax, or additional trading fee.

When the 2-of-3 Safe collects fees earned by Moonball-owned POL positions:

1. The Safe remains the owner of each POL position NFT.
2. Collection sends the earned token amounts to an audited, narrowly scoped
   fee-splitter recipient.
3. The splitter sends exactly 12% of each collected token amount to the protocol
   treasury and keeps the remaining 88% with POL.
4. Third-party LP positions and their fees remain unaffected.

This is not Uniswap v3's native protocol fee and is not a per-swap router skim.
The splitter must document and test remainder handling so the aggregate result
is 12/88 at token precision. The splitter is not included in the current
implementation and must be built and audited before a current deployment can be
considered production-ready.

---

## 6. Run the oracle bridge

The bridge reads the dashboard's consensus-verified jackpot and pushes it
on-chain so the reference value stays fresh.

```bash
cd onchain
# Local development only:
ONCE=1 npx hardhat run scripts/bridge.ts
```

The keeper key (`PRIVATE_KEY`) must equal the oracle's `authorizedUpdater`
(the `UPDATER_ADDRESS` you deployed with). The bridge requires verified source
provenance, rebuilds the consensus, uses actual draw/source timestamps, and
refuses stale, contradictory, replayed, or deprecated-deployment input. A failed
`ONCE=1` run exits nonzero after bounded retries. For Base Sepolia, keep the key
out of `.env` and use the guarded Windows flow:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bridge-base-sepolia-preflight.ps1 -DashboardUrl "https://..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-base-sepolia-snapshot-with-key.ps1 -Approved -DashboardUrl "https://..." -ExpectedSnapshotId "0x..." -ExpectedSequence 1
```

The first command is read-only. The second revalidates the exact approved
snapshot and sequence before prompting for the updater key and publishing one
transaction.

---

## 6b. Lock founder & investor tokens in vesting wallets

Before any founder or investor tokens leave the treasury, lock them on-chain in
per-beneficiary vesting wallets so the community can verify the allocation is
genuinely time-locked — not just promised in docs. This deploys one
`MoonVestingWallet` (an OpenZeppelin `VestingWalletCliff`) per beneficiary and
transfers the allocated MOON from the treasury into each.

Run this **from the treasury / `SUPPLY_RECIPIENT` wallet** (the account holding
the genesis MOON):

```bash
cd onchain
# .env: DEPLOYER_PRIVATE_KEY = treasury key (holds the MOON)
FOUNDER_ADDRESS=0xFounder... \
INVESTOR_ADDRESSES=0xInvestorA...,0xInvestorB... \
  npx hardhat run scripts/deploy-vesting.ts --network baseSepolia
```

Default schedules (override with the env vars in `.env.example`):

| Bucket   | Amount      | Cliff      | Vest        |
|----------|-------------|------------|-------------|
| Founder  | 20M (20%)   | 1 year     | 4 years     |
| Investors| 15M (15%)   | 6 months   | 2 years     |

Investor amounts split `INVESTOR_TOTAL` (15M) evenly across `INVESTOR_ADDRESSES`
unless you pass explicit `INVESTOR_AMOUNTS`. Add `DRY_RUN=1` to validate the plan
and treasury balance without sending any transactions.

This writes `deployments/<network>.vesting.json` and prints a dashboard env block:

```
── Dashboard env (Protocol page vesting display) ──
VITE_VESTING_START=...
VITE_FOUNDER_VESTING_ADDRESS=0x...
VITE_INVESTOR_VESTING_ADDRESSES=0x...,0x...
```

Set `VITE_VESTING_START` in the dashboard environment so the `/protocol`
TokenomicsPanel shows live **locked vs. unlocked** amounts per vested bucket.

Verify on-chain after deploy:
- Each wallet's MOON balance equals its allocation.
- `releasable(MOON)` is `0` until the cliff passes; the beneficiary owns the wallet.
- There is **no clawback** — tokens can only ever flow to the beneficiary on schedule.

---

## 7. Confirm oracle ownership by the Safe

If `SAFE_ADDRESS` was supplied during public-network deployment, `deploy.ts`
validates that it reports threshold 2 with three owners and installs it as the
oracle owner in the constructor. Confirm the recorded and on-chain owner before
continuing. The token is immutable and ownerless — there is nothing to transfer
on it.

For an earlier testnet deployment made without `SAFE_ADDRESS`, transfer ownership
after verifying the bridge works end-to-end:

```bash
cd onchain
SAFE_ADDRESS=0xYourSafe... npx hardhat run scripts/transfer-ownership.ts --network baseSepolia
```

This starts a two-step transfer. The script prints the `acceptOwnership()`
transaction that the Safe must separately execute; ownership is not complete
until that Safe transaction confirms. The oracle's `authorizedUpdater` is left
unchanged.

---

## 8. End-to-end testnet checklist

- [ ] `deploy.ts` succeeds; `deployments/baseSepolia.json` written; **100M MOON** minted to `SUPPLY_RECIPIENT`.
- [ ] Bridge `ONCE=1` push confirmed; `getJackpotMillions()`, `oracleReferenceValueWad()`, and `isFresh()` correct on-chain.
- [ ] `deploy-vesting.ts` run from treasury; founder (20M) + investor (15M) wallets hold their MOON; `releasable()` is 0 pre-cliff; `deployments/<network>.vesting.json` written.
- [ ] Official continuing MOON/USDC pool seeded on canonical Uniswap v3 at the 1% fee tier using a Safe-approved initial price; swaps work both directions.
- [ ] Moonball 2-of-3 Safe owns the POL position NFT.
- [ ] Dashboard `/protocol` connects a wallet, switches to Base Sepolia, shows the oracle reference + supply.
- [ ] Dashboard pool size calculator returns correct seed amounts for test inputs.
- [ ] Oracle owner is the Safe; pause, updater rotation, and bounded staleness changes work through the Safe.

---

## 9. Production-readiness checklist (before any mainnet thought)

**Security**
- [ ] Professional smart-contract audit completed and findings resolved.
- [ ] Oracle admin role held by the Moonball 2-of-3 Safe — no permanent EOA owner.
- [ ] Keeper key isolated, rotatable via `setAuthorizedUpdater`, monitored for balance.
- [ ] POL fee-splitter built and audited; collection tests prove 12% treasury / 88% POL with no added trader fee.
- [ ] Safe owns every production POL NFT and can revoke or replace operational components.

**Token & allocation**
- [ ] Contract constant and on-chain `totalSupply()` both equal exactly 100,000,000 MOON.
- [ ] On Base mainnet, `SUPPLY_RECIPIENT` equals the contract-validated 2-of-3 Safe.
- [x] Founder allocation (20%) placed under a vesting contract (1yr cliff / 4yr vest) before tokens leave treasury. — `scripts/deploy-vesting.ts` (`MoonVestingWallet`), Step 6b.
- [x] Investor allocation (15%) placed under vesting contracts per term sheet before tokens leave treasury. — `scripts/deploy-vesting.ts`, Step 6b.
- [ ] Community allocation (30%) gated behind governance/incentive contracts.
- [ ] Token allocation split and release schedule published publicly.

**Oracle integrity**
- [x] Bridge verification is mandatory and cannot be disabled.
- [x] Source timestamps, identifiers, sequence checks, and replay protection are implemented.
- [ ] Staleness threshold tuned; alerting when `isFresh()` flips false.
- [ ] Sanity bounds reviewed for the live jackpot range.
- [ ] Consider per-update deviation limits (large jumps rejected/flagged).

**Market & fee structure**
- [ ] One continuing official MOON/USDC pool seeded at the 1% Uniswap v3 fee tier.
- [ ] Initial price and seed amounts explicitly approved by the Safe; oracle data does not initialize or control the pool.
- [ ] Current 50% POL / 50% operations treasury policy documented as mutable policy, not immutable protocol logic.
- [ ] Any future fee-tier migration requires a separate governance decision; no automatic TVL trigger is promised.
- [ ] POL fee-splitter deployed and tested; treasury and POL recipients confirmed.
- [ ] Fee collection verified: 12% of Moonball POL fees to treasury and 88% retained by POL; third-party LP fees unaffected.
- [ ] Clear, disclosed messaging that MOON has no redemption and no peg — the oracle value is a reference, not a price the protocol honors.
- [ ] No automatic, mandatory, price-defense, promised, or guaranteed buyback exists.

**Frontend / ops**
- [ ] `VITE_*` addresses point at the audited deployment; chain id correct.
- [ ] Wrong-network and "not deployed" states verified.
- [ ] Contract addresses published; source verified on BaseScan.
- [ ] Monitoring/alerting for bridge liveness and oracle freshness.

---

## Network reference

| Network      | chainId | USDC (Circle)                                | Explorer                     |
|--------------|---------|----------------------------------------------|------------------------------|
| Base Sepolia | 84532   | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | https://sepolia.basescan.org |
| Base mainnet | 8453    | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | https://basescan.org         |
