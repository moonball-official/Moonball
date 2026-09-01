# Moonball On-Chain Protocol

The on-chain half of Moonball: a fixed-supply ERC-20 token (**MOON**) that trades
as a **DEX event market** on Base. MOON's price is discovered entirely on a
decentralized exchange (e.g. a MOON/USDC Uniswap v3 pool). A read-only
`JackpotOracle` publishes a **reference value** derived from the verified
Powerball jackpot — informational only, **not** a peg or a price the protocol
trades at.

There is **no protocol mint, no redemption, no collateral treasury, and no peg
to defend.** The token is immutable and ownerless once deployed.

This is an **isolated Hardhat project**. It has its own `package.json`,
config, and test/scripts and does **not** touch the running dashboard
(Express/React/Postgres). The dashboard is the off-chain data source; the
`bridge` script is the only link between the two.

> ⚠️ Not deployed to any live network and not audited. See **Production gaps**.

## Contracts

| Contract | Purpose |
| --- | --- |
| `MoonballToken.sol` | The MOON ERC-20. Fixed supply (100M MOON) minted once at deployment to a single recipient (the DEX liquidity seeder). No mint, redeem, peg, treasury, or admin — immutable and ownerless. |
| `JackpotOracle.sol` | Stores the latest verified jackpot and exposes an informational reference value. Only an authorized updater (the bridge) can push data; enforces $20M–$5B sanity bounds and staleness. |
| `interfaces/IJackpotOracle.sol` | Oracle interface. |
| `mocks/MockUSDC.sol` | 6-decimal test USDC (open `mint`), usable as a DEX pair token in tests. Test only. |

### Key design points

- **Price is set by the market, not the protocol.** MOON has a fixed supply that
  is minted in full at deployment (100M tokens). The protocol never creates or
  destroys tokens after that, never holds collateral, and never buys or sells MOON.
  Whatever the DEX pool says MOON is worth, that's the price.
- **The oracle publishes a reference value, not a peg.** `oracleReferenceValueWad()`
  returns a linear reference derived from public jackpot data ($10 at the $20M
  floor, +$10 per $20M — i.e. `jackpotMillions / 2` dollars, so $225M ⇒ $112.50).
  The token does not read this value; nothing on-chain forces the market price
  toward it. It exists so the on-chain surface can publish the same reference the
  dashboard shows.
- **Oracle integrity.** Only the authorized updater (the bridge keeper) can push
  data. The oracle enforces $20M–$5B sanity bounds and a staleness threshold so
  consumers can tell when the reference is fresh.
- **Immutable token.** `MoonballToken` has no owner and no admin functions. What
  ships is what holders get — there is no pause, no fee switch, and no upgrade path.

## Token Supply & Allocation

The full 100M MOON is minted at genesis to the treasury/LP-seeder wallet. **Not
all 100M is released at once.** The treasury holds and releases tokens according
to the allocation buckets below. Token allocation is sized based on estimated
pre-launch traffic and the initial pool price equilibrium (set to the oracle's
risk-adjusted value at the time of seeding).

| Bucket | % | MOON | Notes |
|---|---|---|---|
| Founder | 20% | 20M | Solo founder. 1-year cliff, 4-year vesting. |
| Investors | 15% | 15M | Seed round that funds initial pool capital and operations. Vesting per term sheet. |
| Treasury | 35% | 35M | Funds the initial MOON/USDC pool seed (POL), future POL top-ups, buybacks, operations. Phased release by governance. |
| Community & Incentives | 30% | 30M | Trading rewards, LP incentives, ecosystem growth. Gradual 4-year release. |

> The initial pool seed (protocol-owned liquidity) is funded out of the Treasury
> bucket — it is not a separate named allocation. The seed amount is computed at
> launch using the pool size calculator.

**Buybacks:** the treasury operations budget may buy back MOON from the open
market. Buybacks use the 50% operations portion of the protocol skim (see Fee
Structure below), not a separate reserve.

## Fee Structure

All fees are at the pool/router layer. The token contract is 0% fee, immutable.

| Layer | Parameter | Value |
|---|---|---|
| Token contract | Transfer fee | 0% — immutable, no fee switch |
| DEX pool | Swap fee tier | 1% (Uniswap v3 10000-bps tier) at launch |
| Protocol skim | Router-layer take | 12% of each swap fee → treasury |
| LP share | Remainder | 88% of each swap fee → liquidity providers |

### Liquidity Growth Policy

100% of the protocol skim is split automatically:
- **50% → Protocol-Owned Liquidity (POL):** reinvested back into the MOON/USDC
  pool to deepen spreads. Never withdrawn to defend price.
- **50% → Operations:** oracle infrastructure, audits, and development.

This split is the defined Liquidity Growth Policy and is published on-chain.

### Fee Tier Glide Path

As pool TVL grows, the fee tier steps down to attract more volume:

| Pool TVL | Fee tier | Trigger |
|---|---|---|
| Launch | 1.00% (10000 bps) | Initial deployment |
| $500K+ | 0.30% (3000 bps) | Governance vote at milestone |

Deeper pool → lower fee → more volume → more skim → more POL (compounding flywheel).

### Pool Seeding Formula

The initial MOON/USDC seed amounts are chosen so:
1. **Launch price = oracle's risk-adjusted value** at the time of pool creation.
   This anchors the "Market Efficiency" metric at 100% on day one.
2. **Pool depth** is sized to daily volume forecasts:
   `USDC_needed = daily_volume × 0.05 / (target_impact_pct / 100)`
   where target_impact_pct is the desired max price impact per trade (e.g. 1%).
   `MOON_needed = USDC_needed / launch_price`

