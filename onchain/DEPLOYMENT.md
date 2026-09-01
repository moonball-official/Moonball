# Moonball — Base Deployment & Production Readiness

This guide deploys the Moonball protocol (JackpotOracle + a fixed-supply
MoonballToken) to **Base Sepolia first**, wires the live oracle bridge, hands the
dashboard the contract addresses, seeds a DEX pool, and transfers oracle
ownership to a Safe.

MOON is a **DEX event-market token**: fixed supply (100M MOON), no protocol
mint/redeem, no collateral treasury, and no peg. Its price is discovered on a
MOON/USDC DEX pool. The oracle publishes a **reference value** only.

> ⚠️ Testnet first. This is an unaudited reference implementation. Do **not**
> deploy to Base mainnet or use real funds before a professional audit.

---

## 0. Prerequisites

- A deployer wallet **private key**, funded with:
  - Base Sepolia **ETH** for gas ([Base faucet](https://docs.base.org/tools/network-faucets)).
  - Base Sepolia **USDC** if you intend to seed a MOON/USDC pool
    (Circle faucet, token `0x036CbD53842c5426634e7929541eC2318f3dCF7e`).
- A **Safe** (or other multisig/timelock) address to own the oracle.
- Optionally a dedicated RPC URL (the scripts default to the public
  `https://sepolia.base.org`).

Copy `onchain/.env.example` → `onchain/.env` and fill it in. **Never commit `.env`.**

The hardhat toolchain is installed in the repo root `node_modules`; run all
commands **from the `onchain/` directory**.

---

## 1. Deploy to Base Sepolia

```bash
cd onchain
# .env has DEPLOYER_PRIVATE_KEY (and USDC_ADDRESS for the pair token, else a MockUSDC is deployed)
MOON_SUPPLY=100000000 SEED_JACKPOT_M=225 npx hardhat run scripts/deploy.ts --network baseSepolia
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
UPDATER_ADDRESS=0xYourBridgeKeeper...                       # defaults to deployer
MOON_SUPPLY=100000000                                       # 100M MOON — full genesis supply
SUPPLY_RECIPIENT=0xYourTreasuryWallet...                    # receives all 100M (defaults to deployer)
SEED_JACKPOT_M=225                                          # optional: push an initial jackpot to the oracle
```

**Important:** `SUPPLY_RECIPIENT` should be the treasury / LP-seeder wallet that
will hold tokens and release them per the allocation schedule. The initial pool
seed is funded from the Treasury bucket (35%); the rest stays in treasury for
phased release. Founder (20%) and Investor (15%) tokens vest per their schedules.

---

## 2. Wire the dashboard Protocol page

Add the four `VITE_*` values printed above to the **dashboard** environment, then
rebuild/redeploy the dashboard. The `/protocol` page will pick up the addresses
and show the live oracle reference + token supply. Until they're set, the page
shows a "Contracts not deployed" state.

---

## 3. Calculate the pool seed amounts

Before seeding, use the **pre-launch calculator** on the dashboard's Protocol page
(`/protocol`) to determine the right MOON/USDC amounts. Enter your expected daily
trading volume and target max price impact, and the calculator outputs:

- MOON to seed (funded from the Treasury allocation)
- USDC to seed (from the investor round / treasury)
- Launch price (automatically anchored to the oracle's current risk-adjusted value)

**The initial pool price equals the oracle's risk-adjusted value** at the moment
you seed. This anchors the "Market Efficiency" metric at 100% on day one.

Manual formula if needed:
```
USDC_needed = daily_volume_usd × 0.05 / (max_impact_pct / 100)
MOON_needed = USDC_needed / oracle_risk_adjusted_value
```

Example (daily volume $50K, 1% max impact, oracle risk-adjusted = $82.68):
```
USDC_needed = $50,000 × 0.05 / 0.01 = $250,000
MOON_needed = $250,000 / $82.68 ≈ 3,024 MOON
Pool TVL = $500,000
% of 100M supply = 0.003%
```

---

## 4. Seed the MOON/USDC DEX pool

The market only opens once there is liquidity. From the `SUPPLY_RECIPIENT`
account, create a MOON/USDC pool on Uniswap v3 on Base with:

- **Fee tier: 1%** (pool fee = 10000 bps in Uniswap v3)
  — Compensates LPs for elevated impermanent loss around jackpot reset events.
  — Glide path: step down to 0.3% (3000 bps) once pool TVL reaches $500K via
    a governance vote.
- **Initial price:** set equal to the oracle's current risk-adjusted value.
- **Seed amounts:** from the calculator output in Step 3.

> The initial price is anchored to the oracle reference value — it is informational,
> not a protocol guarantee. The oracle never defends this price.

---

## 5. Configure the protocol skim (router layer)

The 12% protocol skim is collected at the **router layer**, not inside the token
or the pool. This requires a custom router contract (or a DEX aggregator hook)
that:

1. Routes swaps through the MOON/USDC pool.
2. Retains 12% of the swap fee on each trade and forwards it to the treasury wallet.
3. Passes the remaining 88% to LPs (unchanged from their normal pool earnings).

> ⚠️ The router contract is not included in this reference implementation and must
> be built and audited separately before mainnet. Until it is deployed, LPs receive
> 100% of swap fees. The 12% / 88% split is the target post-router configuration.

---

## 6. Run the oracle bridge

The bridge reads the dashboard's consensus-verified jackpot and pushes it
on-chain so the reference value stays fresh.

```bash
cd onchain
# .env: PRIVATE_KEY (updater/keeper), DASHBOARD_URL, NETWORK=baseSepolia
ONCE=1 npx hardhat run scripts/bridge.ts            # single push (test)
POLL_SECONDS=300 npx hardhat run scripts/bridge.ts  # run as a daemon
```

The keeper key (`PRIVATE_KEY`) must equal the oracle's `authorizedUpdater`
(the `UPDATER_ADDRESS` you deployed with). Bridge skips non-verified values and
anything outside the oracle's `$20M–$5B` sanity bounds.

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

## 7. Transfer oracle ownership to the Safe

Do this **after** verifying the bridge works end-to-end. The token is immutable
and ownerless — there is nothing to transfer on it. Only the oracle has an owner.

```bash
cd onchain
SAFE_ADDRESS=0xYourSafe... npx hardhat run scripts/transfer-ownership.ts --network baseSepolia
```

Moves `JackpotOracle.owner` to the Safe. The oracle's `authorizedUpdater` (bridge
keeper) is left unchanged so the bridge keeps working.

---

## 8. End-to-end testnet checklist

- [ ] `deploy.ts` succeeds; `deployments/baseSepolia.json` written; **100M MOON** minted to `SUPPLY_RECIPIENT`.
- [ ] Bridge `ONCE=1` push confirmed; `getJackpotMillions()`, `oracleReferenceValueWad()`, and `isFresh()` correct on-chain.
- [ ] `deploy-vesting.ts` run from treasury; founder (20M) + investor (15M) wallets hold their MOON; `releasable()` is 0 pre-cliff; `deployments/<network>.vesting.json` written.
- [ ] MOON/USDC pool seeded on Uniswap v3 at 1% fee tier; launch price = oracle risk-adjusted value; swaps work both directions.
- [ ] Dashboard `/protocol` connects a wallet, switches to Base Sepolia, shows the oracle reference + supply.
- [ ] Dashboard pool size calculator returns correct seed amounts for test inputs.
- [ ] Oracle ownership transferred to the Safe; admin calls (`setAuthorizedUpdater`, `setStalenessThreshold`) work from the Safe.

---

## 9. Production-readiness checklist (before any mainnet thought)

**Security**
- [ ] Professional smart-contract audit completed and findings resolved.
- [ ] Oracle admin role held by a Safe (multisig) and/or timelock — no EOA owners.
- [ ] Keeper key isolated, rotatable via `setAuthorizedUpdater`, monitored for balance.
- [ ] Protocol skim router contract built, audited, and treasury wallet whitelisted.

**Token & allocation**
- [ ] `MOON_SUPPLY=100000000` used in deploy — confirm on-chain total supply.
- [ ] `SUPPLY_RECIPIENT` is the treasury/LP-seeder wallet, not a personal EOA.
- [x] Founder allocation (20%) placed under a vesting contract (1yr cliff / 4yr vest) before tokens leave treasury. — `scripts/deploy-vesting.ts` (`MoonVestingWallet`), Step 6b.
- [x] Investor allocation (15%) placed under vesting contracts per term sheet before tokens leave treasury. — `scripts/deploy-vesting.ts`, Step 6b.
- [ ] Community allocation (30%) gated behind governance/incentive contracts.
- [ ] Token allocation split and release schedule published publicly.

**Oracle integrity**
- [ ] Bridge runs with `REQUIRE_VERIFIED=true` (consensus values only).
- [ ] Staleness threshold tuned; alerting when `isFresh()` flips false.
- [ ] Sanity bounds reviewed for the live jackpot range.
- [ ] Consider per-update deviation limits (large jumps rejected/flagged).

**Market & fee structure**
- [ ] Pool seeded at 1% fee tier with MOON/USDC amounts from the calculator (anchored to oracle risk-adjusted value).
- [ ] Launch price confirmed equal to oracle risk-adjusted value at seed time.
- [ ] Liquidity Growth Policy (50% POL / 50% ops) published on-chain and documented.
- [ ] Fee tier glide-path governance process defined (vote required to step from 1% → 0.3%).
- [ ] Protocol skim router deployed and tested; treasury wallet address confirmed.
- [ ] Clear, disclosed messaging that MOON has no redemption and no peg — the oracle value is a reference, not a price the protocol honors.

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