Use the pre-launch calculator on the Protocol page of the dashboard to compute
the exact seed amounts from a traffic estimate.

## Layout

```
onchain/
  contracts/        Solidity sources
  test/             Hardhat + chai test suite
  scripts/
    deploy.ts             Deploy oracle + token, record addresses (deployments/<network>.json)
    bridge.ts             Off-chain oracle bridge (dashboard → on-chain)
    transfer-ownership.ts Move oracle ownership to a Safe (token is ownerless)
  hardhat.config.ts
```

## Usage

All commands run **from `onchain/`**. Dependencies live in the repo root
`node_modules` (Node resolves them from here).

```bash
# Compile
npx hardhat compile

# Run the test suite
npx hardhat test
```

### Local end-to-end (node + deploy + bridge)

```bash
# Terminal 1: local chain
npx hardhat node

# Terminal 2: deploy (deploys a MockUSDC pair token + the oracle + the token)
SEED_JACKPOT_M=225 npx hardhat run scripts/deploy.ts --network localhost

# Terminal 2: push the dashboard's verified jackpot on-chain, once
RPC_URL=http://127.0.0.1:8545 PRIVATE_KEY=0x... \
DASHBOARD_URL=http://localhost:5000 ONCE=1 \
  npx hardhat run scripts/bridge.ts --network localhost
```

After deployment, the recipient seeds a MOON/USDC DEX pool from its balance to
open the market. The bridge reads `GET /api/powerball/live`, takes the
consensus-verified `estimated` value (millions), converts to whole USD, and calls
`fulfillJackpotData`. By default it only pushes when
`verificationStatus === "verified"` (set `REQUIRE_VERIFIED=false` to override) and
skips values outside the oracle's $20M–$5B bounds. Use `POLL_SECONDS=300` to run
it as a daemon instead of a single update.

### Configuration (env / `.env`)

| Var | Used by | Meaning |
| --- | --- | --- |
| `RPC_URL` | bridge, config | Chain RPC endpoint |
| `PRIVATE_KEY` | bridge | Authorized updater key |
| `DEPLOYER_PRIVATE_KEY` | deploy/config | Deployer key |
| `ORACLE_ADDRESS` | bridge | Oracle to update (else read from `deployments/<NETWORK>.json`) |
| `DASHBOARD_URL` | bridge | Dashboard base URL (default `http://localhost:5000`) |
| `REQUIRE_VERIFIED` | bridge | Only push consensus-verified values (default `true`) |
| `POLL_SECONDS` / `ONCE` | bridge | Daemon interval / single run |
| `USDC_ADDRESS` | deploy | DEX pair quote token; if unset a MockUSDC is deployed (test only) |
| `UPDATER_ADDRESS` | deploy | Oracle updater / bridge keeper (e.g. a Safe) |
| `ORACLE_STALENESS` | deploy | Seconds before oracle data is stale (default 14400) |
| `MOON_SUPPLY` / `SUPPLY_RECIPIENT` | deploy | Genesis supply in whole MOON (use `100000000` for 100M) and the address that receives it |
| `SEED_JACKPOT_M` | deploy | Optional jackpot (millions) to push to the oracle at deploy |
| `SAFE_ADDRESS` | transfer-ownership | New oracle owner (multisig/timelock) |

## Test results

`npx hardhat test` — **16 passing**. Coverage:

- **Oracle:** freshness, millions conversion, updater authorization, $20M–$5B
  bounds, staleness expiry, reference-value math, updater rotation.
- **Reference vs. token decoupling:** the token never reads the oracle and exposes
  no peg/redeem surface.
- **Token:** ERC-20 metadata, genesis supply minted to the recipient, zero-address
  / zero-supply deploy guards, transfer + events, balance/zero-address reverts,
  approve + transferFrom with allowance decrement, infinite (max) allowance, and
  over-allowance revert.

## Production gaps (before any mainnet deploy)

1. **Professional audit** of the ERC-20 and oracle, even though the token is now a
   minimal fixed-supply contract. This is a reference implementation, not audited code.
2. **Oracle decentralization / redundancy.** Today a single authorized updater
   pushes data. Production should use multiple independent updaters, a
   timelock/Safe on admin functions, and ideally a Chainlink/commit-reveal layer so
   one compromised key can't poison the reference value.
3. **Governance & key management.** The oracle `owner` should be a multi-sig (Safe)
   with a timelock on `setAuthorizedUpdater`, `setStalenessThreshold`, and ownership
   transfer. Use `scripts/transfer-ownership.ts` to move it. (The token is ownerless.)
4. **Oracle bounds heuristics.** The $20M–$5B bounds are heuristics; validate
   against historical Powerball data and add per-update deviation limits.
5. **ERC-20 completeness.** Consider EIP-2612 `permit`, and confirm the minimal
   ERC-20 implementation against the exact integrations (DEXs, bridges) you target.
6. **DEX/market design.** Launch at 1% fee tier (Uniswap v3 10000-bps). Pool
   seeding amounts calculated from the pre-launch calculator using expected daily
   volume and the oracle's risk-adjusted value as the launch price. A governance
   vote can step the fee down to 0.3% once TVL reaches $500K. Protocol skim router
   contract (12% of swap fees → treasury) requires development and audit before mainnet.
7. **Operational hardening of the bridge.** Add retries/alerting, redundant RPCs,
   nonce management, gas strategy, and monitoring; run it as a managed service, not
   a one-off script.
8. **Legal/regulatory review** of a jackpot-referenced event-market token before any
   public launch.
